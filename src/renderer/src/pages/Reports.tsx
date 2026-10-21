import { useState } from 'react'
import { money, thDate, todayStr, monthStart, METHOD_LABEL, CATEGORY_LABEL } from '../api'
import { useApi, Empty } from '../ui'

export default function Reports() {
  const [from, setFrom] = useState(monthStart())
  const [to, setTo] = useState(todayStr())
  const [r] = useApi<any>('reports.sales', { from, to }, [from, to])
  const maxDay = Math.max(1, ...(r?.by_day ?? []).map((d: any) => d.total))
  const maxCat = Math.max(1, ...(r?.by_category ?? []).map((c: any) => c.net))

  return (
    <>
      <div className="page-head">
        <h2 className="grow">สรุปช่วงวันที่</h2>
        <input type="date" style={{ width: 170 }} value={from} onChange={(e) => setFrom(e.target.value)} />
        <span>ถึง</span>
        <input type="date" style={{ width: 170 }} value={to} onChange={(e) => setTo(e.target.value)} />
      </div>
      {r && (
        <>
          <div className="grid g4">
            <div className="stat">
              <div className="label">ยอดขายสุทธิ</div>
              <div className="value">{money(r.total)}</div>
              <div className="sub">{r.bills} บิล · เฉลี่ย {money(r.bills ? r.total / r.bills : 0)}/บิล</div>
            </div>
            <div className="stat">
              <div className="label">ต้นทุนสินค้าที่ขาย</div>
              <div className="value">{money(r.cost)}</div>
              <div className="sub">คิดจากทุนเฉลี่ย ณ วันขาย</div>
            </div>
            <div className="stat">
              <div className="label">กำไรขั้นต้น</div>
              <div className="value" style={{ color: 'var(--ok)' }}>{money(r.gross_profit)}</div>
              <div className="sub">{r.net_sales ? ((r.gross_profit / r.net_sales) * 100).toFixed(1) : 0}% ของยอดขาย (ไม่รวม VAT)</div>
            </div>
            <div className={`stat ${r.unpaid > 0 ? 'bad' : ''}`}>
              <div className="label">ยังค้างชำระ (จากบิลช่วงนี้)</div>
              <div className="value">{money(r.unpaid)}</div>
              <div className="sub">
                ส่วนลดรวม {money(r.discount)} · ยกเลิก {r.void_count} บิล ({money(r.void_total)})
              </div>
            </div>
          </div>

          <div className="grid g2" style={{ marginTop: 16 }}>
            <div className="card">
              <h2 style={{ marginBottom: 10 }}>ยอดขายแยกหมวด</h2>
              {r.by_category.length === 0 ? (
                <Empty text="ไม่มีข้อมูล" />
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>หมวด</th>
                      <th style={{ width: '35%' }}></th>
                      <th className="num">ยอดขาย</th>
                      <th className="num">กำไรขั้นต้น</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.by_category.map((c: any) => (
                      <tr key={c.category}>
                        <td>{CATEGORY_LABEL[c.category] ?? c.category}</td>
                        <td><div className="bar"><div style={{ width: `${(c.net / maxCat) * 100}%` }} /></div></td>
                        <td className="num">{money(c.net)}</td>
                        <td className="num">{money(c.net - c.cost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="card">
              <h2 style={{ marginBottom: 10 }}>รับเงินแยกช่องทาง</h2>
              <table>
                <tbody>
                  {r.by_method.filter((m: any) => m.method !== 'deposit').map((m: any) => (
                    <tr key={m.method}>
                      <td>{METHOD_LABEL[m.method]}</td>
                      <td className="num">{money(m.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <h2 style={{ margin: '16px 0 10px' }}>ค่าบริการแยกตามสัตวแพทย์ (สำหรับ DF)</h2>
              {r.by_vet.length === 0 ? (
                <Empty text="ไม่มีข้อมูล" />
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>สัตวแพทย์</th>
                      <th className="num">จำนวนบิล</th>
                      <th className="num">ยอดค่าบริการ/หัตถการ/วัคซีน</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.by_vet.map((v: any) => (
                      <tr key={v.vet_id ?? 'none'}>
                        <td>{v.vet_name}</td>
                        <td className="num">{v.cases}</td>
                        <td className="num">{money(v.net)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <div className="muted small" style={{ marginTop: 6 }}>อัตรา DF จะเพิ่มในเฟส 2 หลังสรุปกับร้าน</div>
            </div>
          </div>

          <div className="grid g2" style={{ marginTop: 16 }}>
            <div className="card">
              <h2 style={{ marginBottom: 10 }}>ยอดขายรายวัน</h2>
              {r.by_day.length === 0 ? (
                <Empty text="ไม่มีข้อมูล" />
              ) : (
                <table>
                  <tbody>
                    {r.by_day.map((d: any) => (
                      <tr key={d.day}>
                        <td className="nowrap">{thDate(d.day)}</td>
                        <td style={{ width: '45%' }}><div className="bar"><div style={{ width: `${(d.total / maxDay) * 100}%` }} /></div></td>
                        <td className="num">{d.bills} บิล</td>
                        <td className="num">{money(d.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="card">
              <h2 style={{ marginBottom: 10 }}>สินค้า/บริการขายดี</h2>
              {r.top_items.length === 0 ? (
                <Empty text="ไม่มีข้อมูล" />
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>รายการ</th>
                      <th className="num">จำนวน</th>
                      <th className="num">ยอดขาย</th>
                      <th className="num">กำไร</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.top_items.map((t: any, i: number) => (
                      <tr key={i}>
                        <td>{t.name}</td>
                        <td className="num">{t.qty}</td>
                        <td className="num">{money(t.net)}</td>
                        <td className="num">{money(t.profit)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}
    </>
  )
}
