# Rimping Program

โปรแกรมผู้ช่วยหน้าร้าน **ริมปิงสัตวแพทย์** สำหรับ Windows (Electron + React + SQLite)

รายละเอียดฟีเจอร์และแผนงานอยู่ใน [docs/SPEC.md](docs/SPEC.md)

## คำสั่งสำหรับนักพัฒนา

| คำสั่ง | ทำอะไร |
|---|---|
| `npm install` | ติดตั้ง dependencies |
| `npm run dev` | เปิดโปรแกรมโหมดพัฒนา (แก้โค้ดแล้วรีโหลดอัตโนมัติ) |
| `npm run typecheck` | ตรวจ TypeScript |
| `npm run selftest` | ทดสอบ logic การเงิน/สต็อก/สิทธิ์ กับฐานข้อมูลชั่วคราว |
| `npm run screens` | ใส่ข้อมูลตัวอย่างแล้วถ่ายภาพหน้าจอไว้ที่ `out/screens/` |
| `npm run demo` | เปิดโหมดทดลอง: ใช้โปรไฟล์แยก `%APPDATA%\Rimping Demo` พร้อมข้อมูลตัวอย่าง (บัญชีทดลองและ PIN อยู่ที่หัวไฟล์ `tests/demo.ts`) |
| `npm run dist` | สร้างไฟล์ติดตั้ง `dist/Rimping-Setup-<version>.exe` |

## โครงสร้าง

```
src/main/            ฝั่งหลังบ้าน (Electron main process)
  db.ts              schema, migration, helper, เลขที่เอกสาร
  auth.ts            ผู้ใช้, PIN, สิทธิ์, การอนุมัติ
  api/clinic.ts      ลูกค้า, สัตว์, เวชระเบียน, วัคซีน
  api/sales.ts       สินค้า, สต็อก, POS, บิล, มัดจำ, กะ, QR พร้อมเพย์
  api/reports.ts     Dashboard, รายงานการเงิน, Log
  api/system.ts      ตั้งค่า, สำรองข้อมูล
src/preload/         สะพาน IPC (window.rimping.call)
src/renderer/src/    หน้าจอ React (pages/*)
tests/               selftest + screenshot helper
```

## ข้อมูลอยู่ที่ไหน

- ฐานข้อมูล: `%APPDATA%\Rimping\rimping.db`
- สำรองอัตโนมัติ: `เอกสาร\Rimping Backup\` (ทุก 12 ชั่วโมง + ทุกครั้งที่ปิดโปรแกรม, เก็บ 60 ชุด)
- เปิดโปรแกรมครั้งแรกจะให้สร้างบัญชีเจ้าของร้าน (ไม่มีรหัสผ่านตั้งต้น)

## หมายเหตุทางเทคนิค

- ใช้ `node:sqlite` ที่มากับ Electron จึงไม่ต้อง compile native module
- เงินคำนวณปัดเศษทีละสตางค์ (`r2`), เลขที่บิลรันต่อเนื่องรายเดือนแบบ พ.ศ. (`RC6910-0001`) และไม่ลบบิล — ยกเลิกเป็นสถานะ `void`
- ทุกการเพิ่ม/แก้ไขในตารางหลักถูกบันทึกลง `sync_outbox` ด้วย trigger เพื่อรอซิงก์ขึ้น Cloud
