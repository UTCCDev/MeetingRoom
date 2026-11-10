-- AlterTable
ALTER TABLE `bookings` ADD COLUMN `approvedById` VARCHAR(191) NULL,
    ADD COLUMN `autoApproved` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `bookedForId` VARCHAR(191) NULL,
    ADD COLUMN `decisionNote` TEXT NULL;

-- AlterTable
ALTER TABLE `rooms` ADD COLUMN `requiresPresidentApproval` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `users` ADD COLUMN `autoApproveBooking` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `departmentId` VARCHAR(191) NULL,
    ADD COLUMN `isPresidentApprover` BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE `departments` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `departments_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `departments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bookings` ADD CONSTRAINT `bookings_bookedForId_fkey` FOREIGN KEY (`bookedForId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bookings` ADD CONSTRAINT `bookings_approvedById_fkey` FOREIGN KEY (`approvedById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;


-- Rooms that always need the president: ห้องไทรทอง and every room in building 24, floor 08.
UPDATE `rooms` SET `requiresPresidentApproval` = true
WHERE `name` LIKE '%ไทรทอง%'
   OR (`code` IS NOT NULL AND `code` REGEXP '^[MES]2408[0-9]{2}$');
