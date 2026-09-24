# Heavent DS — design.md

ระบบออกแบบองค์กร v0.1.8 สำหรับเว็บและแอปพลิเคชัน ใช้ได้ทั้งภาษาไทยและอังกฤษ บุคลิก: ทางการ องค์กร ความหนาแน่นระดับกลาง

## Logo — เว็บไซต์ Design System

โลโก้ UTCC Material Design ใช้ที่หัว sidebar ของเว็บไซต์เอกสารนี้

| ไฟล์ (assets/logo/) | ใช้กับ |
|---|---|
| utcc-material-design.svg | สีน้ำเงิน #34328F บนพื้นขาว / canvas |
| utcc-material-design-white.svg | บนพื้น primary หรือพื้นเข้ม |

- ขนาดใน sidebar: กว้าง 110px สูงอัตโนมัติ ระยะห่างใต้โลโก้ 4px
- ใต้โลโก้แสดงชื่อระบบ "Heavent DS" และเลขเวอร์ชัน
- alt="UTCC Material Design"

```html
<img src="assets/logo/utcc-material-design.svg" alt="UTCC Material Design" width="110">
```

## Logo — ROOM Sync

ประกอบด้วยสัญลักษณ์ประตู (mark) + ชื่อ UTCC / ROOM / Sync ใช้ไฟล์ SVG ต้นฉบับเสมอ

| ไฟล์ (assets/logo/) | ใช้กับ |
|---|---|
| room-sync.svg | ค่าตั้งต้น บนพื้นขาวหรืออ่อน |
| room-sync-white.svg | บนพื้น primary หรือภาพเข้ม |
| room-sync-primary.svg | งานพิมพ์สีเดียว |
| room-sync-black.svg | เอกสารขาวดำ |
| room-sync-mark.svg | favicon, app icon, avatar |
| room-sync-mark-white.svg / -mark-primary.svg | mark บนพื้นเข้ม / สีเดียว |

สีในโลโก้: น้ำเงิน #34328F · ฟ้า #29ABE2 · ประตูไล่สี #00AEEF → #00FFFF — ใช้เฉพาะในตัวโลโก้ ส่วนอื่นของ UI ใช้สีจาก Color

- พื้นที่ว่างรอบโลโก้อย่างน้อยเท่าความสูงคำว่า "UTCC" (~15% ของความสูงโลโก้)
- ขนาดต่ำสุด: โลโก้เต็ม 120px (30 มม. สิ่งพิมพ์) · mark 24px — เล็กกว่า 120px ให้ใช้ mark
- Header 64px ใช้โลโก้สูง 40px · มือถือใช้ mark 32px · ลิงก์กลับหน้าแรก alt="ROOM Sync"
- ห้าม: ยืด/บีบ, หมุน, ใส่เงาหรือเอฟเฟกต์, เปลี่ยนสี, ใช้สีเต็มบนพื้นเข้ม, วางบนพื้นลายหรือภาพที่ไม่ชัด

เลือกไฟล์ตามพื้นหลัง

| พื้นหลัง | ไฟล์ |
|---|---|
| ขาว / canvas / surface-variant | room-sync.svg |
| primary (#2E3192) / ภาพเข้ม | room-sync-white.svg |
| พิมพ์สีเดียว | room-sync-primary.svg หรือ room-sync-black.svg |
| พื้นที่เล็กกว่า 120px | room-sync-mark*.svg |

โค้ด
```html
<a href="/" class="brand" aria-label="ROOM Sync — หน้าแรก">
  <img src="/assets/logo/room-sync.svg" alt="ROOM Sync" height="40">
</a>

<link rel="icon" type="image/svg+xml" href="/assets/logo/room-sync-mark.svg">

<style>
  .brand { display: inline-flex; padding: 6px; }
  .brand img { height: 40px; width: auto; }
  @media (max-width: 599px) {
    .brand img { content: url(/assets/logo/room-sync-mark.svg); height: 32px; }
  }
</style>
```

หมายเหตุสำหรับ dev
- ใช้ `<img>` อ้างไฟล์ SVG ไม่ inline SVG ลงในหน้า (ไฟล์มี gradient id ที่อาจชนกันถ้าวางซ้ำ)
- ใส่ `width` หรือ `height` เสมอเพื่อกันเลย์เอาต์กระโดด
- ไฟล์ต้นฉบับถูกลบ metadata ออกแล้ว ขนาดประมาณ 16 KB

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

สามสีแบรนด์ขยายเป็นชุดโทน 10–99 แล้วจับคู่เป็นบทบาท — ในงานออกแบบและโค้ดให้อ้าง **บทบาท (--color-*)** เสมอ ไม่อ้างเลขโทนหรือ hex ตรงๆ

สีแบรนด์: Primary #2E3192 (โทน 40) · Accent #00B1EB (โทน 60) · Highlight #FFC709 (โทน 70)

### ชุดโทน (--palette-{ชื่อ}-{โทน})

| | 10 | 20 | 30 | 40 | 50 | 60 | 70 | 80 | 90 | 95 | 99 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| primary | #0B0C33 | #151757 | #1F2275 | #2E3192 | #4548AB | #6164C2 | #8487D4 | #A9ABE4 | #D2D3F2 | #E8E9F6 | #F8F8FD |
| accent | #002231 | #003A52 | #005475 | #00709A | #0089B8 | #00B1EB | #45C6F2 | #85D9F6 | #C2ECFA | #E1F6FD | #F5FCFF |
| highlight | #2A1F00 | #463400 | #634A00 | #7A5A00 | #9E7600 | #C79500 | #FFC709 | #FFD84D | #FFEBA6 | #FFF4CC | #FFFCF2 |
| neutral | #12142E | #262944 | #3D4160 | #545878 | #6A6F91 | #8B8FA8 | #A9ACC0 | #C6C9DC | #E2E4EE | #F1F2F8 | #FAFBFD |
| error | #410E0B | #6B1610 | #8A1C12 | #B42318 | #D93025 | #EB5A4F | #F28B82 | #F6B3AD | #FAD7D4 | #FDF1F1 | #FFFBFB |
| success | #06291A | #0C4527 | #0F5A31 | #146C3A | #1E8A4B | #34A865 | #5CC486 | #8FDAAC | #C6EFD5 | #EEF9F2 | #F8FDF9 |

### บทบาทหลัก (ใช้เป็นคู่เสมอ)

| พื้น | ข้อความบนพื้น | ค่า | ความต่าง | ใช้กับ |
|---|---|---|---|---|
| --color-primary | --color-on-primary | #2E3192 / #FFFFFF | 10.7:1 | ปุ่มหลัก ลิงก์ สถานะเลือก |
| --color-primary-container | --color-on-primary-container | #E8E9F6 / #151757 | 13.5:1 | ปุ่ม tonal ชิปที่เลือก |
| --color-accent | --color-on-accent | #00709A / #FFFFFF | 5.5:1 | พื้นสีรองที่มีข้อความ |
| --color-accent-container | --color-on-accent-container | #E1F6FD / #003A52 | 10.9:1 | กล่องข้อมูล (info) |
| --color-highlight | --color-on-highlight | #FFC709 / #12142E | 11.5:1 | ป้ายเด่น ตัวเลขสำคัญ |
| --color-highlight-container | --color-on-highlight-container | #FFF4CC / #7A5A00 | 5.8:1 | ป้ายสถานะรอดำเนินการ |
| --color-error | --color-on-error | #B42318 / #FFFFFF | 6.6:1 | ปุ่มลบ |
| --color-error-container | --color-on-error-container | #FDF1F1 / #8A1C12 | 8.4:1 | ข้อความแจ้งผิดพลาด |
| --color-success-container | --color-on-success-container | #EEF9F2 / #146C3A | 6.0:1 | ข้อความสำเร็จ |

### พื้นผิว ข้อความ และเส้น

| Token | ค่า | ใช้กับ |
|---|---|---|
| --color-surface | #FFFFFF | พื้นหลังหลัก การ์ด dialog |
| --color-canvas | #FAFBFD (neutral-99) | พื้นส่วนรอง |
| --color-surface-variant | #F1F2F8 (neutral-95) | hover รายการ พื้น input ปิดใช้งาน |
| --color-ink | #12142E (neutral-10) | ข้อความหลัก |
| --color-ink-muted | #3D4160 (neutral-30) | เนื้อความ |
| --color-ink-subtle | #6A6F91 (neutral-50) | ข้อความรอง (ต่ำสุดที่ผ่าน 4.5:1) |
| --color-disabled-fg | #8B8FA8 (neutral-60) | ข้อความปิดใช้งาน |
| --color-outline | #C6C9DC (neutral-80) | เส้นขอบคอนโทรล |
| --color-line | #E2E4EE (neutral-90) | เส้นคั่น เส้นขอบการ์ด |
| --color-focus | #00B1EB (accent-60) | เส้นโฟกัส 2px |

### กฎ

- สัดส่วนต่อหน้าจอ: พื้นผิว 60% · neutral 25% · primary 10% · accent + highlight รวม 5%
- #00B1EB บนขาวได้แค่ 2.5:1 — ใช้เป็นเส้นโฟกัสและพื้นตกแต่ง ข้อความโทนฟ้าใช้ accent-40 (#00709A)
- #FFC709 ห้ามใช้เป็นพื้นข้อความขาว (1.6:1) — ป้ายสถานะใช้ highlight-95 คู่ highlight-40
- สีสถานะต้องมาคู่กับไอคอนหรือข้อความเสมอ
- เกณฑ์: เนื้อความ 4.5:1 · ข้อความ 24px ขึ้นไป 3:1 (แนะนำ 4.5:1 สำหรับไทย) · ไอคอนและเส้นขอบคอนโทรล 3:1

### ไฟล์

- dev: `dev-kit/colors.css` (โหลดหลัง tokens.css)
- Figma: `figma/colors.tokens.json` — นำเข้าผ่าน Tokens Studio ได้ชุด palette และ role ใช้เฉพาะ role ในงานออกแบบ

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

สีของการ์ด (อ้างบทบาทจาก Color)

| ส่วน | Token |
|---|---|
| พื้น / เส้นขอบ | --color-surface / --color-line |
| filled | --color-primary-container |
| หัว / เนื้อความ / meta | --color-ink / --color-ink-muted / --color-ink-subtle |
| overline | --color-primary |
| footer | --color-canvas |
| พื้นรูประหว่างโหลด | --color-surface-variant |
| hover / selected | เส้น --color-primary · selected พื้น primary-99 เส้น 2px |
| focus | --color-focus |
| overlay | --color-primary / on-primary · overline --color-highlight |

การ์ดสื่อความหมาย — ข้อความทั้งใบใช้สี on-* ตัวเดียว ไม่ปนสีเทา

| Class | พื้น | ข้อความ | ความต่าง | ใช้กับ |
|---|---|---|---|---|
| `.card--primary` | primary-container #E8E9F6 | on-primary-container #151757 | 14.3:1 | ประกาศ ข่าวสาร |
| `.card--info` | accent-container #E1F6FD | on-accent-container #003A52 | 11.0:1 | ข้อมูลประกอบ คำแนะนำ |
| `.card--warning` | highlight-container #FFF4CC | on-highlight-container #7A5A00 | 5.8:1 | รอดำเนินการ ต้องตรวจสอบ |
| `.card--error` | error-container #FDF1F1 | on-error-container #8A1C12 | 8.5:1 | ส่งไม่สำเร็จ ข้อผิดพลาด |
| `.card--success` | success-container #EEF9F2 | on-success-container #146C3A | 6.3:1 | อนุมัติแล้ว สำเร็จ |

- ใส่ไอคอนสถานะ 24–28px สีเดียวกับข้อความเสมอ ไม่ใช้สีอย่างเดียวสื่อความหมาย
- ไม่มีเส้นขอบ ไม่มีเงา
- ปุ่มในการ์ดสื่อความหมายใช้ text หรือ outlined เท่านั้น

Badge: `.badge--warning / --success / --error` ใช้คู่สี container เดียวกัน radius full

โค้ด
```html
<article class="card card--outlined">
  <img class="card__media" src="…" alt="…">
  <div class="card__body">
    <span class="card__overline">ข่าวองค์กร</span>
    <h3 class="card__title">เปิดสำนักงานสาขาใหม่</h3>
    <p class="card__text">…</p>
    <span class="card__meta">12 ก.ย. 2569</span>
  </div>
</article>

<div class="card card--warning" role="status">
  <div class="card__body">
    <span class="icon">pending</span>
    <h3 class="card__title">รอดำเนินการ</h3>
    <p class="card__text">คำขอ 3 รายการรอการอนุมัติ</p>
  </div>
</div>
```
ลำดับโหลด CSS: tokens.css → colors.css → icons.css → cards.css

## Login pattern

ลำดับ: หัวเรื่อง → ชื่อผู้ใช้ → รหัสผ่าน (แสดง/ซ่อน, ลืมรหัสผ่าน) → จดจำฉัน → ปุ่ม "เข้าสู่ระบบ" (filled) → เส้นคั่น "หรือ" → "เข้าสู่ระบบด้วย Microsoft 365" (outlined)

- error แจ้งรวม ไม่บอกว่าผิดช่องไหน และคงค่าชื่อผู้ใช้ไว้
- autocomplete: `username`, `current-password` ห้ามปิดการวางรหัสผ่าน
- ต่ำกว่า 768px แผงแบรนด์ย่อเหลือแถบโลโก้ ฟอร์มเต็มจอ padding 24px
- ไอคอน 365 ต้องใช้โลโก้ทางการของ Microsoft

## ไฟล์ที่เกี่ยวข้อง

- `assets/logo/utcc-material-design.svg` (+ `-white.svg`) — โลโก้ของเว็บไซต์ Design System นี้
- `assets/logo/` — โลโก้ ROOM Sync 7 ไฟล์ (SVG)
- `dev-kit/` — tokens.css, colors.css, buttons.css, cards.css, icons.css, login.css, Button.jsx, Login.jsx, login.html
- `figma/typography.tokens.json`, `figma/colors.tokens.json` — นำเข้าผ่าน Tokens Studio
- `figma-plugin/` — สร้าง component Buttons + Login + Cards (รวม Card / Tone) ใน Figma

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
| Card / Tone | tone (primary/info/warning/error/success) |
| Card / Selectable | selected |

ชื่อ property ตรงกับ prop และ class ในโค้ด (`variant`, `size` → `.btn--filled`, `.btn--s`, `.card--outlined`)

## Changelog

- 0.1.8 — โลโก้เว็บไซต์ UTCC Material Design ที่หัว sidebar (110px) + แบบสีขาว
- 0.1.7 — Logo ROOM Sync: 7 รูปแบบ, พื้นที่ว่าง, ขนาดต่ำสุด, ข้อห้าม, ตารางเลือกไฟล์ตามพื้นหลัง, โค้ด
- 0.1.6 — Cards อ้างบทบาทสี, เพิ่มการ์ดสื่อความหมาย 5 โทน (เว็บ, CSS, Figma)
- 0.1.5 — Color: ชุดโทน 6 ชุด, บทบาท, เกณฑ์ความต่าง, colors.css, colors.tokens.json
- 0.1.4 — Icons: Material Symbols, icons.css, ไลบรารีค้นหาและคัดลอกโค้ด
- 0.1.3 — Cards: หน้าเอกสาร, cards.css, Figma component
- 0.1.2 — Login pattern: หน้าเอกสาร, login.css, Login.jsx, Figma component
- 0.1.1 — Buttons: 5 variant, 5 ขนาด, icon/FAB/segmented/menu/split, Figma plugin
- 0.1.0 — Typography 15 สไตล์ (DB Heavent), หน่วย rem, สี, tokens
