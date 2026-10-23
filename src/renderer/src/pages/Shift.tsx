import { useState } from 'react'
import { api, money, thDate, METHOD_LABEL } from '../api'
import { useApi, useAction, useSession, Field, Modal } from '../ui'

export default function Shift() {
  const { shift, refreshShift, can } = useSession()
  const [list, reloadList] = useApi<any[]>('shifts.list')
  const [opening, setOpening] = useState('')
  const [counted, setCounted] = useState('')
  const [note, setNote] = useState('')
  const [closedSummary, setClosedSummary] = useState<any>(null)
  const [view, setView] = useState<any>(null)
  const act = useAction()

  const open = async (): Promise<void> => {
    if (await act(() => api('shifts.open', { opening_cash: opening }), 'เปิดกะแล้ว')) {
      setOpening('')
      refreshShift()
      reloadList()
    }
  }
  const close = async (): Promise<void> => {
    const s = await act(() => api('shifts.close', { counted_cash: counted, note }), 'ปิดกะแล้ว')
    if (s) {
      setClosedSummary(s)
      setCounted('')
      setNote('')
      refreshShift()
      reloadList()
    }
  }
  const diff = shift && counted !== '' ? Math.round((Number(counted) - shift.expected_cash) * 100) / 100 : null

  return (
    <>
      

      {!can('shift') ? (
        <div className="alert">คุณไม่มีสิทธิ์เปิด/ปิดกะ</div>
      ) : !shift ? (
        <div className="card" style={{ maxWidth: 480 }}>
          <h2 style={{ marginBottom: 10 }}>เปิดกะใหม่</h2>
          <Field label="เงินทอนตั้งต้นในลิ้นชัก (บาท)">
            <input className="big" type="number" autoFocus value={opening} onChange={(e) => setOpening(e.target.value)} />
          </Field>
          <button className="big block" style={{ marginTop: 12 }} onClick={open}>เปิดกะ</button>
        </div>
      ) : (
        <div className="split">
          <ShiftSummary s={shift} />
          <div className="card">
            <h2 style={{ marginBottom: 10 }}>ปิดกะ</h2>
            <div className="stack">
              <div className="alert info">
                เงินสดที่ควรมีในลิ้นชัก <b>{money(shift.expected_cash)}</b> บาท
              </div>
              <Field label="นับเงินสดได้จริง (บาท)" required>
                <input className="big" type="number" value={counted} onChange={(e) => setCounted(e.target.value)} />
              </Field>
              {diff !== null && (
                <div className={`alert ${diff === 0 ? 'info' : diff < 0 ? '' : 'warn'}`}>
                  {diff === 0 ? 'ยอดตรง ✔' : diff < 0 ? `เงินขาด ${money(-diff)} บาท` : `เงินเกิน ${money(diff)} บาท`}
                </div>
              )}
              <Field label="หมายเหตุ">
                <input value={note} onChange={(e) => setNote(e.target.value)} />
              </Field>
              <button className="big block" disabled={counted === ''} onClick={close}>ปิดกะ</button>
            </div>
          </div>
        </div>
      )}

      <div className="card" style={{ marginTop: 16 }}>
        <h2 style={{ marginBottom: 10 }}>ประวัติกะ</h2>
        <div className="table-wrap"><table>
          <thead>
            <tr>
              <th>เปิด</th>
              <th>ปิด</th>
              <th className="num">เงินตั้งต้น</th>
              <th className="num">ควรมี</th>
              <th className="num">นับได้</th>
              <th className="num">ส่วนต่าง</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {list?.map((s) => (
              <tr key={s.id}>
                <td>{thDate(s.opened_at, true)} <div className="muted small">{s.opened_by_name}</div></td>
                <td>{s.closed_at ? <>{thDate(s.closed_at, true)} <div className="muted small">{s.closed_by_name}</div></> : <span className="badge ok">เปิดอยู่</span>}</td>
                <td className="num">{money(s.opening_cash)}</td>
                <td className="num">{s.closed_at ? money(s.expected_cash) : '-'}</td>
                <td className="num">{s.closed_at ? money(s.counted_cash) : '-'}</td>
                <td className="num" style={{ color: s.diff < 0 ? 'var(--bad)' : s.diff > 0 ? 'var(--warn)' : undefined }}>
                  {s.closed_at ? money(s.diff) : '-'}
                </td>
                <td>
                  <button className="ghost" onClick={async () => setView(await api('shifts.summary', { id: s.id }))}>สรุป</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </div>

      {(closedSummary || view) && (
        <Modal title="สรุปกะ" onClose={() => { setClosedSummary(null); setView(null) }}>
          <ShiftSummary s={closedSummary ?? view} />
        </Modal>
      )}
    </>
  )
}

function ShiftSummary({ s }: { s: any }) {
  return (
    <div className="card">
      <h2 style={{ marginBottom: 4 }}>สรุปกะ</h2>
      <div className="muted small" style={{ marginBottom: 10 }}>
        เปิด {thDate(s.opened_at, true)} ({s.opened_by_name}) {s.closed_at && `· ปิด ${thDate(s.closed_at, true)} (${s.closed_by_name})`}
      </div>
      <div className="totals">
        <div><span>จำนวนบิล</span><span>{s.bill_count} บิล {s.void_count ? `(ยกเลิก ${s.void_count})` : ''}</span></div>
        <div><span>ยอดขายรวม</span><span className="num">{money(s.bill_total)}</span></div>
        <div className="muted small" style={{ marginTop: 6 }}><span>รับเงินสุทธิแยกช่องทาง</span><span /></div>
        {['cash', 'transfer', 'promptpay'].map((m) => (
          <div key={m}><span>· {METHOD_LABEL[m]}</span><span className="num">{money(s.by_method[m])}</span></div>
        ))}
        {s.deposits_received > 0 && <div><span>รวมรับมัดจำ</span><span className="num">{money(s.deposits_received)}</span></div>}
        {s.refunds > 0 && <div style={{ color: 'var(--bad)' }}><span>รวมคืนเงิน</span><span className="num">-{money(s.refunds)}</span></div>}
        <div style={{ marginTop: 6 }}><span>เงินทอนตั้งต้น</span><span className="num">{money(s.opening_cash)}</span></div>
        <div><span>+ รับเงินสด</span><span className="num">{money(s.cash_in)}</span></div>
        <div><span>− จ่ายคืนเงินสด</span><span className="num">{money(s.cash_out)}</span></div>
        <div className="grand"><span>เงินสดที่ควรมี</span><span className="num">{money(s.expected_cash)}</span></div>
        {s.closed_at && (
          <>
            <div><span>นับได้จริง</span><span className="num">{money(s.counted_cash)}</span></div>
            <div style={{ fontWeight: 700, color: s.diff < 0 ? 'var(--bad)' : undefined }}><span>ส่วนต่าง</span><span className="num">{money(s.diff)}</span></div>
          </>
        )}
      </div>
    </div>
  )
}
