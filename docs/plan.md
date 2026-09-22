# MoneyMore — โปรแกรมปล่อยกู้นอกระบบ (MVP)

## Context

ผู้ใช้ (เจ้าหนี้คนเดียว, single-user) ต้องการเครื่องมือบันทึกและติดตามการปล่อยกู้ระยะสั้น (ดอกเบี้ยคงที่แบบนอกระบบ) แทนการจดมือ/Excel เดิม โดยต้องการ: 1) ตารางช่วยคำนวณดอกเบี้ย/แผนผ่อนชำระตอนปล่อยกู้ใหม่ 2) หน้าสรุปสถานะรายวัน (ใครต้องเก็บเงินวันนี้ ใครใกล้ปิดยอดได้) 3) ประวัติลูกหนี้พร้อมระบบแนะนำ "ปิดยอดด้วยดอกเบี้ยพิเศษ" เพื่อกระตุ้นให้ลูกหนี้ปิดหนี้เร็วขึ้น เก็บข้อมูลใน Google Sheet (ของที่มีอยู่แล้ว/คุ้นเคย, ฟรี) ผ่าน Apps Script เป็น API แทนการตั้ง database แยก และ deploy frontend บน Vercel free tier

## สถาปัตยกรรม

- **Backend**: Google Sheets (data store) + Google Apps Script deployed เป็น Web App (API endpoint เดียว, รับ action ผ่าน POST/GET params) ป้องกันด้วย **shared secret token** (เก็บใน Vercel env var `SHEETS_API_SECRET`, ส่งทุก request; Apps Script ตรวจก่อนอ่าน/เขียนทุกครั้ง)
- **Frontend**: Next.js (App Router) + Tailwind/shadcn, deploy บน Vercel free plan, โค้ดอยู่บน GitHub repo
- **Auth ผู้ใช้**: NextAuth + Google OAuth จำกัดเฉพาะ 1 email (เจ้าหนี้) — ปฏิเสธ login จาก email อื่น
- **Multi-tenant**: ไม่ต้องรองรับ (single-user MVP)

## Google Sheet Schema (4 tabs)

1. **Debtors**: `id, name, phone, note, createdAt`
2. **Loans** (1 debtor มีได้หลายสัญญาพร้อมกัน): `id, debtorId, principal, rateUnit(day/week/month), ratePercent, durationUnits, repaymentMode(bullet/installment), installmentCalcMode(interestOnlyBalloon/equalInstallment), numInstallments, startDate, dueDate, status(active/closed), totalInterest, totalDue, createdAt`
3. **Installments**: `id, loanId, seq, dueDate, amountDue, principalPortion, interestPortion, status(pending/paid/overdue/waived), paidDate, paidAmount`
4. **Payments**: `id, loanId, installmentId(nullable), amount, principalApplied, interestApplied, paymentDate, note, isEarlyClose(bool), specialRate(nullable)`

## Business Logic หลัก

### 1. ดอกเบี้ย (simple interest, fixed ที่ contract creation)
- Selector toggle: [รายวัน] [รายสัปดาห์] [รายเดือน] → กำหนดหน่วยระยะเวลา
- ตาราง preview: แถว = อัตราดอกเบี้ย 3–15% (step ที่กำหนดได้ เช่นทุก 1%), คอลัมน์ = ระยะเวลา 3–30 หน่วย (ตาม selector) → cell = ดอกเบี้ยสุทธิ = `principal × rate% × duration`
- เลือก 1 cell ตอนสร้างสัญญา → ดอกเบี้ยล็อกทันที, **ไม่มี auto-recalculation ตามเวลาจริง** — ถ้าเกินกำหนดต้อง re-quote สัญญาใหม่ด้วยมือ (ไม่มี late fee อัตโนมัติ)

### 2. แผนการผ่อนชำระ — toggle 2 ชั้น
- **ชั้นที่ 1**: [จ่ายก้อนเดียว (bullet)] / [ผ่อนหลายงวด (installment)]
  - Bullet: due date เดียว, ยอด = principal + totalInterest
- **ชั้นที่ 2** (เมื่อเลือก installment): [ดอกเบี้ยรายงวด + ต้นก้อนสุดท้าย (interest-only + balloon)] / [แบ่งต้น+ดอกเท่ากันทุกงวด (equal installment)]
- ระบบ generate แถว Installments ตามโหมดที่เลือก พร้อมวันครบกำหนดแต่ละงวด

### 3. รับชำระเงิน (Payments)
- กรอกแค่ "ยอดที่ได้รับ" → ระบบ auto-allocate แบบ **ดอกเบี้ยก่อน แล้วตัดต้น** (interest-first) เทียบกับงวดที่ due
- อัปเดตสถานะ installment (paid/partial คงเหลือยกไปงวดถัดไป)

### 4. Overdue
- งวดเลยกำหนดไม่จ่าย → status = overdue, ขึ้นในหน้า Today To-Do — ไม่มีดอกเบี้ยปรับอัตโนมัติ

### 5. ปิดยอดพิเศษ (Early-close promotion)
- Trigger: ยอดที่เก็บมาแล้ว (payments สะสม) >= **80% ของยอดรวมที่ต้องจ่ายทั้งหมด** (principal + totalInterest ตามสัญญาเดิม) → ขึ้น Today To-Do ว่า "มีโอกาสปิดได้"
- หน้าประวัติลูกหนี้แสดง: อัตราปัจจุบัน, ยอดที่ได้มาแล้ว (แยกต้น/ดอก), ต้นคงเหลือ
- เจ้าหนี้กรอก "อัตราพิเศษ" เอง (manual, ไม่ผูกตาราง 3–15%) → ระบบคำนวณ: ดอกเบี้ยพิเศษ = ต้นคงเหลือ × อัตราพิเศษ, ส่วนต่าง = ดอกเบี้ยตามสัญญาเดิม (ที่ควรได้) − ดอกเบี้ยพิเศษ
- กด "ยืนยันปิดยอด" (all-or-nothing) → บันทึก 1 Payment (isEarlyClose=true, specialRate) ตัดต้นคงเหลือหมด + ดอกพิเศษ → **งวดที่เหลือทั้งหมด mark เป็น waived** → Loan status = closed
- ไม่รองรับ partial early-close ใน MVP

## หน้าจอ (4 หน้า)

1. **Login** — Google OAuth, จำกัด email เดียว
2. **สรุปยอด + Today To-Do**
   - KPI cards: outstanding principal รวม, ดอกเบี้ยคาดว่าจะได้รับ, จำนวนลูกหนี้ active, จำนวนเกินกำหนด
   - To-Do list: (ก) งวดครบกำหนดวันนี้/เกินกำหนด (ข) ลูกหนี้ที่ >= 80% (โอกาสปิดยอด) — คลิกเข้าหน้าประวัติลูกหนี้ได้
3. **ปล่อยกู้ (สร้างสัญญาใหม่)**
   - เลือกลูกหนี้เดิม (search/dropdown) หรือ "+ เพิ่มลูกหนี้ใหม่" (ชื่อ/เบอร์/note) — 1 คนมีได้หลายสัญญาพร้อมกัน ไม่บล็อก
   - กรอกจำนวนเงิน, เลือก unit ดอกเบี้ย (วัน/สัปดาห์/เดือน)
   - ตารางอัตราดอกเบี้ย (3–15%) × ระยะเวลา (3–30 หน่วย) → คลิกเลือก cell
   - Toggle แผนผ่อน (bullet/installment + โหมดย่อย) → แสดงสรุปตารางแผนการผ่อนชำระ
4. **ประวัติลูกหนี้**
   - รายชื่อลูกหนี้ + ยอดคงเหลือต่อคน (รวมทุกสัญญา)
   - รายละเอียดต่อสัญญา: schedule, payments log, สถานะ
   - ส่วน "ปิดยอดพิเศษ" ตามข้อ 5 ด้านบน (เมื่อเข้าเงื่อนไข 80%)

## ไฟล์/โครงสร้างที่จะสร้าง

- `apps-script/Code.gs` — Web App entrypoint, routes ตาม `action` param (getSummary, listDebtors, createLoan, recordPayment, earlyClose, ฯลฯ), token check, อ่าน/เขียน Sheet ทั้ง 4 tabs
- `apps-script/lib/*.gs` — helper functions แยกตาม concern (interest calc, installment generation, payment allocation)
- Next.js app (`app/`):
  - `app/login/page.tsx`, `app/(dashboard)/page.tsx` (สรุป+todo), `app/(dashboard)/loans/new/page.tsx`, `app/(dashboard)/debtors/[id]/page.tsx`
  - `lib/sheetsApi.ts` — client wrapper เรียก Apps Script API
  - `lib/interest.ts` — ฟังก์ชันคำนวณตารางดอกเบี้ย/แผนผ่อน (ใช้ทั้ง preview ฝั่ง client และอ้างอิง logic เดียวกับฝั่ง Apps Script)
  - `auth.ts` (NextAuth config, restrict email)

## Verification

- ทดสอบ Apps Script ผ่าน `curl`/Postman ตรง endpoint ก่อน (สร้าง debtor, สร้าง loan ทั้ง bullet/installment ทั้ง 2 โหมด, บันทึก payment, ทดสอบ early-close)
- รัน Next.js dev server, login ด้วย Google จริง, เดินสัญญาชีวิตจริง 1 รอบ: สร้างลูกหนี้ → สร้างสัญญา (ลองทั้ง toggle) → บันทึกจ่ายจนถึง 80% → เช็คว่าขึ้น todo → ปิดยอดพิเศษ → เช็คสถานะ loan เป็น closed และ installments เป็น waived
- เช็คหน้าสรุปว่า KPI/today-list อัปเดตถูกต้องหลังแต่ละ action
