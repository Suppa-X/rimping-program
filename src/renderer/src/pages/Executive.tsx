import { useState } from 'react'
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Minus, Lightbulb, Receipt, Users, Stethoscope, Wallet, BedDouble, Syringe, Table2, LineChart } from 'lucide-react'
import { money, thDate, todayStr, addDays, addMonths, METHOD_LABEL } from '../api'
import { useApi } from '../ui'
import { BarChart, LineCompare, Spark } from '../charts'

const TH_MONTH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
const monthLabel = (ym: string, long = false): string => {
  const [y, m] = ym.split('-').map(Number)
  return long ? `${['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'][m - 1]} ${y + 543}` : `${TH_MONTH[m - 1]} ${String(y + 543).slice(2)}`
}
const pct = (now: number, before: number): number | null => (before > 0 ? Math.round(((now - before) / before) * 1000) / 10 : now > 0 ? null : 0)

function Delta({ now, before, label }: { now: number; before: number; label: string }) {
  const p = pct(now, before)
  if (p === null) return <div className="tiny muted">{label}: ใหม่ (ก่อนหน้าเป็น 0)</div>
  const Icon = p > 0 ? TrendingUp : p < 0 ? TrendingDown : Minus
  const color = p > 0 ? 'var(--ok)' : p < 0 ? 'var(--bad)' : 'var(--muted)'
  return (
    <div className="tiny" style={{ color, display: 'flex', alignItems: 'center', gap: 4 }}>
      <Icon size={14} /> {p > 0 ? '+' : ''}{p}% <span className="muted">{label}</span>
    </div>
  )
}

function Kpi(props: { icon: any; label: string; value: string; now: number; a: number; aLabel: string; b?: number; bLabel?: string; spark?: number[]; tone?: string }) {
  return (
    <div className="stat" style={{ alignItems: 'flex-start' }}>
      <div className={`ico ${props.tone ?? ''}`}><props.icon /></div>
      <div className="grow">
        <div className="label">{props.label}</div>
        <div className="value">{props.value}</div>
        <Delta now={props.now} before={props.a} label={props.aLabel} />
        {props.b !== undefined && <Delta now={props.now} before={props.b} label={props.bLabel!} />}
      </div>
      {props.spark && <Spark values={props.spark} />}
    </div>
  )
}

function insights(d: any, mode: 'day' | 'month'): string[] {
  const out: string[] = []
  if (mode === 'day') {
    const p = pct(d.day.sales, d.yesterday.sales)
    if (p !== null && Math.abs(p) >= 5) out.push(`ยอดขายวันนี้${p > 0 ? 'สูงกว่า' : 'ต่ำกว่า'}เมื่อวาน ${Math.abs(p)}% (${money(d.day.sales)} เทียบกับ ${money(d.yesterday.sales)} บาท)`)
    const w = pct(d.day.sales, d.last_week_day.sales)
    if (w !== null && Math.abs(w) >= 5) out.push(`เทียบกับวันเดียวกันสัปดาห์ก่อน ${w > 0 ? 'เพิ่มขึ้น' : 'ลดลง'} ${Math.abs(w)}%`)
    const peak = [...d.hourly].sort((a: any, b: any) => b.sales - a.sales)[0]
    if (peak) out.push(`ช่วงเวลาขายดีที่สุดวันนี้คือ ${peak.h}:00–${String(Number(peak.h) + 1).padStart(2, '0')}:00 น. (${peak.bills} บิล)`)
    if (d.day.new_customers) out.push(`มีลูกค้าใหม่ ${d.day.new_customers} ราย สัตว์ใหม่ ${d.day.new_pets} ตัว`)
    if (d.day.void_count) out.push(`⚠️ มีการยกเลิกบิล ${d.day.void_count} ใบ รวม ${money(d.day.void_total)} บาท — ตรวจสอบได้ที่ ตั้งค่า → ประวัติการใช้งาน`)
  } else {
    const m = d.this_month
    const p = pct(m.sales, d.prev_month.sales)
    if (p !== null) out.push(`ยอดขาย${monthLabel(d.month, true)} ${money(m.sales)} บาท ${p >= 0 ? 'เพิ่มขึ้น' : 'ลดลง'} ${Math.abs(p)}% จากเดือนก่อน`)
    const y = pct(m.sales, d.last_year_month.sales)
    if (y !== null && d.last_year_month.sales > 0) out.push(`เทียบกับเดือนเดียวกันปีที่แล้ว ${y >= 0 ? 'เติบโต' : 'ลดลง'} ${Math.abs(y)}%`)
    out.push(`กำไรขั้นต้น ${money(m.gross_profit)} บาท (อัตรากำไร ${m.margin}%) · เฉลี่ย ${money(m.avg_bill)} บาท/บิล`)
    if (d.categories[0]) out.push(`รายได้หลักมาจาก "${d.categories[0].label}" ${Math.round((d.categories[0].net / Math.max(m.sales, 1)) * 100)}% ของยอดขาย`)
    if (m.new_customers) out.push(`ลูกค้าใหม่ ${m.new_customers} ราย · ลูกค้าที่มาใช้บริการ ${m.customers} ราย`)
    if (d.outstanding.amount > 0) out.push(`ยอดค้างชำระสะสมทั้งร้าน ${money(d.outstanding.amount)} บาท (${d.outstanding.n} บิล) — ควรติดตาม`)
    if (m.discount > 0) out.push(`ให้ส่วนลดรวม ${money(m.discount)} บาท (${Math.round((m.discount / Math.max(m.sales + m.discount, 1)) * 1000) / 10}% ของยอดก่อนลด)`)
  }
  return out
}

export default function Executive() {
  const [mode, setMode] = useState<'day' | 'month' | 'trend'>('day')
  const [date, setDate] = useState(todayStr())
  const [month, setMonth] = useState(todayStr().slice(0, 7))
  const [showTable, setShowTable] = useState(false)
  const [d] = useApi<any>('reports.executive', { date, month: mode === 'day' ? date.slice(0, 7) : month }, [date, month, mode])

  return (
    <>
      <div className="page-head">
        <div className="grow">
          <h1 className="title-ico"><span className="gem gold"><LineChart /></span> สรุปผู้บริหาร</h1>
          <div className="lead">ผลการดำเนินงานรายวัน รายเดือน และแนวโน้ม 12 เดือน พร้อมเปรียบเทียบอัตโนมัติ</div>
        </div>
      </div>
      <div className="row" style={{ marginBottom: 16 }}>
        <div className="subtabs" style={{ margin: 0 }}>
          <button className={mode === 'day' ? 'active' : ''} onClick={() => setMode('day')}>รายวัน</button>
          <button className={mode === 'month' ? 'active' : ''} onClick={() => setMode('month')}>รายเดือน</button>
          <button className={mode === 'trend' ? 'active' : ''} onClick={() => setMode('trend')}>แนวโน้ม 12 เดือน</button>
        </div>
        <div className="grow" />
        {mode === 'day' ? (
          <div className="row" style={{ gap: 6 }}>
            <button className="secondary" aria-label="วันก่อน" onClick={() => setDate(addDays(date, -1))}><ChevronLeft /></button>
            <input type="date" style={{ width: 170 }} value={date} max={todayStr()} onChange={(e) => e.target.value && setDate(e.target.value)} />
            <button className="secondary" aria-label="วันถัดไป" disabled={date >= todayStr()} onClick={() => setDate(addDays(date, 1))}><ChevronRight /></button>
            <span className="muted">{thDate(date)}</span>
          </div>
        ) : (
          <div className="row" style={{ gap: 6 }}>
            <button className="secondary" aria-label="เดือนก่อน" onClick={() => setMonth(addMonths(month + '-01', -1).slice(0, 7))}><ChevronLeft /></button>
            <b style={{ minWidth: 130, textAlign: 'center' }}>{mode === 'trend' ? `ถึง ${monthLabel(month, true)}` : monthLabel(month, true)}</b>
            <button className="secondary" aria-label="เดือนถัดไป" disabled={month >= todayStr().slice(0, 7)} onClick={() => setMonth(addMonths(month + '-01', 1).slice(0, 7))}><ChevronRight /></button>
          </div>
        )}
      </div>

      {d && mode !== 'trend' && (
        <div className="card" style={{ marginBottom: 16, background: '#fffaf3', borderColor: '#f6dcbc' }}>
          <h2 style={{ marginBottom: 8 }}><Lightbulb size={20} color="var(--orange)" style={{ verticalAlign: -3 }} /> สรุปสั้น ๆ</h2>
          <ul style={{ margin: 0, paddingLeft: 22, lineHeight: 1.8 }}>
            {insights(d, mode).map((t, i) => <li key={i}>{t}</li>)}
            {insights(d, mode).length === 0 && <li className="muted">ยังไม่มีข้อมูลเพียงพอสำหรับสรุป</li>}
          </ul>
        </div>
      )}

      {d && mode === 'day' && (
        <>
          <div className="grid g3">
            <Kpi icon={Wallet} tone="ok" label="ยอดขาย" value={`${money(d.day.sales)} ฿`} now={d.day.sales} a={d.yesterday.sales} aLabel="จากเมื่อวาน" b={d.last_week_day.sales} bLabel="จากสัปดาห์ก่อน" />
            <Kpi icon={TrendingUp} label="กำไรขั้นต้น" value={`${money(d.day.gross_profit)} ฿`} now={d.day.gross_profit} a={d.yesterday.gross_profit} aLabel="จากเมื่อวาน" />
            <Kpi icon={Receipt} label="จำนวนบิล / เฉลี่ยต่อบิล" value={`${d.day.bills} บิล · ${money(d.day.avg_bill)}`} now={d.day.bills} a={d.yesterday.bills} aLabel="จำนวนบิลจากเมื่อวาน" />
            <Kpi icon={Stethoscope} tone="purple" label="ตรวจรักษา" value={`${d.day.visits} เคส`} now={d.day.visits} a={d.yesterday.visits} aLabel="จากเมื่อวาน" />
            <Kpi icon={Users} label="ลูกค้าใหม่ / สัตว์ใหม่" value={`${d.day.new_customers} / ${d.day.new_pets}`} now={d.day.new_customers} a={d.yesterday.new_customers} aLabel="จากเมื่อวาน" />
            <Kpi icon={Syringe} tone="warn" label="วัคซีน / Admit ใหม่" value={`${d.day.vaccines} / ${d.day.admits}`} now={d.day.vaccines} a={d.yesterday.vaccines} aLabel="วัคซีนจากเมื่อวาน" />
          </div>
          <div className="card" style={{ marginTop: 16 }}>
            <h2 style={{ marginBottom: 4 }}>ยอดขายรายชั่วโมง — {thDate(date)}</h2>
            <div className="muted small" style={{ marginBottom: 8 }}>ใช้ดูว่าช่วงไหนลูกค้าเยอะ เพื่อจัดคนให้พอ</div>
            <BarChart
              barLabel="ยอดขาย (บาท)"
              data={Array.from({ length: 13 }, (_, i) => {
                const h = String(i + 8).padStart(2, '0')
                const r = d.hourly.find((x: any) => x.h === h)
                return { label: `${h}:00`, value: r?.sales ?? 0, tip: [`${h}:00–${h}:59`, `${money(r?.sales ?? 0)} บาท`, `${r?.bills ?? 0} บิล`] }
              })}
            />
          </div>
        </>
      )}

      {d && mode === 'month' && (
        <>
          <div className="grid g3">
            <Kpi icon={Wallet} tone="ok" label="ยอดขายเดือนนี้" value={`${money(d.this_month.sales)} ฿`} now={d.this_month.sales} a={d.prev_month.sales} aLabel="จากเดือนก่อน" b={d.last_year_month.sales} bLabel="จากปีที่แล้ว" spark={d.trend.map((t: any) => t.sales)} />
            <Kpi icon={TrendingUp} label={`กำไรขั้นต้น (${d.this_month.margin}%)`} value={`${money(d.this_month.gross_profit)} ฿`} now={d.this_month.gross_profit} a={d.prev_month.gross_profit} aLabel="จากเดือนก่อน" spark={d.trend.map((t: any) => t.gross_profit)} />
            <Kpi icon={Receipt} label="บิล / เฉลี่ยต่อบิล" value={`${d.this_month.bills} · ${money(d.this_month.avg_bill)}`} now={d.this_month.avg_bill} a={d.prev_month.avg_bill} aLabel="ค่าเฉลี่ยต่อบิล จากเดือนก่อน" spark={d.trend.map((t: any) => t.bills)} />
            <Kpi icon={Users} label="ลูกค้าใหม่ / ลูกค้าที่มา" value={`${d.this_month.new_customers} / ${d.this_month.customers}`} now={d.this_month.new_customers} a={d.prev_month.new_customers} aLabel="ลูกค้าใหม่จากเดือนก่อน" spark={d.trend.map((t: any) => t.new_customers)} />
            <Kpi icon={Stethoscope} tone="purple" label="ตรวจรักษา" value={`${d.this_month.visits} เคส`} now={d.this_month.visits} a={d.prev_month.visits} aLabel="จากเดือนก่อน" spark={d.trend.map((t: any) => t.visits)} />
            <Kpi icon={BedDouble} tone="warn" label="Admit ใหม่ / กำลัง Admit" value={`${d.this_month.admits} / ${d.admitted_now}`} now={d.this_month.admits} a={d.prev_month.admits} aLabel="จากเดือนก่อน" />
          </div>
          <div className="card" style={{ marginTop: 16 }}>
            <h2 style={{ marginBottom: 8 }}>ยอดขายรายวัน: เดือนนี้ เทียบ เดือนก่อน</h2>
            <LineCompare
              a={d.month_daily.map((x: any) => x.sales)}
              b={d.prev_month_daily.map((x: any) => x.sales)}
              aLabel={monthLabel(d.month)}
              bLabel={monthLabel(addMonths(d.month + '-01', -1).slice(0, 7))}
              xLabels={Array.from({ length: Math.max(d.month_daily.length, d.prev_month_daily.length) }, (_, i) => String(i + 1))}
            />
          </div>
          <div className="grid g2" style={{ marginTop: 16 }}>
            <div className="card">
              <h2 style={{ marginBottom: 10 }}>รายได้แยกหมวด</h2>
              <table>
                <tbody>
                  {d.categories.map((c: any) => (
                    <tr key={c.category}>
                      <td>{c.label}</td>
                      <td style={{ width: '38%' }}><div className="bar"><div style={{ width: `${(c.net / Math.max(d.categories[0].net, 1)) * 100}%` }} /></div></td>
                      <td className="num">{money(c.net)}</td>
                      <td className="num muted small">{Math.round((c.net / Math.max(d.this_month.sales, 1)) * 100)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="card">
              <h2 style={{ marginBottom: 10 }}>ลูกค้าที่ใช้จ่ายสูงสุด</h2>
              <table>
                <tbody>
                  {d.top_customers.map((c: any, i: number) => (
                    <tr key={i}><td>{i + 1}. {c.name}</td><td className="num muted small">{c.bills} บิล</td><td className="num">{money(c.sales)}</td></tr>
                  ))}
                </tbody>
              </table>
              <h2 style={{ margin: '16px 0 10px' }}>รับเงินแยกช่องทาง</h2>
              <table>
                <tbody>
                  {d.methods.map((m: any) => <tr key={m.method}><td>{METHOD_LABEL[m.method]}</td><td className="num">{money(m.amount)}</td></tr>)}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {d && mode === 'trend' && (
        <>
          <div className="card">
            <div className="card-head">
              <h2 className="grow">ยอดขายและกำไรขั้นต้น 12 เดือน</h2>
              <button className="ghost" onClick={() => setShowTable((x) => !x)}><Table2 /> {showTable ? 'ซ่อนตาราง' : 'ดูเป็นตาราง'}</button>
            </div>
            <BarChart
              height={260}
              barLabel="ยอดขาย (บาท)"
              lineLabel="กำไรขั้นต้น (บาท)"
              highlight={11}
              data={d.trend.map((t: any) => ({ label: monthLabel(t.month), value: t.sales, tip: [monthLabel(t.month, true), `ยอดขาย ${money(t.sales)}`, `กำไร ${money(t.gross_profit)}`, `${t.bills} บิล`] }))}
              line={d.trend.map((t: any) => ({ value: t.gross_profit }))}
            />
            {showTable && (
              <table style={{ marginTop: 12 }}>
                <thead><tr><th>เดือน</th><th className="num">ยอดขาย</th><th className="num">กำไรขั้นต้น</th><th className="num">บิล</th><th className="num">เฉลี่ย/บิล</th><th className="num">ลูกค้าใหม่</th><th className="num">ตรวจรักษา</th></tr></thead>
                <tbody>
                  {d.trend.map((t: any) => (
                    <tr key={t.month}><td>{monthLabel(t.month, true)}</td><td className="num">{money(t.sales)}</td><td className="num">{money(t.gross_profit)}</td><td className="num">{t.bills}</td><td className="num">{money(t.avg_bill)}</td><td className="num">{t.new_customers}</td><td className="num">{t.visits}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div className="grid g2" style={{ marginTop: 16 }}>
            {[
              ['จำนวนบิลต่อเดือน', 'bills', ''],
              ['ค่าเฉลี่ยต่อบิล (บาท)', 'avg_bill', ''],
              ['ลูกค้าใหม่ต่อเดือน', 'new_customers', ''],
              ['เคสตรวจรักษาต่อเดือน', 'visits', '']
            ].map(([title, key]) => (
              <div key={key} className="card">
                <h2 style={{ marginBottom: 6 }}>{title}</h2>
                <BarChart height={170} highlight={11}
                  data={d.trend.map((t: any) => ({ label: monthLabel(t.month), value: t[key], tip: [monthLabel(t.month, true), `${title}: ${key === 'avg_bill' ? money(t[key]) : t[key]}`] }))} />
              </div>
            ))}
          </div>
        </>
      )}
    </>
  )
}
