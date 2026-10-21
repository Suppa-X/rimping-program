import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import logo from '../assets/logo.png'
import { api, money, thDate, METHOD_LABEL } from '../api'

/** A5 receipt. When VAT is on, the title becomes an abbreviated tax invoice. */
export default function PrintInvoice() {
  const { id } = useParams()
  const [inv, setInv] = useState<any>(null)
  const [s, setS] = useState<any>(null)
  useEffect(() => {
    api('invoices.get', { id }).then(setInv)
    api('settings.get').then(setS)
  }, [id])
  if (!inv || !s) return null

  const title = inv.vat_enabled ? 'ใบเสร็จรับเงิน/ใบกำกับภาษีอย่างย่อ' : 'ใบเสร็จรับเงิน'
  const due = Math.round((inv.total - inv.paid_amount) * 100) / 100
  const payments = inv.payments.filter((p: any) => p.kind === 'payment')

  return (
    <>
      <div className="print-toolbar">
        <button onClick={() => window.print()}>🖨️ พิมพ์ (A5)</button>
        <button className="secondary" onClick={() => window.close()}>ปิด</button>
      </div>
      <div className="print-page">
        <div className="print-head">
          <img src={logo} alt="" />
          <div style={{ flex: 1 }}>
            <h1>{s.shop_name}</h1>
            <div>{s.shop_name_en}</div>
            {s.shop_address && <div>{s.shop_address}</div>}
            <div>
              {s.shop_phone && `โทร ${s.shop_phone}`}
              {inv.vat_enabled && s.shop_tax_id ? ` · เลขประจำตัวผู้เสียภาษี ${s.shop_tax_id}` : ''}
            </div>
          </div>
          <div className="right">
            <b style={{ fontSize: 14 }}>{title}</b>
            <div>เลขที่ {inv.invoice_no}</div>
            <div>วันที่ {thDate(inv.issued_at, true)}</div>
          </div>
        </div>

        {inv.status === 'void' && (
          <div className="center" style={{ margin: '6px 0' }}>
            <span className="void-stamp">ยกเลิก</span>
          </div>
        )}

        <div style={{ display: 'flex', gap: 20, marginBottom: 6 }}>
          <div style={{ flex: 1 }}>
            <b>ลูกค้า:</b> {inv.customer_name ?? 'ลูกค้าทั่วไป'} {inv.customer_code && `(${inv.customer_code})`}
            {inv.customer_phone && <div>โทร {inv.customer_phone}</div>}
          </div>
          {inv.pet_name && (
            <div>
              <b>สัตว์เลี้ยง:</b> {inv.pet_name} ({inv.pet_species})
            </div>
          )}
        </div>

        <table>
          <thead>
            <tr>
              <th style={{ width: 20 }}>#</th>
              <th>รายการ</th>
              <th className="num">จำนวน</th>
              <th className="num">ราคา</th>
              <th className="num">ส่วนลด</th>
              <th className="num">จำนวนเงิน</th>
            </tr>
          </thead>
          <tbody>
            {inv.items.map((it: any) => (
              <tr key={it.id}>
                <td>{it.seq}</td>
                <td>{it.name}</td>
                <td className="num">{it.qty} {it.unit}</td>
                <td className="num">{money(it.unit_price)}</td>
                <td className="num">{it.discount ? money(it.discount) : ''}</td>
                <td className="num">{money(it.line_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ display: 'flex', marginTop: 8, gap: 16 }}>
          <div style={{ flex: 1 }}>
            {payments.length > 0 && (
              <>
                <b>ชำระโดย</b>
                {payments.map((p: any) => (
                  <div key={p.id}>
                    {METHOD_LABEL[p.method]} {money(p.amount)}
                  </div>
                ))}
              </>
            )}
            {inv.note && <div style={{ marginTop: 4 }}>หมายเหตุ: {inv.note}</div>}
          </div>
          <div style={{ width: 230 }}>
            <Row label="รวมเป็นเงิน" value={inv.subtotal} />
            {inv.line_discount + inv.bill_discount > 0 && <Row label="ส่วนลด" value={-(inv.line_discount + inv.bill_discount)} />}
            {inv.vat_enabled ? (
              <>
                <Row label="มูลค่าสินค้า/บริการที่เสียภาษี" value={inv.vatable_amount} />
                {inv.exempt_amount > 0 && <Row label="มูลค่าที่ได้รับยกเว้นภาษี" value={inv.exempt_amount} />}
                <Row label={`ภาษีมูลค่าเพิ่ม ${inv.vat_rate}%`} value={inv.vat_amount} />
              </>
            ) : null}
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1.5px solid #000', marginTop: 3, paddingTop: 3, fontSize: 14, fontWeight: 700 }}>
              <span>ยอดสุทธิ</span>
              <span>{money(inv.total)}</span>
            </div>
            {due > 0 && inv.status !== 'void' && (
              <>
                <Row label="ชำระแล้ว" value={inv.paid_amount} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                  <span>ค้างชำระ</span>
                  <span>{money(due)}</span>
                </div>
              </>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 28 }}>
          <div className="center" style={{ width: 160 }}>
            ......................................
            <div>ผู้รับเงิน ({inv.created_by_name})</div>
          </div>
        </div>
        <div className="center" style={{ marginTop: 14 }}>{s.receipt_footer}</div>
      </div>
    </>
  )
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span>{label}</span>
      <span>{money(value)}</span>
    </div>
  )
}
