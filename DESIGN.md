UI/UX Design Document

Project Name: ระบบจองห้องประชุมส่วนกลาง (Centralized Meeting Room Booking System)
Document Version: 1.1
Target Audience: พนักงานทุก Gen (เน้นความเรียบง่าย อ่านง่าย คล่องตัว)

1. แนวคิดการออกแบบ (Design Concept)

Minimal & Clean: ลดทอนส่วนตกแต่งที่ไม่จำเป็น เน้นพื้นที่สีขาว (White Space) เพื่อให้ผู้ใช้โฟกัสที่เนื้อหาหลัก เช่น รูปห้องและเวลาที่ว่าง

Accessibility First: ขนาดตัวอักษรต้องใหญ่พอ สีมีความเปรียบต่าง (Contrast) ชัดเจน เพื่อให้ผู้ใช้สูงวัย (Gen X, Baby Boomer) ใช้งานได้โดยไม่ต้องเพ่ง

Mobile-First Responsive: หน้าจอต้องจัดเรียงใหม่แบบ Stack ลงมาในแนวตั้งเมื่อเปิดบนมือถือ และขยายเป็น Grid เมื่อดูบน Desktop หรือ iPad

2. โทนสีและแบบอักษร (Color Palette & Typography)

2.1 แบบอักษร (Typography)

Primary Font: Prompt หรือ Noto Sans Thai (อ่านง่ายทั้งตัวหนาและตัวบาง เหมาะกับ UI สมัยใหม่)

Font Sizes:

Heading 1 (ชื่อหน้า): 24px - 32px (Bold)

Heading 2 (ชื่อห้อง): 20px - 24px (Semi-Bold)

Body (เนื้อหาทั่วไป): 16px (Regular)

Small (รายละเอียด/เวลา): 14px (Regular)

2.2 โทนสี (Color Palette)

โทนสีหลักของเว็บไซต์จะเน้นความเรียบหรูและสะอาดตา โดยใช้สี Blue Essence คู่กับ สีขาว เป็นแกนหลัก:

Primary Color (สีหลัก): Blue Essence (โทนน้ำเงินสดใส ทันสมัย เช่น Tailwind: blue-700 [#1D4ED8] หรือ blue-800 [#1E40AF]) ใช้สำหรับปุ่มกดหลัก (Primary Button), แถบ Navigation, ไอคอนหลัก และจุดที่ต้องการเน้นความสนใจ (Call to action)

Background Color (สีพื้นหลัง): Pure White (#FFFFFF) ใช้เป็นสีพื้นหลังหลักของเว็บไซต์ทั่วทั้งระบบ เพื่อสร้างพื้นที่ว่าง (White space) ขับให้รูปภาพห้องประชุมและองค์ประกอบสีน้ำเงินโดดเด่นขึ้นมา ดูสะอาดและโปร่งตา

Secondary Background: Light Gray (gray-50 #F9FAFB) ใช้เฉพาะส่วนที่เป็นพื้นหลังของการ์ด (Card) หรือส่วนที่ต้องการแบ่งสัดส่วนเลย์เอาต์ให้แยกจากพื้นหลังสีขาวหลักเพียงเล็กน้อย

Text Color (สีตัวอักษร): Dark Charcoal (gray-800 #1F2937) สำหรับหัวข้อ และ gray-600 (#4B5563) สำหรับรายละเอียดทั่วไป เพื่อให้ตัดกับพื้นหลังสีขาวและอ่านง่ายที่สุด

Status Colors (สีสถานะที่ต้องชัดเจน):

🟢 Available (ว่าง): Emerald Green (emerald-500 #10B981)

🔴 Booked (ถูกจองแล้ว): Rose Red (rose-500 #F43F5E)

🟡 Pending (รออนุมัติ): Amber (amber-500 #F59E0B)

3. โครงสร้างหน้าจอและเลย์เอาต์ (Layout Structure)

3.1 Navigation (แถบนำทาง)

Desktop/Tablet: Top Navigation Bar อยู่ด้านบนสุด (ใช้พื้นหลังสีขาว ตัวอักษรและโลโก้สี Blue Essence) ประกอบด้วย:

ซ้าย: Logo และชื่อระบบ

กลาง: เมนูหลัก (หน้าแรก, ตารางการจองของฉัน)

ขวา: ชื่อผู้ใช้ (Profile), เมนูสลับ Role (หากเป็น Admin), และปุ่ม Logout

Mobile: ใช้ Hamburger Menu ล็อกอยู่มุมขวาบน เมื่อกดจะสไลด์เมนูลงมา (Dropdown) หรือใช้ Bottom Navigation Bar สำหรับ Action หลัก

3.2 UI Components หลัก (อิงจาก shadcn/ui)

Room Card: การ์ดแสดงห้องประชุม

บน: รูปภาพห้องประชุม (อัตราส่วน 16:9) ขอบโค้งมนเล็กน้อย (Rounded corners)

กลาง: ชื่อห้อง (สีตัวอักษรเข้ม), Icon จำนวนที่นั่ง, Icon สิ่งอำนวยความสะดวก (Icon สี Blue Essence)

ล่าง: ปุ่ม "ดูรายละเอียด / จองห้อง" (ปุ่มพื้นสี Blue Essence ตัวหนังสือสีขาว)

Calendar / Timeline:

ใช้รูปแบบ Calendar แบบรายสัปดาห์ (Weekly View) หรือรายวัน (Daily Timeline)

แสดงแถบสีตามช่วงเวลา (Time block)

Dialog / Modal:

เมื่อกดจอง จะแสดง Pop-up (Modal) พื้นหลังสีขาว โผล่ขึ้นมาทับหน้าจอเดิม (มีฉากหลังมืดโปร่งแสง)

ภายใน Modal ประกอบด้วย Form: เลือกวัน, เลือกเวลาเริ่ม-จบ, ใส่หัวข้อการประชุม, และปุ่มยืนยัน

4. รายละเอียดหน้าจอหลัก (Key Pages)

4.1 หน้าแรก - รายการห้องประชุม (Home / Room Catalog)

Hero Section: ช่องค้นหา (Search bar) และตัวกรอง (Filter) ดีไซน์แบบมินิมอล ขอบมน

Content: แสดงผลห้องประชุมในรูปแบบ Grid (เช่น Desktop แสดง 3-4 คอลัมน์, Mobile แสดง 1 คอลัมน์)

Badge: มีป้ายกำกับสถานะที่มุมของการ์ด

4.2 หน้าดูรายละเอียดและจอง (Room Details & Booking)

Layout: แบ่งเป็น 2 คอลัมน์ (บน Desktop)

คอลัมน์ซ้าย: รูปภาพขนาดใหญ่, รายละเอียดห้องอย่างครบถ้วน

คอลัมน์ขวา: ตารางเวลา (Time slot) ที่สามารถคลิกเลือกช่วงเวลาเพื่อจองได้เลย

Interaction: เมื่อคลิกเลือกเวลา จะมีปุ่ม "ดำเนินการจอง (Book Now)" โผล่ขึ้นมาชัดเจน

4.3 หน้าการจองของฉัน (My Bookings)

Layout: แสดงเป็น List View ขาวสะอาดตา เรียงตามวันที่จอง

Content: หัวข้อการประชุม, ชื่อห้อง, วัน/เวลา และ Badge แสดงสถานะ (รออนุมัติ, อนุมัติแล้ว, ปฏิเสธ)

Action: มีปุ่ม "ยกเลิกการจอง" แบบ Outline (ขอบสี Blue Essence ไม่ถมทึบ)

4.4 หน้า Admin Dashboard (สำหรับ Room Admin และ System Admin)

Layout: มี Sidebar ด้านซ้ายสำหรับเปลี่ยนเมนูการจัดการ

Content (คำขอจอง): ตาราง (Data Table) แสดงรายการที่รออนุมัติ พร้อมปุ่ม ✔️ (Approve) และ ❌ (Reject) ในแต่ละแถว

Content (จัดการห้อง): ฟอร์มแบบง่าย สำหรับเพิ่ม/แก้ไขรูปภาพและรายละเอียดห้อง บนการ์ดสีขาว (Card overlay)