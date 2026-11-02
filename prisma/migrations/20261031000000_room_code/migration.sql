-- AlterTable
ALTER TABLE `rooms` ADD COLUMN `code` VARCHAR(191) NULL,
    ADD COLUMN `roomType` ENUM('MEETING', 'EVENT', 'SEMINAR') NOT NULL DEFAULT 'MEETING',
    ADD COLUMN `roomNumber` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `rooms_code_key` ON `rooms`(`code`);
