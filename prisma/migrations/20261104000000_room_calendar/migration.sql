-- AlterTable
ALTER TABLE `rooms` ADD COLUMN `calendarEmail` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `bookings` ADD COLUMN `graphEventId` VARCHAR(191) NULL;
