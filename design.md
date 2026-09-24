# Heavent DS — design.md

ระบบออกแบบองค์กร v0.1.4 สำหรับเว็บและแอปพลิเคชัน ใช้ได้ทั้งภาษาไทยและอังกฤษ บุคลิก: ทางการ องค์กร ความหนาแน่นระดับกลาง

## Typography

ฟอนต์: **DB Heavent** เท่านั้น มีสามน้ำหนัก Light 300 / Medium 500 / Bold 700 ห้ามใช้ faux bold และห้ามใช้ตัวเอียงกับข้อความไทย

DB Heavent มีความสูงตัวอักษรเล็ก ทุกขนาดจึงยกขึ้นหนึ่งขั้นจากสเกลละติน root = 16px

| Token | rem | px | line-height | weight |
|---|---|---|---|---|
| display-large | 5.5 | 88 | 0.98 | Bold |
| display-medium | 4 | 64 | 1.08 | Bold |
| display-small | 3 | 48 | 1.15 | Bold |
| headline-large | 2.5 | 40 | 1.2 | Bold |
| headline-medium | 2.25 | 36 | 1.22 | Medium |
| headline-small | 2 | 32 | 1.25 | Medium |
| title-large | 1.75 | 28 | 1.3 | Medium |
| title-medium | 1.5 | 24 | 1.35 | Medium |
| title-small | 1.25 | 20 | 1.4 | Medium |
| body-large | 1.5 | 24 | 1.6 | Light |
| body-medium | 1.25 | 20 | 1.65 | Light |
| body-small | 1.125 | 18 | 1.6 | Light |
| label-large | 1.125 | 18 | 1.4 | Medium |
| label-medium | 1 | 16 | 1.4 | Medium |
| label-small | 0.875 | 14 | 1.4 | Medium |

กฎ
- เนื้อความไทยต่ำสุด 18px ระยะบรรทัดไม่ต่ำกว่า 1.6
- คอลัมน์เนื้อความไม่เกิน 42.5rem
- ย่อตามอุปกรณ์เฉพาะ Display และ Headline — Title, Body, Label คงขนาดทุกจอ
- ตัวเลขในตารางใช้ Medium, ชิดขวา, tabular-nums

## หน่วย

- เว็บ: `rem` สำหรับตัวอักษรและ spacing, ตัวเลขเปล่าสำหรับ line-height, `em` สำหรับ letter-spacing, `px` สำหรับเส้นและ radius
- แอป: Android `sp` (ตัวอักษร) / `dp` (spacing), iOS `pt`
- ห้าม `pt` บนเว็บ และห้าม `vw` กับตัวอักษร

## Color

| Token | Hex | ใช้กับ |
|---|---|---|
| primary | #2E3192 | ปุ่มหลัก ลิงก์ หัวข้อเน้น |
| primary-hover | #232670 | hover |
| primary-pressed | #1B1E5C | pressed |
| primary-container | #E8E9F6 | ปุ่ม tonal, สถานะเลือก |
| accent | #00B1EB | เส้นโฟกัส, สีเน้น — ไม่ใช้เป็นพื้นหลังข้อความ |
| highlight | #FFC709 | ตัวเน้นและป้ายสถานะ — ไม่ใช้เป็นพื้นปุ่ม |
| ink | #12142E | ข้อความหลัก |
| ink-muted | #3D4160 | เนื้อความ |
| ink-subtle | #6A6F91 | ข้อความรอง (ต่ำสุดที่ยังผ่าน 4.5:1) |
| outline | #C6C9DC | เส้นขอบคอนโทรล |
| line | #E2E4EE | เส้นคั่น |
| canvas | #FAFBFD | พื้นหลังส่วนรอง |
| disabled-bg / fg | #E4E5EC / #8B8FA8 | ปิดใช้งาน |
| error | #B42318 | ข้อผิดพลาด |
| success | #146C3A | สำเร็จ |

## Shape

radius: none 0 · xs 4 (ค่าตั้งต้นของคอนโทรล) · s 8 · m 12 (การ์ด) · l 16 · xl 28 (FAB) · full 999 (badge, chip)

## Buttons

| Variant | ลำดับ | ใช้เมื่อ |
|---|---|---|
| filled | สูงสุด | การกระทำหลัก — หนึ่งปุ่มต่อหน้าจอ |
| tonal | สูง | การกระทำรองที่ยังสำคัญ |
| elevated | รอง | ปุ่มบนพื้นที่มีเนื้อหาข้างหลัง |
| outlined | กลาง | ทางเลือกคู่กับ filled |
| text | ต่ำสุด | ยกเลิก, ลิงก์ในการ์ด |

| Size | height | padding | text |
|---|---|---|---|
| xs | 36 | 16 | label-small (เว็บเท่านั้น) |
| s | 40 | 20 | label-medium (เว็บเท่านั้น) |
| m | 44 | 28 | label-large — ค่าตั้งต้น |
| l | 52 | 34 | title-small |
| xl | 64 | 44 | title-medium |

สถานะ: enabled · hover · pressed · focus (outline 2px accent, offset 2) · disabled
กฎ: ข้อความเป็นคำกริยา, ปุ่มหลักอยู่ขวาสุดใน dialog, ระยะห่างระหว่างปุ่ม 12px, พื้นที่กดขั้นต่ำ 44×44

อื่นๆ: Icon button 44×44, FAB 56 (radius xl), Extended FAB, Segmented button (2–5 ตัวเลือก), Menu button และ Split button (มี ▾ และ aria-expanded)

## Icons

ชุดไอคอน: **Material Symbols** (Apache 2.0) — สไตล์ Outlined เท่านั้น
- ขนาด: 20 (ในปุ่ม/input) · 24 (ค่าตั้งต้น) · 32 · 40 · opsz ตามขนาด
- น้ำหนักตามตัวอักษรข้างๆ: Light → 300, Medium → 500, Bold → 600
- FILL 1 เฉพาะสถานะเลือกใน navigation และ toggle ที่เปิดอยู่
- สี currentColor เสมอ ยกเว้นไอคอนสถานะ
- ไอคอนตกแต่งใส่ aria-hidden · ปุ่มไอคอนเดี่ยวต้องมี aria-label
- ระยะห่างจากข้อความ 8–12px
- dev: `dev-kit/icons.css` → `<span class="icon icon--20 icon--w500">download</span>`

โหลดฟอนต์ใน `<head>`:
```html
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=block">
```

| Class | ค่า |
|---|---|
| `.icon` | 24px · wght 400 · FILL 0 · opsz 24 |
| `.icon--20 / --24 / --32 / --40` | ขนาด (opsz ปรับตาม) |
| `.icon--w300 … --w600` | น้ำหนัก |
| `.icon--fill` | สถานะเลือก |
| `.icon--primary / --error / --success` | สีเฉพาะ |

ไอคอนในคอมโพเนนต์
- ปุ่ม: 20px wght 500 (size L/XL ใช้ 24px) ห่างจาก label 8px
- ปุ่มไอคอน: 24px ในพื้นที่กด 44×44
- Text field: 20px ด้านซ้ายหรือขวา สี ink-subtle
- Navigation: 24px · รายการที่เลือกใช้ FILL 1

หมวดที่คัดไว้ในไลบรารี: การนำทาง · การกระทำ · ไฟล์และเอกสาร · การสื่อสาร · ผู้ใช้และองค์กร · สถานะ · ธุรกิจและข้อมูล — ดูทั้งหมดที่ fonts.google.com/icons

Figma: ติดตั้งฟอนต์ Material Symbols Outlined แล้วพิมพ์ชื่อไอคอนใน text layer หรือใช้ไฟล์ Community "Material Symbols" ของ Google

## Cards

ชนิด: elevated (เงา, บน canvas) · filled (primary-container) · outlined (ค่าตั้งต้น, เส้น line)
รูปแบบ: basic, with image (16:9), header + footer, stat, list, overlay (4:3), horizontal (ต่ำกว่า 600px เป็นแนวตั้ง), interactive/selectable

- radius 12px, padding 24px (มือถือ 16px), ระยะห่างในกริด 20px
- หัวการ์ด title-medium, เนื้อความ body-small
- ปุ่มในการ์ดใช้ size S, filled ได้ไม่เกินหนึ่งปุ่มต่อใบ
- การ์ดที่กดได้ทั้งใบห้ามมีปุ่มหรือลิงก์ซ้อนข้างใน

## Login pattern

ลำดับ: หัวเรื่อง → ชื่อผู้ใช้ → รหัสผ่าน (แสดง/ซ่อน, ลืมรหัสผ่าน) → จดจำฉัน → ปุ่ม "เข้าสู่ระบบ" (filled) → เส้นคั่น "หรือ" → "เข้าสู่ระบบด้วย Microsoft 365" (outlined)

- error แจ้งรวม ไม่บอกว่าผิดช่องไหน และคงค่าชื่อผู้ใช้ไว้
- autocomplete: `username`, `current-password` ห้ามปิดการวางรหัสผ่าน
- ต่ำกว่า 768px แผงแบรนด์ย่อเหลือแถบโลโก้ ฟอร์มเต็มจอ padding 24px
- ไอคอน 365 ต้องใช้โลโก้ทางการของ Microsoft

## ไฟล์ที่เกี่ยวข้อง

- `dev-kit/` — tokens.css, buttons.css, cards.css, icons.css, login.css, Button.jsx, Login.jsx, login.html
- `figma/typography.tokens.json` — นำเข้าผ่าน Tokens Studio
- `figma-plugin/` — สร้าง component Buttons + Login + Cards ใน Figma

## Figma components

| Component set | Properties |
|---|---|
| Button | variant (filled/tonal/elevated/outlined/text) × size (xs/s/m/l/xl) × state (enabled/hover/pressed/disabled) |
| Icon button | type (filled/tonal/outlined/standard) |
| FAB | size (small/medium/large) |
| Extended FAB | tone (primary/tonal) |
| Segmented button | position (start/middle/end) × selected |
| Split button | main + toggle |
| Text field | state (default/focus/error/disabled) |
| Checkbox | checked |
| Alert | type (error/success) |
| SSO button / Microsoft 365 | state (enabled/hover/pressed/loading) |
| Divider / หรือ | — |
| Card | type (elevated/filled/outlined) |
| Card / Pattern | basic, image, header-footer, stat, list, overlay, horizontal |
| Card / Selectable | selected |

ชื่อ property ตรงกับ prop และ class ในโค้ด (`variant`, `size` → `.btn--filled`, `.btn--s`, `.card--outlined`)

## Changelog

- 0.1.4 — Icons: Material Symbols, icons.css, ไลบรารีค้นหาและคัดลอกโค้ด
- 0.1.3 — Cards: หน้าเอกสาร, cards.css, Figma component
- 0.1.2 — Login pattern: หน้าเอกสาร, login.css, Login.jsx, Figma component
- 0.1.1 — Buttons: 5 variant, 5 ขนาด, icon/FAB/segmented/menu/split, Figma plugin
- 0.1.0 — Typography 15 สไตล์ (DB Heavent), หน่วย rem, สี, tokens