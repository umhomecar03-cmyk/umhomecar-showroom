# UM Homecar Showroom

เว็บโชว์รถอัมโฮมคาร์ สำหรับลูกค้าดูรถในมือถือเป็นหลัก พร้อมปุ่มแคปข้อมูลรถเป็นรูป PNG เพื่อส่งให้เซลส์

## สิ่งที่มีในเวอร์ชันนี้

- หน้าโชว์รถทั้งหมด
- ค้นหารถจากชื่อรุ่น / ยี่ห้อ / ปี / ทะเบียน / รหัสรถ
- กรองยี่ห้อ / สถานะ / ช่วงราคา
- หน้ารายละเอียดรถแต่ละคัน
- ตารางผ่อนแบบฟรีดาวน์
- ปุ่มคัดลอกลิงก์รถรายคัน
- ปุ่มแคปข้อมูลรถเป็นรูปสำหรับส่งให้เซลส์
- ออกแบบแบบ Mobile First
- ใช้ Vercel ได้ฟรีในช่วงเริ่มต้น

> หมายเหตุ: เวอร์ชันนี้ยังไม่ใส่สาขา และยังไม่ใส่ปุ่ม LINE / Messenger ตามที่กำหนดไว้

## วิธีรันในเครื่อง

```bash
npm install
npm run dev
```

จากนั้นเปิด URL ที่ Vite แสดง เช่น `http://localhost:5173`

## วิธี Build

```bash
npm run build
```

## วิธีแก้ข้อมูลรถ

เปิดไฟล์นี้:

```text
src/data/cars.js
```

แล้วเพิ่ม/แก้ข้อมูลใน array `cars`

ตัวอย่างข้อมูลรถ:

```js
{
  id: 'UM-MUX-2023-001',
  status: 'available',
  title: 'Isuzu MU-X 1.9 Active 2WD AT ปี 2023',
  brand: 'Isuzu',
  model: 'MU-X',
  year: 2023,
  price: 829000,
  monthlyStartText: '13,xxx',
  mileageText: '95,xxx Km',
  engineText: '1,900cc',
  transmissionText: 'เกียร์อัตโนมัติ 6AT',
  plate: 'XX-XXXX',
  promotion: 'ฟรีดาวน์ ฟรีจัด ฟรีโอน',
  guaranteeText: 'ไม่มีชนหนัก ไม่น้ำท่วม 100%',
  installments: [
    { years: 4, amountText: '20,xxx' },
    { years: 5, amountText: '16,xxx' },
    { years: 6, amountText: '15,xxx' },
    { years: 7, amountText: '13,xxx' },
  ],
  features: [
    'ถุงลมนิรภัย เบรก ABS/EBD',
    'เครื่องเสียงรองรับ Apple CarPlay',
  ],
  images: ['/images/cars/mux-2023-1.jpg'],
  updatedAt: '2026-05-10',
}
```

## วิธีเพิ่มรูปรถ

1. สร้างโฟลเดอร์:

```text
public/images/cars/
```

2. วางรูป เช่น:

```text
public/images/cars/mux-2023-1.jpg
```

3. ใส่ path ใน `cars.js`:

```js
images: ['/images/cars/mux-2023-1.jpg']
```

## วิธีอัปขึ้น GitHub และ Vercel

```bash
git init
git add .
git commit -m "Initial UM Homecar showroom"
```

จากนั้นสร้าง Repository ใน GitHub แล้ว push ขึ้นไป

เมื่อเข้า Vercel:

- Import GitHub Repository
- Framework Preset: Vite
- Build Command: `npm run build`
- Output Directory: `dist`

## เรื่องจำนวนคนดูเว็บตอนนี้

เวอร์ชันนี้เป็นเว็บ Static บน Vercel จึงยังไม่นับจำนวนคนออนไลน์จริงแบบ realtime เพราะต้องใช้ backend/database เช่น Supabase

ตอนนี้จึงแสดงเป็นข้อความ:

```text
มีลูกค้ากำลังเลือกดูรถอยู่ตอนนี้
```

เพื่อไม่ให้แสดงตัวเลขปลอม ถ้าต้องการนับจริงในเฟสถัดไป ให้เพิ่ม Supabase Realtime / analytics table ได้

## หมายเหตุเรื่องปุ่มแคปข้อมูลรถ

ปุ่มแคปใช้ `html2canvas` เพื่อสร้างรูป PNG จากการ์ดสรุปรถ

ถ้าใช้รูปจาก URL ภายนอก ต้องตั้งค่า CORS ให้ถูก ไม่อย่างนั้น browser อาจไม่อนุญาตให้แปลงรูปเป็น PNG

แนะนำช่วงแรกให้เก็บรูปไว้ใน `public/images/cars/` หรือใช้ Supabase Storage / Cloudinary ที่ตั้ง CORS เรียบร้อย
