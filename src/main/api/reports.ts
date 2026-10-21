import { all, one, r2, today } from '../db'
import { requirePerm, requireUser } from '../auth'

export const CATEGORY_LABEL: Record<string, string> = {
  service: 'ค่าบริการ/ค่าตรวจ',
  procedure: 'หัตถการ',
  vaccine: 'วัคซีน',
  medicine: 'ยา',
  food: 'อาหาร',
  supply: 'เวชภัณฑ์/อุปกรณ์',
  grooming: 'อาบน้ำตัดขน',
  boarding: 'ฝากเลี้ยง/ค่าห้อง',
  other: 'อื่น ๆ'
}

/** Net sales of a line after its share of the bill discount, excluding VAT added on top. */
const NET_LINE = `(it.line_total - CASE WHEN (i.subtotal - i.line_discount) > 0
    THEN i.bill_discount * it.line_total / (i.subtotal - i.line_discount) ELSE 0 END)`

/** Key numbers for a date range — the building block of the executive summary. */
function periodSummary(from: string, to: string): any {
  const inv = one<any>(
    `SELECT COUNT(*) AS bills, COALESCE(SUM(total),0) AS sales, COALESCE(SUM(total - vat_amount),0) AS net,
            COALESCE(SUM(cost_total),0) AS cost, COALESCE(SUM(line_discount + bill_discount),0) AS discount,
            COUNT(DISTINCT customer_id) AS customers, COALESCE(SUM(total - paid_amount),0) AS unpaid
     FROM invoices WHERE date(issued_at) BETWEEN ? AND ? AND status <> 'void'`,
    from,
    to
  )
  const newCustomers = one<{ n: number }>('SELECT COUNT(*) AS n FROM customers WHERE date(created_at) BETWEEN ? AND ?', from, to)!.n
  const newPets = one<{ n: number }>('SELECT COUNT(*) AS n FROM pets WHERE date(created_at) BETWEEN ? AND ?', from, to)!.n
  const visits = one<{ n: number }>('SELECT COUNT(*) AS n FROM visits WHERE visit_date BETWEEN ? AND ?', from, to)!.n
  const admits = one<{ n: number }>("SELECT COUNT(*) AS n FROM admissions WHERE date(admitted_at) BETWEEN ? AND ? AND status <> 'cancelled'", from, to)!.n
  const vaccines = one<{ n: number }>('SELECT COUNT(*) AS n FROM vaccinations WHERE given_date BETWEEN ? AND ?', from, to)!.n
  const voids = one<any>(`SELECT COUNT(*) AS n, COALESCE(SUM(total),0) AS total FROM invoices WHERE date(issued_at) BETWEEN ? AND ? AND status = 'void'`, from, to)
  return {
    from,
    to,
    bills: inv.bills,
    sales: r2(inv.sales),
    gross_profit: r2(inv.net - inv.cost),
    margin: inv.net > 0 ? Math.round(((inv.net - inv.cost) / inv.net) * 1000) / 10 : 0,
    avg_bill: inv.bills ? r2(inv.sales / inv.bills) : 0,
    discount: r2(inv.discount),
    customers: inv.customers,
    unpaid: r2(inv.unpaid),
    new_customers: newCustomers,
    new_pets: newPets,
    visits,
    admits,
    vaccines,
    void_count: voids.n,
    void_total: r2(voids.total)
  }
}

const ymd = (d: Date): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const shiftDays = (date: string, n: number): string => {
  const d = new Date(date + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return ymd(d)
}
const monthRange = (ym: string, offset = 0): [string, string] => {
  const [y, m] = ym.split('-').map(Number)
  const a = new Date(y, m - 1 + offset, 1)
  const b = new Date(y, m + offset, 0)
  return [ymd(a), ymd(b)]
}

export const reportsApi = {
  /** Executive view: one day vs comparisons, one month vs comparisons, and a 12-month trend. */
  'reports.executive': (a: { date?: string; month?: string }) => {
    requirePerm('reports')
    const date = a.date || today()
    const month = a.month || date.slice(0, 7)
    const [mFrom, mTo] = monthRange(month)
    const [pFrom, pTo] = monthRange(month, -1)
    const [yFrom, yTo] = monthRange(month, -12)

    const hourly = all<{ h: string; sales: number; bills: number }>(
      `SELECT strftime('%H', issued_at) AS h, SUM(total) AS sales, COUNT(*) AS bills FROM invoices
       WHERE date(issued_at) = ? AND status <> 'void' GROUP BY h ORDER BY h`,
      date
    )
    const dailySeries = (from: string, to: string): any[] =>
      all(
        `WITH RECURSIVE days(day) AS (SELECT ? UNION ALL SELECT date(day, '+1 day') FROM days WHERE day < ?)
         SELECT days.day,
           COALESCE((SELECT SUM(total) FROM invoices WHERE date(issued_at) = days.day AND status <> 'void'), 0) AS sales,
           COALESCE((SELECT SUM(total - vat_amount - cost_total) FROM invoices WHERE date(issued_at) = days.day AND status <> 'void'), 0) AS profit,
           (SELECT COUNT(*) FROM invoices WHERE date(issued_at) = days.day AND status <> 'void') AS bills
         FROM days ORDER BY days.day`,
        from,
        to
      )
    const trend = Array.from({ length: 12 }, (_, i) => {
      const [f, t] = monthRange(month, i - 11)
      const s = periodSummary(f, t)
      return { month: f.slice(0, 7), sales: s.sales, gross_profit: s.gross_profit, bills: s.bills, new_customers: s.new_customers, visits: s.visits, avg_bill: s.avg_bill }
    })
    const categories = all<any>(
      `SELECT it.category, SUM(${NET_LINE}) AS net, SUM(${NET_LINE}) - SUM(it.qty * it.unit_cost) AS profit
       FROM invoice_items it JOIN invoices i ON i.id = it.invoice_id
       WHERE date(i.issued_at) BETWEEN ? AND ? AND i.status <> 'void' GROUP BY it.category ORDER BY net DESC`,
      mFrom,
      mTo
    ).map((r) => ({ ...r, label: CATEGORY_LABEL[r.category] ?? r.category }))
    const methods = all(
      `SELECT method, SUM(CASE WHEN kind = 'refund' THEN -amount ELSE amount END) AS amount
       FROM payments WHERE date(paid_at) BETWEEN ? AND ? AND method <> 'deposit' GROUP BY method`,
      mFrom,
      mTo
    )
    const topCustomers = all(
      `SELECT c.name, COUNT(*) AS bills, SUM(i.total) AS sales FROM invoices i JOIN customers c ON c.id = i.customer_id
       WHERE date(i.issued_at) BETWEEN ? AND ? AND i.status <> 'void' GROUP BY c.id ORDER BY sales DESC LIMIT 5`,
      mFrom,
      mTo
    )
    return {
      date,
      month,
      day: periodSummary(date, date),
      yesterday: periodSummary(shiftDays(date, -1), shiftDays(date, -1)),
      last_week_day: periodSummary(shiftDays(date, -7), shiftDays(date, -7)),
      hourly,
      this_month: { ...periodSummary(mFrom, mTo > today() && month === today().slice(0, 7) ? today() : mTo) },
      prev_month: periodSummary(pFrom, pTo),
      last_year_month: periodSummary(yFrom, yTo),
      month_daily: dailySeries(mFrom, mTo),
      prev_month_daily: dailySeries(pFrom, pTo),
      trend,
      categories,
      methods,
      top_customers: topCustomers,
      outstanding: one<any>(`SELECT COUNT(*) AS n, COALESCE(SUM(total - paid_amount),0) AS amount FROM invoices WHERE status IN ('unpaid','partial')`),
      admitted_now: one<{ n: number }>("SELECT COUNT(*) AS n FROM admissions WHERE status = 'admitted'")!.n
    }
  },

  'reports.dashboard': () => {
    requireUser()
    const d = today()
    const sales = one<any>(
      `SELECT COUNT(*) AS bills, COALESCE(SUM(total),0) AS total, COALESCE(SUM(total - paid_amount),0) AS unpaid
       FROM invoices WHERE date(issued_at) = ? AND status <> 'void'`,
      d
    )
    const received = all<{ method: string; amount: number }>(
      `SELECT method, SUM(CASE WHEN kind = 'refund' THEN -amount ELSE amount END) AS amount
       FROM payments WHERE date(paid_at) = ? GROUP BY method`,
      d
    )
    const outstanding = one<any>(
      `SELECT COUNT(*) AS n, COALESCE(SUM(total - paid_amount),0) AS amount
       FROM invoices WHERE status IN ('unpaid','partial')`
    )
    const month = one<any>(
      `SELECT COALESCE(SUM(total),0) AS total, COUNT(*) AS bills FROM invoices
       WHERE strftime('%Y-%m', issued_at) = strftime('%Y-%m', 'now', 'localtime') AND status <> 'void'`
    )
    const visitsToday = one<{ n: number }>('SELECT COUNT(*) AS n FROM visits WHERE visit_date = ?', d)!.n
    const dueSoon = one<{ n: number }>(
      `SELECT COUNT(*) AS n FROM vaccinations x JOIN pets p ON p.id = x.pet_id
       WHERE x.done_followup = 0 AND p.deceased = 0 AND x.next_due_date <= date('now','localtime','+7 days')`
    )!.n
    const lowStock = one<{ n: number }>(
      'SELECT COUNT(*) AS n FROM products WHERE active = 1 AND track_stock = 1 AND stock_qty <= min_stock'
    )!.n
    const recent = all(
      `SELECT i.id, i.invoice_no, i.total, i.status, i.issued_at, c.name AS customer_name, p.name AS pet_name
       FROM invoices i LEFT JOIN customers c ON c.id = i.customer_id LEFT JOIN pets p ON p.id = i.pet_id
       ORDER BY i.issued_at DESC LIMIT 8`
    )
    const last7 = all<{ day: string; total: number }>(
      `WITH RECURSIVE days(day) AS (SELECT date('now','localtime','-6 days') UNION ALL SELECT date(day,'+1 day') FROM days WHERE day < date('now','localtime'))
       SELECT days.day, COALESCE((SELECT SUM(total) FROM invoices WHERE date(issued_at) = days.day AND status <> 'void'),0) AS total
       FROM days ORDER BY days.day`
    )
    const queueWaiting = one<{ n: number }>(
      "SELECT COUNT(*) AS n FROM queue WHERE queue_date = ? AND status IN ('waiting','in_exam','to_pay')",
      d
    )!.n
    const apptToday = one<{ n: number }>("SELECT COUNT(*) AS n FROM appointments WHERE appt_date = ? AND status = 'pending'", d)!.n
    const apptUncalled = one<{ n: number }>(
      "SELECT COUNT(*) AS n FROM appointments WHERE status = 'pending' AND called_at IS NULL AND appt_date BETWEEN ? AND date(?, '+2 days')",
      d,
      d
    )!.n
    const admitted = one<{ n: number }>("SELECT COUNT(*) AS n FROM admissions WHERE status = 'admitted'")!.n
    return {
      date: d,
      last7,
      appt_today: apptToday,
      appt_uncalled: apptUncalled,
      admitted,
      queue_waiting: queueWaiting,
      bills: sales.bills,
      sales_total: r2(sales.total),
      unpaid_today: r2(sales.unpaid),
      received: Object.fromEntries(received.map((r) => [r.method, r2(r.amount)])),
      outstanding_count: outstanding.n,
      outstanding_amount: r2(outstanding.amount),
      month_total: r2(month.total),
      month_bills: month.bills,
      visits_today: visitsToday,
      vaccines_due: dueSoon,
      low_stock: lowStock,
      recent
    }
  },

  'reports.sales': (a: { from: string; to: string }) => {
    requirePerm('reports')
    const range = [a.from, a.to]
    const summary = one<any>(
      `SELECT COUNT(*) AS bills, COALESCE(SUM(subtotal),0) AS gross,
              COALESCE(SUM(line_discount + bill_discount),0) AS discount,
              COALESCE(SUM(vat_amount),0) AS vat, COALESCE(SUM(total),0) AS total,
              COALESCE(SUM(cost_total),0) AS cost, COALESCE(SUM(total - paid_amount),0) AS unpaid
       FROM invoices WHERE date(issued_at) BETWEEN ? AND ? AND status <> 'void'`,
      ...range
    )
    const voids = one<any>(
      `SELECT COUNT(*) AS n, COALESCE(SUM(total),0) AS total FROM invoices
       WHERE date(issued_at) BETWEEN ? AND ? AND status = 'void'`,
      ...range
    )
    const byDay = all(
      `SELECT date(issued_at) AS day, COUNT(*) AS bills, SUM(total) AS total, SUM(cost_total) AS cost
       FROM invoices WHERE date(issued_at) BETWEEN ? AND ? AND status <> 'void'
       GROUP BY day ORDER BY day`,
      ...range
    )
    const byCategory = all<any>(
      `SELECT it.category, SUM(it.qty) AS qty, SUM(${NET_LINE}) AS net, SUM(it.qty * it.unit_cost) AS cost
       FROM invoice_items it JOIN invoices i ON i.id = it.invoice_id
       WHERE date(i.issued_at) BETWEEN ? AND ? AND i.status <> 'void'
       GROUP BY it.category ORDER BY net DESC`,
      ...range
    ).map((r) => ({ ...r, label: CATEGORY_LABEL[r.category] ?? r.category }))
    const byMethod = all(
      `SELECT method, SUM(CASE WHEN kind = 'refund' THEN -amount ELSE amount END) AS amount
       FROM payments WHERE date(paid_at) BETWEEN ? AND ? GROUP BY method`,
      ...range
    )
    const byVet = all(
      `SELECT COALESCE(u.display_name, '(ไม่ระบุ)') AS vet_name, it.vet_id, COUNT(DISTINCT i.id) AS cases,
              SUM(${NET_LINE}) AS net
       FROM invoice_items it JOIN invoices i ON i.id = it.invoice_id LEFT JOIN users u ON u.id = it.vet_id
       WHERE date(i.issued_at) BETWEEN ? AND ? AND i.status <> 'void' AND it.category IN ('service','procedure','vaccine')
       GROUP BY it.vet_id ORDER BY net DESC`,
      ...range
    )
    const topItems = all(
      `SELECT it.name, it.category, SUM(it.qty) AS qty, SUM(${NET_LINE}) AS net,
              SUM(${NET_LINE}) - SUM(it.qty * it.unit_cost) AS profit
       FROM invoice_items it JOIN invoices i ON i.id = it.invoice_id
       WHERE date(i.issued_at) BETWEEN ? AND ? AND i.status <> 'void'
       GROUP BY it.product_id, it.name ORDER BY net DESC LIMIT 20`,
      ...range
    )
    const netSales = r2(summary.total - summary.vat)
    return {
      ...summary,
      net_sales: netSales,
      gross_profit: r2(netSales - summary.cost),
      void_count: voids.n,
      void_total: r2(voids.total),
      by_day: byDay,
      by_category: byCategory,
      by_method: byMethod,
      by_vet: byVet,
      top_items: topItems
    }
  },

  /** ข.ย.11-style register of controlled drugs dispensed (sales and Admit charges). */
  'reports.controlled': (a: { from: string; to: string }) => {
    requirePerm('reports')
    return all(
      `SELECT x.* FROM (
         SELECT date(i.issued_at) AS day, i.invoice_no AS ref, it.name, it.qty, it.unit, c.name AS owner_name, c.address,
                p.name AS pet_name, p.species, u.display_name AS vet_name
         FROM invoice_items it JOIN invoices i ON i.id = it.invoice_id JOIN products pr ON pr.id = it.product_id
         LEFT JOIN customers c ON c.id = i.customer_id LEFT JOIN pets p ON p.id = i.pet_id LEFT JOIN users u ON u.id = it.vet_id
         WHERE pr.controlled = 1 AND i.status <> 'void' AND it.from_admission = 0 AND date(i.issued_at) BETWEEN ?1 AND ?2
         UNION ALL
         SELECT ch.charge_date, ad.admit_no, ch.name, ch.qty, ch.unit, c.name, c.address, p.name, p.species, u.display_name
         FROM admission_charges ch JOIN admissions ad ON ad.id = ch.admission_id JOIN products pr ON pr.id = ch.product_id
         JOIN customers c ON c.id = ad.customer_id JOIN pets p ON p.id = ad.pet_id LEFT JOIN users u ON u.id = ch.vet_id
         WHERE pr.controlled = 1 AND ch.voided = 0 AND ch.charge_date BETWEEN ?1 AND ?2
       ) x ORDER BY x.day, x.ref`,
      a.from,
      a.to
    )
  },

  /** Rabies vaccinations in the period, for the Department of Livestock Development report. */
  'reports.rabies': (a: { from: string; to: string }) => {
    requirePerm('reports')
    return all(
      `SELECT x.given_date, x.lot_no, p.name AS pet_name, p.code AS pet_code, p.species, p.breed, p.sex, p.color, p.birth_date,
              c.name AS owner_name, c.address, c.province, c.phone, u.display_name AS vet_name, u.license_no
       FROM vaccinations x JOIN pets p ON p.id = x.pet_id JOIN customers c ON c.id = p.customer_id
       LEFT JOIN users u ON u.id = x.vet_id
       WHERE x.name LIKE '%พิษสุนัขบ้า%' AND x.given_date BETWEEN ? AND ? ORDER BY x.given_date`,
      a.from,
      a.to
    )
  },

  'reports.stock': () => {
    requirePerm('reports')
    return all(
      `SELECT sku, name, category, unit, stock_qty, min_stock, avg_cost, price, stock_qty * avg_cost AS value, controlled
       FROM products WHERE active = 1 AND track_stock = 1 ORDER BY category, name`
    )
  },

  'reports.audit': (a: { from: string; to: string; action?: string }) => {
    requirePerm('void')
    return all(
      `SELECT l.*, u.display_name AS user_name FROM audit_log l LEFT JOIN users u ON u.id = l.user_id
       WHERE date(l.created_at) BETWEEN ? AND ? AND (? = '' OR l.action LIKE ? || '%')
       ORDER BY l.id DESC LIMIT 1000`,
      a.from,
      a.to,
      a.action ?? '',
      a.action ?? ''
    )
  }
}
