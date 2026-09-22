# Apps Script backend setup

1. สร้าง Google Sheet ใหม่ (ว่างๆ) ที่จะใช้เก็บข้อมูล
2. เปิด Extensions → Apps Script
3. ก็อปไฟล์ `Code.gs`, `Interest.gs`, `Sheets.gs`, `Setup.gs` ในโฟลเดอร์นี้ไปวางเป็นไฟล์แยกกันใน Apps Script editor (ชื่อไฟล์ตรงกัน)
4. รันฟังก์ชัน `setupSheets_` หนึ่งครั้ง (เลือกจาก dropdown แล้วกด Run) เพื่อสร้าง 4 tabs พร้อม header
5. ตั้งค่า secret: Project Settings → Script Properties → เพิ่ม key `SHEETS_API_SECRET` ค่าเป็น random string ยาวๆ (หรือแก้ค่าใน `setSecret_` แล้วรันครั้งเดียว)
6. Deploy → New deployment → Type: Web app
   - Execute as: **Me**
   - Who has access: **Anyone**
   - กด Deploy แล้วคัดลอก Web App URL
7. ใน `.env.local` ของ Next.js ใส่:
   - `SHEETS_API_URL=<Web App URL>`
   - `SHEETS_API_SECRET=<ค่าเดียวกับ Script Property>`

ทุกครั้งที่แก้โค้ด `.gs` ต้อง Deploy → Manage deployments → แก้ไข deployment เดิม → Deploy ใหม่ (เวอร์ชันใหม่) URL จะเหมือนเดิมถ้าแก้ deployment เดิม
