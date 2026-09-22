# MoneyMore

โปรแกรมจัดการปล่อยกู้ระยะสั้น (ดอกเบี้ยคงที่แบบนอกระบบ) สำหรับเจ้าหนี้รายเดียว

- **Frontend**: Next.js (App Router) + Tailwind + shadcn/ui, deploy บน Vercel
- **Backend**: Google Sheets + Google Apps Script (ดู [apps-script/README.md](apps-script/README.md) สำหรับวิธีตั้งค่า)
- **Auth**: NextAuth + Google OAuth จำกัดเฉพาะ 1 email

## เริ่มต้นใช้งาน (dev)

1. ตั้งค่า Apps Script backend ตาม [apps-script/README.md](apps-script/README.md)
2. คัดลอก `.env.local.example` เป็น `.env.local` แล้วกรอกค่า (Google OAuth credentials, `SHEETS_API_URL`, `SHEETS_API_SECRET`, `ALLOWED_EMAIL`)
3. ติดตั้งและรัน:

```bash
npm install
npm run dev
```

## แผนงาน

ดูรายละเอียดสถาปัตยกรรมและตรรกะการคำนวณทั้งหมดที่ [`docs/plan.md`](docs/plan.md)
