import { Package } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api, money, thDate, CATEGORY_LABEL } from '../api'
import { useApi, useAction, useSession, Modal, Field, Empty } from '../ui'

const MOVE_LABEL: Record<string, string> = { receive: 'รับเข้า', sale: 'ขาย', adjust: 'ปรับสต็อก', void_return: 'คืนจากยกเลิกบิล' }

export default function Products() {
  const { can } = useSession()
  const [params] = useSearchParams()
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const [lowOnly, setLowOnly] = useState(params.get('low') === '1')
  const [rows, reload] = useApi<any[]>('products.list', { q, category: cat }, [q, cat])
  const [edit, setEdit] = useState<any | null>(null)
  const [receive, setReceive] = useState<any | null>(null)
  const [adjust, setAdjust] = useState<any | null>(null)
  const [history, setHistory] = useState<any | null>(null)
  const editable = can('stock.edit')

  const shown = (rows ?? []).filter((p) => !lowOnly || (p.track_stock && p.stock_qty <= p.min_stock))
  const stockValue = (rows ?? []).filter((p) => p.track_stock).reduce((t, p) => t + Math.max(p.stock_qty, 0) * p.avg_cost, 0)

  return (
    <>
      <div className="page-head">
        <div className="grow">
          <h1 className="title-ico"><span className="gem bronze"><Package /></span> สินค้า/บริการ และคลัง</h1>
          {editable && <div className="muted">มูลค่าสต็อกคงเหลือ (ราคาทุน) {money(stockValue)} บาท</div>}
        </div>
        {editable && <button onClick={() => setEdit({ category: 'medicine', unit: 'ชิ้น', track_stock: true, vat_type: 'vat' })}>➕ เพิ่มรายการ</button>}
      </div>
      <div className="card">
        <div className="row" style={{ marginBottom: 12 }}>
          <input style={{ flex: 1 }} placeholder="🔍 ค้นหา" value={q} onChange={(e) => setQ(e.target.value)} />
          <select style={{ width: 200 }} value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="">ทุกหมวด</option>
            {Object.entries(CATEGORY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <label className="check">
            <input type="checkbox" checked={lowOnly} onChange={(e) => setLowOnly(e.target.checked)} /> เฉพาะใกล้หมด
          </label>
        </div>
        {shown.length === 0 ? (
          <Empty text="ไม่พบรายการ" />
        ) : (
          <div className="table-wrap"><table>
            <thead>
              <tr>
                <th>รหัส</th>
                <th>ชื่อ</th>
                <th>หมวด</th>
                <th className="num">ราคาขาย</th>
                {editable && <th className="num">ทุนเฉลี่ย</th>}
                <th className="num">คงเหลือ</th>
                <th>VAT</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {shown.map((p) => {
                const low = p.track_stock && p.stock_qty <= p.min_stock
                return (
                  <tr key={p.id}>
                    <td className="muted">{p.sku ?? '-'}</td>
                    <td className="bold">
                      {p.name} {p.controlled ? <span className="badge bad">ยาควบคุม</span> : null} {p.needs_vet ? <span className="badge" title="ต้องระบุสัตวแพทย์ (สำหรับ DF)">แพทย์</span> : null}
                    </td>
                    <td className="small">{CATEGORY_LABEL[p.category]}</td>
                    <td className="num">{money(p.price)}</td>
                    {editable && <td className="num muted">{p.track_stock ? money(p.avg_cost) : '-'}</td>}
                    <td className="num">
                      {p.track_stock ? (
                        <span className={low ? 'badge warn' : ''}>
                          {p.stock_qty} {p.unit}
                        </span>
                      ) : (
                        <span className="muted">-</span>
                      )}
                    </td>
                    <td className="small">{p.vat_type === 'vat' ? 'มี VAT' : 'ยกเว้น'}</td>
                    <td className="nowrap right">
                      {p.track_stock ? <button className="ghost" onClick={() => setHistory(p)}>ประวัติ</button> : null}
                      {editable && p.track_stock ? <button className="ghost" onClick={() => setReceive(p)}>รับเข้า</button> : null}
                      {editable && p.track_stock ? <button className="ghost" onClick={() => setAdjust(p)}>ปรับ</button> : null}
                      {editable && <button className="ghost" onClick={() => setEdit(p)}>แก้ไข</button>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table></div>
        )}
      </div>
      {edit && <ProductForm initial={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); reload() }} />}
      {receive && <ReceiveModal p={receive} onClose={() => setReceive(null)} onDone={() => { setReceive(null); reload() }} />}
      {adjust && <AdjustModal p={adjust} onClose={() => setAdjust(null)} onDone={() => { setAdjust(null); reload() }} />}
      {history && <HistoryModal p={history} onClose={() => setHistory(null)} />}
    </>
  )
}

function ProductForm(props: { initial: any; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<any>({ ...props.initial })
  const act = useAction()
  const set = (k: string, v: any): void => setF((x: any) => ({ ...x, [k]: v }))
  const service = ['service', 'procedure', 'grooming', 'boarding'].includes(f.category)
  const drug = ['medicine', 'vaccine'].includes(f.category)
  const save = async (): Promise<void> => {
    if (await act(() => api('products.save', f), 'บันทึกแล้ว')) props.onSaved()
  }
  return (
    <Modal
      title={f.id ? 'แก้ไขสินค้า/บริการ' : 'เพิ่มสินค้า/บริการ'}
      onClose={props.onClose}
      footer={
        <>
          <button className="secondary" onClick={props.onClose}>ยกเลิก</button>
          <button onClick={save}>บันทึก</button>
        </>
      }
    >
      <Field label="ชื่อ" required>
        <input autoFocus value={f.name ?? ''} onChange={(e) => set('name', e.target.value)} />
      </Field>
      <div className="grid g2">
        <Field label="หมวด" required>
          <select
            value={f.category}
            onChange={(e) => {
              const c = e.target.value
              const svc = ['service', 'procedure', 'grooming', 'boarding'].includes(c)
              setF((x: any) => ({ ...x, category: c, track_stock: !svc, needs_vet: svc || c === 'vaccine' }))
            }}
          >
            {Object.entries(CATEGORY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        <Field label="รหัส/บาร์โค้ด">
          <input value={f.sku ?? ''} onChange={(e) => set('sku', e.target.value)} />
        </Field>
        <Field label="ราคาขาย (บาท)" required>
          <input type="number" value={f.price ?? ''} onChange={(e) => set('price', e.target.value)} />
        </Field>
        <Field label="หน่วย">
          <input value={f.unit ?? ''} onChange={(e) => set('unit', e.target.value)} placeholder="ชิ้น, เม็ด, ขวด, ครั้ง" />
        </Field>
        <Field label="ภาษีมูลค่าเพิ่ม (ใช้เมื่อเปิด VAT)">
          <select value={f.vat_type} onChange={(e) => set('vat_type', e.target.value)}>
            <option value="vat">มี VAT</option>
            <option value="exempt">ได้รับยกเว้น VAT</option>
          </select>
        </Field>
        {!service && (
          <Field label="แจ้งเตือนเมื่อคงเหลือ ≤">
            <input type="number" value={f.min_stock ?? 0} onChange={(e) => set('min_stock', e.target.value)} />
          </Field>
        )}
      </div>
      {drug && (
        <div className="pick stack">
          <b>ข้อมูลยา (ใช้พิมพ์ฉลากยา)</b>
          <Field label="กลุ่มยา">
            <input value={f.drug_group ?? ''} onChange={(e) => set('drug_group', e.target.value)} placeholder="ยาปฏิชีวนะ (Antibiotic)" />
          </Field>
          <div className="grid g2">
            <Field label="วิธีใช้ (ภาษาไทย)">
              <input value={f.label_th ?? ''} onChange={(e) => set('label_th', e.target.value)} placeholder="กินครั้งละ 1 เม็ด วันละ 2 ครั้ง หลังอาหาร" />
            </Field>
            <Field label="วิธีใช้ (English)">
              <input value={f.label_en ?? ''} onChange={(e) => set('label_en', e.target.value)} placeholder="1 tablet twice daily after meals" />
            </Field>
          </div>
          <label className="check"><input type="checkbox" checked={!!f.controlled} onChange={(e) => set('controlled', e.target.checked)} /> ยาควบคุม (ต้องลงบัญชี ข.ย.) — จะขึ้นในรายงานยาควบคุม</label>
        </div>
      )}
      <div className="row">
        {!service && (
          <label className="check">
            <input type="checkbox" checked={!!f.track_stock} onChange={(e) => set('track_stock', e.target.checked)} /> ตัดสต็อก
          </label>
        )}
        <label className="check">
          <input type="checkbox" checked={!!f.needs_vet} onChange={(e) => set('needs_vet', e.target.checked)} /> ต้องระบุสัตวแพทย์ผู้ทำ (คิด DF)
        </label>
        {f.id && (
          <label className="check">
            <input type="checkbox" checked={f.active !== 0 && f.active !== false} onChange={(e) => set('active', e.target.checked)} /> เปิดขาย
          </label>
        )}
      </div>
      {!f.id && f.track_stock && !service && (
        <div className="grid g2">
          <Field label="ยอดยกมา (จำนวน)">
            <input type="number" value={f.opening_qty ?? ''} onChange={(e) => set('opening_qty', e.target.value)} />
          </Field>
          <Field label="ทุนต่อหน่วย (บาท)">
            <input type="number" value={f.opening_cost ?? ''} onChange={(e) => set('opening_cost', e.target.value)} />
          </Field>
        </div>
      )}
    </Modal>
  )
}

function ReceiveModal(props: { p: any; onClose: () => void; onDone: () => void }) {
  const [qty, setQty] = useState('')
  const [cost, setCost] = useState(String(props.p.avg_cost || ''))
  const [note, setNote] = useState('')
  const act = useAction()
  const save = async (): Promise<void> => {
    if (await act(() => api('stock.receive', { product_id: props.p.id, qty, unit_cost: cost, note }), 'รับสินค้าเข้าแล้ว')) props.onDone()
  }
  return (
    <Modal
      title={`รับสินค้าเข้า — ${props.p.name}`}
      onClose={props.onClose}
      footer={
        <>
          <button className="secondary" onClick={props.onClose}>ยกเลิก</button>
          <button disabled={!(Number(qty) > 0)} onClick={save}>บันทึก</button>
        </>
      }
    >
      <div className="alert info">คงเหลือปัจจุบัน {props.p.stock_qty} {props.p.unit} · ทุนเฉลี่ย {money(props.p.avg_cost)}</div>
      <div className="grid g2">
        <Field label={`จำนวน (${props.p.unit})`} required>
          <input autoFocus type="number" value={qty} onChange={(e) => setQty(e.target.value)} />
        </Field>
        <Field label="ทุนต่อหน่วย (บาท)" required>
          <input type="number" value={cost} onChange={(e) => setCost(e.target.value)} />
        </Field>
      </div>
      <Field label="หมายเหตุ (เช่น ผู้จำหน่าย, เลขที่ใบส่งของ)">
        <input value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
    </Modal>
  )
}

function AdjustModal(props: { p: any; onClose: () => void; onDone: () => void }) {
  const [counted, setCounted] = useState(String(props.p.stock_qty))
  const [reason, setReason] = useState('')
  const act = useAction()
  const save = async (): Promise<void> => {
    if (await act(() => api('stock.adjust', { product_id: props.p.id, counted_qty: counted, reason }), 'ปรับสต็อกแล้ว')) props.onDone()
  }
  const diff = Number(counted) - props.p.stock_qty
  return (
    <Modal
      title={`ปรับสต็อก — ${props.p.name}`}
      onClose={props.onClose}
      footer={
        <>
          <button className="secondary" onClick={props.onClose}>ยกเลิก</button>
          <button disabled={!reason.trim()} onClick={save}>บันทึก</button>
        </>
      }
    >
      <Field label={`จำนวนที่นับได้จริง (${props.p.unit})`} required>
        <input autoFocus type="number" value={counted} onChange={(e) => setCounted(e.target.value)} />
      </Field>
      {diff !== 0 && (
        <div className={`alert ${diff < 0 ? '' : 'info'}`}>
          ส่วนต่าง {diff > 0 ? '+' : ''}
          {diff} {props.p.unit} (มูลค่าทุน {money(diff * props.p.avg_cost)} บาท)
        </div>
      )}
      <Field label="เหตุผล" required>
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="เช่น นับสต็อกประจำเดือน, ของเสีย, หมดอายุ" />
      </Field>
    </Modal>
  )
}

function HistoryModal(props: { p: any; onClose: () => void }) {
  const [rows] = useApi<any[]>('stock.moves', { product_id: props.p.id })
  return (
    <Modal wide title={`ความเคลื่อนไหว — ${props.p.name}`} onClose={props.onClose}>
      <div className="table-wrap"><table>
        <thead>
          <tr>
            <th>วันเวลา</th>
            <th>ประเภท</th>
            <th className="num">จำนวน</th>
            <th className="num">ทุน/หน่วย</th>
            <th>อ้างอิง</th>
            <th>ผู้ทำรายการ</th>
          </tr>
        </thead>
        <tbody>
          {rows?.map((m) => (
            <tr key={m.id}>
              <td className="nowrap">{thDate(m.created_at, true)}</td>
              <td>{MOVE_LABEL[m.type] ?? m.type}</td>
              <td className="num" style={{ color: m.qty < 0 ? 'var(--bad)' : 'var(--ok)' }}>
                {m.qty > 0 ? '+' : ''}
                {m.qty}
              </td>
              <td className="num">{money(m.unit_cost)}</td>
              <td className="small">{m.invoice_no ?? m.note ?? ''}</td>
              <td className="small">{m.user_name}</td>
            </tr>
          ))}
        </tbody>
      </table></div>
    </Modal>
  )
}
