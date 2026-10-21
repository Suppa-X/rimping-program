import { useEffect, useState } from 'react'
import { Paperclip, FileText } from 'lucide-react'
import { api, thDate, isWeb } from '../api'
import { useAction, Empty } from '../ui'

/** X-ray, lab results and photos attached to a pet (the old program had 8 image slots on the exam screen). */
export function AttachmentsPanel(props: { petId: string; files: any[]; onChange: () => void }) {
  const act = useAction()
  const [thumbs, setThumbs] = useState<Record<string, string | null>>({})
  useEffect(() => {
    for (const f of props.files) {
      if (!(f.id in thumbs)) api<string | null>('attachments.thumb', { id: f.id }).then((t) => setThumbs((x) => ({ ...x, [f.id]: t }))).catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.files])
  return (
    <div className="card">
      <div className="card-head">
        <h2 className="grow"><Paperclip /> ไฟล์แนบ (X-ray, ผลแล็บ, รูปถ่าย)</h2>
        <button onClick={async () => (await act(() => api<number>('attachments.add', { pet_id: props.petId }))) && props.onChange()}>
          <Paperclip /> แนบไฟล์
        </button>
      </div>
      {isWeb && <div className="alert warn small" style={{ marginBottom: 10 }}>เวอร์ชันเว็บ Demo แนบไฟล์ไม่ได้ — ใช้ได้ในโปรแกรมบนเครื่องร้าน</div>}
      {props.files.length === 0 ? (
        <Empty icon={<Paperclip />} text="ยังไม่มีไฟล์แนบ" />
      ) : (
        <div className="grid g4">
          {props.files.map((f) => (
            <div key={f.id} className="pet-card" style={{ flexDirection: 'column', alignItems: 'stretch' }} onClick={() => api('attachments.open', { id: f.id })}>
              {thumbs[f.id] ? (
                <img src={thumbs[f.id]!} alt={f.file_name} style={{ width: '100%', height: 150, objectFit: 'cover', borderRadius: 8 }} />
              ) : (
                <div className="center" style={{ height: 150, display: 'grid', placeItems: 'center', background: '#f3f7fb', borderRadius: 8 }}><FileText size={40} /></div>
              )}
              <div className="small" style={{ wordBreak: 'break-all' }}>{f.file_name}</div>
              <div className="tiny muted">{thDate(f.created_at, true)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
