import{all as e,one as t,r2 as n,today as r}from"./db-9iH4_0Rw.js";import{requirePerm as i,requireUser as a}from"./auth-BJseqalg.js";var o={service:`ค่าบริการ/ค่าตรวจ`,procedure:`หัตถการ`,vaccine:`วัคซีน`,medicine:`ยา`,food:`อาหาร`,supply:`เวชภัณฑ์/อุปกรณ์`,grooming:`อาบน้ำตัดขน`,boarding:`ฝากเลี้ยง/ค่าห้อง`,other:`อื่น ๆ`},s=`(it.line_total - CASE WHEN (i.subtotal - i.line_discount) > 0
    THEN i.bill_discount * it.line_total / (i.subtotal - i.line_discount) ELSE 0 END)`;function c(e,r){let i=t(`SELECT COUNT(*) AS bills, COALESCE(SUM(total),0) AS sales, COALESCE(SUM(total - vat_amount),0) AS net,
            COALESCE(SUM(cost_total),0) AS cost, COALESCE(SUM(line_discount + bill_discount),0) AS discount,
            COUNT(DISTINCT customer_id) AS customers, COALESCE(SUM(total - paid_amount),0) AS unpaid
     FROM invoices WHERE date(issued_at) BETWEEN ? AND ? AND status <> 'void'`,e,r),a=t(`SELECT COUNT(*) AS n FROM customers WHERE date(created_at) BETWEEN ? AND ?`,e,r).n,o=t(`SELECT COUNT(*) AS n FROM pets WHERE date(created_at) BETWEEN ? AND ?`,e,r).n,s=t(`SELECT COUNT(*) AS n FROM visits WHERE visit_date BETWEEN ? AND ?`,e,r).n,c=t(`SELECT COUNT(*) AS n FROM admissions WHERE date(admitted_at) BETWEEN ? AND ? AND status <> 'cancelled'`,e,r).n,l=t(`SELECT COUNT(*) AS n FROM vaccinations WHERE given_date BETWEEN ? AND ?`,e,r).n,u=t(`SELECT COUNT(*) AS n, COALESCE(SUM(total),0) AS total FROM invoices WHERE date(issued_at) BETWEEN ? AND ? AND status = 'void'`,e,r);return{from:e,to:r,bills:i.bills,sales:n(i.sales),gross_profit:n(i.net-i.cost),margin:i.net>0?Math.round((i.net-i.cost)/i.net*1e3)/10:0,avg_bill:i.bills?n(i.sales/i.bills):0,discount:n(i.discount),customers:i.customers,unpaid:n(i.unpaid),new_customers:a,new_pets:o,visits:s,admits:c,vaccines:l,void_count:u.n,void_total:n(u.total)}}var l=e=>`${e.getFullYear()}-${String(e.getMonth()+1).padStart(2,`0`)}-${String(e.getDate()).padStart(2,`0`)}`,u=(e,t)=>{let n=new Date(e+`T00:00:00`);return n.setDate(n.getDate()+t),l(n)},d=(e,t=0)=>{let[n,r]=e.split(`-`).map(Number),i=new Date(n,r-1+t,1),a=new Date(n,r+t,0);return[l(i),l(a)]},f={"reports.executive":n=>{i(`reports`);let a=n.date||r(),l=n.month||a.slice(0,7),[f,p]=d(l),[m,h]=d(l,-1),[g,_]=d(l,-12),v=e(`SELECT strftime('%H', issued_at) AS h, SUM(total) AS sales, COUNT(*) AS bills FROM invoices
       WHERE date(issued_at) = ? AND status <> 'void' GROUP BY h ORDER BY h`,a),y=(t,n)=>e(`WITH RECURSIVE days(day) AS (SELECT ? UNION ALL SELECT date(day, '+1 day') FROM days WHERE day < ?)
         SELECT days.day,
           COALESCE((SELECT SUM(total) FROM invoices WHERE date(issued_at) = days.day AND status <> 'void'), 0) AS sales,
           COALESCE((SELECT SUM(total - vat_amount - cost_total) FROM invoices WHERE date(issued_at) = days.day AND status <> 'void'), 0) AS profit,
           (SELECT COUNT(*) FROM invoices WHERE date(issued_at) = days.day AND status <> 'void') AS bills
         FROM days ORDER BY days.day`,t,n),b=Array.from({length:12},(e,t)=>{let[n,r]=d(l,t-11),i=c(n,r);return{month:n.slice(0,7),sales:i.sales,gross_profit:i.gross_profit,bills:i.bills,new_customers:i.new_customers,visits:i.visits,avg_bill:i.avg_bill}}),x=e(`SELECT it.category, SUM(${s}) AS net, SUM(${s}) - SUM(it.qty * it.unit_cost) AS profit
       FROM invoice_items it JOIN invoices i ON i.id = it.invoice_id
       WHERE date(i.issued_at) BETWEEN ? AND ? AND i.status <> 'void' GROUP BY it.category ORDER BY net DESC`,f,p).map(e=>({...e,label:o[e.category]??e.category})),S=e(`SELECT method, SUM(CASE WHEN kind = 'refund' THEN -amount ELSE amount END) AS amount
       FROM payments WHERE date(paid_at) BETWEEN ? AND ? AND method <> 'deposit' GROUP BY method`,f,p),C=e(`SELECT c.name, COUNT(*) AS bills, SUM(i.total) AS sales FROM invoices i JOIN customers c ON c.id = i.customer_id
       WHERE date(i.issued_at) BETWEEN ? AND ? AND i.status <> 'void' GROUP BY c.id ORDER BY sales DESC LIMIT 5`,f,p);return{date:a,month:l,day:c(a,a),yesterday:c(u(a,-1),u(a,-1)),last_week_day:c(u(a,-7),u(a,-7)),hourly:v,this_month:{...c(f,p>r()&&l===r().slice(0,7)?r():p)},prev_month:c(m,h),last_year_month:c(g,_),month_daily:y(f,p),prev_month_daily:y(m,h),trend:b,categories:x,methods:S,top_customers:C,outstanding:t(`SELECT COUNT(*) AS n, COALESCE(SUM(total - paid_amount),0) AS amount FROM invoices WHERE status IN ('unpaid','partial')`),admitted_now:t(`SELECT COUNT(*) AS n FROM admissions WHERE status = 'admitted'`).n}},"reports.dashboard":()=>{a();let i=r(),o=t(`SELECT COUNT(*) AS bills, COALESCE(SUM(total),0) AS total, COALESCE(SUM(total - paid_amount),0) AS unpaid
       FROM invoices WHERE date(issued_at) = ? AND status <> 'void'`,i),s=e(`SELECT method, SUM(CASE WHEN kind = 'refund' THEN -amount ELSE amount END) AS amount
       FROM payments WHERE date(paid_at) = ? GROUP BY method`,i),c=t(`SELECT COUNT(*) AS n, COALESCE(SUM(total - paid_amount),0) AS amount
       FROM invoices WHERE status IN ('unpaid','partial')`),l=t(`SELECT COALESCE(SUM(total),0) AS total, COUNT(*) AS bills FROM invoices
       WHERE strftime('%Y-%m', issued_at) = strftime('%Y-%m', 'now', 'localtime') AND status <> 'void'`),u=t(`SELECT COUNT(*) AS n FROM visits WHERE visit_date = ?`,i).n,d=t(`SELECT COUNT(*) AS n FROM vaccinations x JOIN pets p ON p.id = x.pet_id
       WHERE x.done_followup = 0 AND p.deceased = 0 AND x.next_due_date <= date('now','localtime','+7 days')`).n,f=t(`SELECT COUNT(*) AS n FROM products WHERE active = 1 AND track_stock = 1 AND stock_qty <= min_stock`).n,p=e(`SELECT i.id, i.invoice_no, i.total, i.status, i.issued_at, c.name AS customer_name, p.name AS pet_name
       FROM invoices i LEFT JOIN customers c ON c.id = i.customer_id LEFT JOIN pets p ON p.id = i.pet_id
       ORDER BY i.issued_at DESC LIMIT 8`),m=e(`WITH RECURSIVE days(day) AS (SELECT date('now','localtime','-6 days') UNION ALL SELECT date(day,'+1 day') FROM days WHERE day < date('now','localtime'))
       SELECT days.day, COALESCE((SELECT SUM(total) FROM invoices WHERE date(issued_at) = days.day AND status <> 'void'),0) AS total
       FROM days ORDER BY days.day`),h=t(`SELECT COUNT(*) AS n FROM queue WHERE queue_date = ? AND status IN ('waiting','in_exam','to_pay')`,i).n,g=t(`SELECT COUNT(*) AS n FROM queue WHERE queue_date = ? AND status IN ('waiting','in_exam')`,i).n,_=t(`SELECT COUNT(*) AS n FROM queue WHERE queue_date = ? AND status = 'to_pay'`,i).n;return{date:i,last7:m,appt_today:t(`SELECT COUNT(*) AS n FROM appointments WHERE appt_date = ? AND status = 'pending'`,i).n,appt_uncalled:t(`SELECT COUNT(*) AS n FROM appointments WHERE status = 'pending' AND called_at IS NULL AND appt_date BETWEEN ? AND date(?, '+2 days')`,i,i).n,admitted:t(`SELECT COUNT(*) AS n FROM admissions WHERE status = 'admitted'`).n,queue_waiting:h,queue_to_exam:g,queue_to_pay:_,bills:o.bills,sales_total:n(o.total),unpaid_today:n(o.unpaid),received:Object.fromEntries(s.map(e=>[e.method,n(e.amount)])),outstanding_count:c.n,outstanding_amount:n(c.amount),month_total:n(l.total),month_bills:l.bills,visits_today:u,vaccines_due:d,low_stock:f,recent:p}},"reports.sales":r=>{i(`reports`);let a=[r.from,r.to],c=t(`SELECT COUNT(*) AS bills, COALESCE(SUM(subtotal),0) AS gross,
              COALESCE(SUM(line_discount + bill_discount),0) AS discount,
              COALESCE(SUM(vat_amount),0) AS vat, COALESCE(SUM(total),0) AS total,
              COALESCE(SUM(cost_total),0) AS cost, COALESCE(SUM(total - paid_amount),0) AS unpaid
       FROM invoices WHERE date(issued_at) BETWEEN ? AND ? AND status <> 'void'`,...a),l=t(`SELECT COUNT(*) AS n, COALESCE(SUM(total),0) AS total FROM invoices
       WHERE date(issued_at) BETWEEN ? AND ? AND status = 'void'`,...a),u=e(`SELECT date(issued_at) AS day, COUNT(*) AS bills, SUM(total) AS total, SUM(cost_total) AS cost
       FROM invoices WHERE date(issued_at) BETWEEN ? AND ? AND status <> 'void'
       GROUP BY day ORDER BY day`,...a),d=e(`SELECT it.category, SUM(it.qty) AS qty, SUM(${s}) AS net, SUM(it.qty * it.unit_cost) AS cost
       FROM invoice_items it JOIN invoices i ON i.id = it.invoice_id
       WHERE date(i.issued_at) BETWEEN ? AND ? AND i.status <> 'void'
       GROUP BY it.category ORDER BY net DESC`,...a).map(e=>({...e,label:o[e.category]??e.category})),f=e(`SELECT method, SUM(CASE WHEN kind = 'refund' THEN -amount ELSE amount END) AS amount
       FROM payments WHERE date(paid_at) BETWEEN ? AND ? GROUP BY method`,...a),p=e(`SELECT COALESCE(u.display_name, '(ไม่ระบุ)') AS vet_name, it.vet_id, COUNT(DISTINCT i.id) AS cases,
              SUM(${s}) AS net
       FROM invoice_items it JOIN invoices i ON i.id = it.invoice_id LEFT JOIN users u ON u.id = it.vet_id
       WHERE date(i.issued_at) BETWEEN ? AND ? AND i.status <> 'void' AND it.category IN ('service','procedure','vaccine')
       GROUP BY it.vet_id ORDER BY net DESC`,...a),m=e(`SELECT it.name, it.category, SUM(it.qty) AS qty, SUM(${s}) AS net,
              SUM(${s}) - SUM(it.qty * it.unit_cost) AS profit
       FROM invoice_items it JOIN invoices i ON i.id = it.invoice_id
       WHERE date(i.issued_at) BETWEEN ? AND ? AND i.status <> 'void'
       GROUP BY it.product_id, it.name ORDER BY net DESC LIMIT 20`,...a),h=n(c.total-c.vat);return{...c,net_sales:h,gross_profit:n(h-c.cost),void_count:l.n,void_total:n(l.total),by_day:u,by_category:d,by_method:f,by_vet:p,top_items:m}},"reports.controlled":t=>(i(`reports`),e(`SELECT x.* FROM (
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
       ) x ORDER BY x.day, x.ref`,t.from,t.to)),"reports.rabies":t=>(i(`reports`),e(`SELECT x.given_date, x.lot_no, p.name AS pet_name, p.code AS pet_code, p.species, p.breed, p.sex, p.color, p.birth_date,
              c.name AS owner_name, c.address, c.province, c.phone, u.display_name AS vet_name, u.license_no
       FROM vaccinations x JOIN pets p ON p.id = x.pet_id JOIN customers c ON c.id = p.customer_id
       LEFT JOIN users u ON u.id = x.vet_id
       WHERE x.name LIKE '%พิษสุนัขบ้า%' AND x.given_date BETWEEN ? AND ? ORDER BY x.given_date`,t.from,t.to)),"reports.stock":()=>(i(`reports`),e(`SELECT sku, name, category, unit, stock_qty, min_stock, avg_cost, price, stock_qty * avg_cost AS value, controlled
       FROM products WHERE active = 1 AND track_stock = 1 ORDER BY category, name`)),"reports.audit":t=>(i(`void`),e(`SELECT l.*, u.display_name AS user_name FROM audit_log l LEFT JOIN users u ON u.id = l.user_id
       WHERE date(l.created_at) BETWEEN ? AND ? AND (? = '' OR l.action LIKE ? || '%')
       ORDER BY l.id DESC LIMIT 1000`,t.from,t.to,t.action??``,t.action??``))};export{f as reportsApi};