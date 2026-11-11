-- CreateTable
CREATE TABLE `service_members` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `department` ENUM('AV', 'HOUSEKEEPING') NOT NULL,
    `role` ENUM('ADMIN', 'STAFF') NOT NULL,

    UNIQUE INDEX `service_members_userId_department_key`(`userId`, `department`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `service_catalog_items` (
    `id` VARCHAR(191) NOT NULL,
    `department` ENUM('AV', 'HOUSEKEEPING') NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `returnable` BOOLEAN NOT NULL DEFAULT false,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,

    UNIQUE INDEX `service_catalog_items_department_name_key`(`department`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `service_requests` (
    `id` VARCHAR(191) NOT NULL,
    `department` ENUM('AV', 'HOUSEKEEPING') NOT NULL,
    `status` ENUM('PENDING', 'ACCEPTED', 'IN_PROGRESS', 'DONE', 'REJECTED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `requesterId` VARCHAR(191) NOT NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `bookingId` VARCHAR(191) NULL,
    `location` VARCHAR(191) NULL,
    `startTime` DATETIME(3) NOT NULL,
    `endTime` DATETIME(3) NOT NULL,
    `contactPhone` VARCHAR(191) NOT NULL,
    `note` TEXT NULL,
    `visibleAt` DATETIME(3) NULL,
    `assigneeId` VARCHAR(191) NULL,
    `assignedAt` DATETIME(3) NULL,
    `coordinatorName` VARCHAR(191) NULL,
    `coordinatorPhone` VARCHAR(191) NULL,
    `borrowedAt` DATETIME(3) NULL,
    `returnedAt` DATETIME(3) NULL,
    `internalNote` TEXT NULL,
    `rejectionReason` VARCHAR(500) NULL,
    `decidedAt` DATETIME(3) NULL,
    `cancelledAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `service_requests_department_status_startTime_idx`(`department`, `status`, `startTime`),
    UNIQUE INDEX `service_requests_bookingId_department_key`(`bookingId`, `department`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `service_request_items` (
    `id` VARCHAR(191) NOT NULL,
    `requestId` VARCHAR(191) NOT NULL,
    `catalogItemId` VARCHAR(191) NULL,
    `otherText` VARCHAR(191) NULL,
    `qty` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `service_attachments` (
    `id` VARCHAR(191) NOT NULL,
    `requestId` VARCHAR(191) NOT NULL,
    `fileName` VARCHAR(191) NOT NULL,
    `originalName` VARCHAR(191) NOT NULL,
    `mime` VARCHAR(191) NOT NULL,
    `size` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `service_members` ADD CONSTRAINT `service_members_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `service_requests` ADD CONSTRAINT `service_requests_requesterId_fkey` FOREIGN KEY (`requesterId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `service_requests` ADD CONSTRAINT `service_requests_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `service_requests` ADD CONSTRAINT `service_requests_assigneeId_fkey` FOREIGN KEY (`assigneeId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `service_requests` ADD CONSTRAINT `service_requests_bookingId_fkey` FOREIGN KEY (`bookingId`) REFERENCES `bookings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `service_request_items` ADD CONSTRAINT `service_request_items_catalogItemId_fkey` FOREIGN KEY (`catalogItemId`) REFERENCES `service_catalog_items`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `service_request_items` ADD CONSTRAINT `service_request_items_requestId_fkey` FOREIGN KEY (`requestId`) REFERENCES `service_requests`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `service_attachments` ADD CONSTRAINT `service_attachments_requestId_fkey` FOREIGN KEY (`requestId`) REFERENCES `service_requests`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

