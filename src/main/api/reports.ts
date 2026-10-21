import { all, one, r2, today } from '../db'
import { requirePerm, requireUser } from '../auth'

export const CATEGORY_LABEL: Record<string, string> = {
  service: 'ค่าบริการ/ค่าตรวจ',
  procedure: 'หัตถการ',
  vaccine: 'วัคซีน',
  medicine: 'ยา',
  food: 'อาหาร',
  supply: 'เวชภัณฑ์/อุปกรณ์',
  other: 'อื่น ๆ'
}

/** Net sales of a line after its share of the bill discount, excluding VAT added on top. */
const NET_LINE = `(it.line_total - CASE WHEN (i.subtotal - i.line_discount) > 0
    THEN i.bill_discount * it.line_total / (i.subtotal - i.line_discount) ELSE 0 END)`

export const reportsApi = {
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
    return {
      date: d,
      last7,
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
