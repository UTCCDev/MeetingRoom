-- CreateTable: extra approvers per room (implicit many-to-many Room.approvers <-> User.roomsAsApprover)
CREATE TABLE `_RoomApprovers` (
    `A` VARCHAR(191) NOT NULL,
    `B` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `_RoomApprovers_AB_unique`(`A`, `B`),
    INDEX `_RoomApprovers_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `_RoomApprovers` ADD CONSTRAINT `_RoomApprovers_A_fkey` FOREIGN KEY (`A`) REFERENCES `rooms`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_RoomApprovers` ADD CONSTRAINT `_RoomApprovers_B_fkey` FOREIGN KEY (`B`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
