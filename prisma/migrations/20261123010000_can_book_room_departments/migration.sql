-- Plain users become view-only; system admins grant booking to up to 2 users per department.
ALTER TABLE `users` ADD COLUMN `canBook` BOOLEAN NOT NULL DEFAULT false;

-- Rooms restricted to a list of departments (implicit many-to-many Department.rooms <-> Room.allowedDepartments).
CREATE TABLE `_RoomDepartments` (
    `A` VARCHAR(191) NOT NULL,
    `B` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `_RoomDepartments_AB_unique`(`A`, `B`),
    INDEX `_RoomDepartments_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `_RoomDepartments` ADD CONSTRAINT `_RoomDepartments_A_fkey` FOREIGN KEY (`A`) REFERENCES `departments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `_RoomDepartments` ADD CONSTRAINT `_RoomDepartments_B_fkey` FOREIGN KEY (`B`) REFERENCES `rooms`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Building 24 floor 15 (ห้องประชุมสภา, ประชุม 1-3) is for these four departments only.
INSERT IGNORE INTO `departments` (`id`, `name`) VALUES ('dept_tcc_utcc_coop', 'ศูนย์ความร่วมมือหอการค้าและมหาวิทยาลัยหอการค้าไทย');

INSERT IGNORE INTO `_RoomDepartments` (`A`, `B`)
SELECT d.`id`, r.`id`
FROM `departments` d
JOIN `rooms` r ON r.`code` LIKE 'M2415%'
WHERE d.`name` IN (
  'กองอาคารและสิ่งแวดล้อม',
  'สำนักอำนวยการ',
  'ศูนย์ความร่วมมือหอการค้าและมหาวิทยาลัยหอการค้าไทย',
  'สำนักบริหารทรัพยากรมนุษย์'
);
