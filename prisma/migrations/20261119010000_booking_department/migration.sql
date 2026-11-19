-- AlterTable
ALTER TABLE `bookings` ADD COLUMN `departmentId` VARCHAR(191) NULL;

-- AddForeignKey
ALTER TABLE `bookings` ADD CONSTRAINT `bookings_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `departments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
