-- Map room-admin accounts to departments, matched by the department name in each user's display name.
-- Only fills users with no department yet, so it never overwrites a choice made in the app.
UPDATE `users` u
JOIN (
  SELECT 'admin1@utcc.ac.th' AS email, 'สำนักทะเบียนและประมวลผล' AS dept UNION ALL
  SELECT 'admin2@utcc.ac.th', 'สำนักยุทธศาสตร์และ Data Analytic' UNION ALL
  SELECT 'admin3@utcc.ac.th', 'สำนักพัฒนานักศึกษา' UNION ALL
  SELECT 'admin4@utcc.ac.th', 'บัณฑิตวิทยาลัย' UNION ALL
  SELECT 'admin5@utcc.ac.th', 'สำนักบริการคอมพิวเตอร์' UNION ALL
  SELECT 'admin6@utcc.ac.th', 'คณะการสร้างเจ้าของธุรกิจสร้างสรรค์' UNION ALL
  SELECT 'admin7@utcc.ac.th', 'คณะวิทยพัฒน์' UNION ALL
  SELECT 'admin8@utcc.ac.th', 'คณะนิเทศศาสตร์' UNION ALL
  SELECT 'admin9@utcc.ac.th', 'คณะการท่องเที่ยวและอุตสาหกรรมบริการ' UNION ALL
  SELECT 'admin10@utcc.ac.th', 'สำนักวิชาการ' UNION ALL
  SELECT 'admin13@utcc.ac.th', 'สำนักบริหารทรัพยากรมนุษย์' UNION ALL
  SELECT 'admin14@utcc.ac.th', 'กองพัสดุและจัดการทรัพย์สิน 1' UNION ALL
  SELECT 'admin15@utcc.ac.th', 'สำนักงานตรวจสอบภายใน' UNION ALL
  SELECT 'admin16@utcc.ac.th', 'กองนิติการ' UNION ALL
  SELECT 'admin17@utcc.ac.th', 'คณะวิศวกรรมศาสตร์' UNION ALL
  SELECT 'admin18@utcc.ac.th', 'วิทยาลัยนานาชาติเพื่อการจัดการ' UNION ALL
  SELECT 'admin19@utcc.ac.th', 'สถาบันวิจัยเพื่อการประเมินและออกแบบนโยบาย' UNION ALL
  SELECT 'admin20@utcc.ac.th', 'กองอาคารและสิ่งแวดล้อม' UNION ALL
  SELECT 'admin21@utcc.ac.th', 'คณะการศึกษาปฐมวัย' UNION ALL
  SELECT 'admin22@utcc.ac.th', 'กองวิเทศสัมพันธ์' UNION ALL
  SELECT 'admin23@utcc.ac.th', 'วิทยาลัยนานาชาติไทย-จีนเพื่อการจัดการ' UNION ALL
  SELECT 'admin24@utcc.ac.th', 'คณะพยาบาลศาสตร์' UNION ALL
  SELECT 'admin25@utcc.ac.th', 'คณะนิติศาสตร์' UNION ALL
  SELECT 'admin26@utcc.ac.th', 'คณะมนุษยศาสตร์' UNION ALL
  SELECT 'admin27@utcc.ac.th', 'คณะวิทยาศาสตร์และเทคโนโลยี' UNION ALL
  SELECT 'admin28@utcc.ac.th', 'คณะเศรษฐศาสตร์' UNION ALL
  SELECT 'admin29@utcc.ac.th', 'คณะบริหารธุรกิจ' UNION ALL
  SELECT 'admin30@utcc.ac.th', 'คณะบัญชี'
) m ON m.email COLLATE utf8mb4_unicode_ci = u.email
JOIN `departments` d ON d.name = m.dept COLLATE utf8mb4_unicode_ci
SET u.departmentId = d.id
WHERE u.departmentId IS NULL;
