-- DropForeignKey
ALTER TABLE `booking` DROP FOREIGN KEY `booking_customer_id_fkey`;

-- DropIndex
DROP INDEX `booking_customer_id_fkey` ON `booking`;

-- AlterTable
ALTER TABLE `booking` ADD COLUMN `created_by_staff` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `is_walk_in` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `staff_id` INTEGER NULL,
    ADD COLUMN `walk_in_name` VARCHAR(191) NULL,
    ADD COLUMN `walk_in_phone` VARCHAR(191) NULL,
    MODIFY `customer_id` INTEGER NULL;

-- AlterTable
ALTER TABLE `users` MODIFY `role` ENUM('ADMIN', 'OWNER', 'STAFF', 'WAREHOUSE_MANAGER', 'CUSTOMER') NOT NULL DEFAULT 'CUSTOMER';

-- CreateTable
CREATE TABLE `facility_staff` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `facility_id` INTEGER NOT NULL,
    `user_id` INTEGER NOT NULL,
    `role` ENUM('STAFF', 'WAREHOUSE_MANAGER') NOT NULL DEFAULT 'STAFF',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `facility_staff_facility_id_user_id_key`(`facility_id`, `user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `guest_bookings` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `guest_name` VARCHAR(191) NOT NULL,
    `guest_phone` VARCHAR(191) NOT NULL,
    `guest_email` VARCHAR(191) NULL,
    `court_id` INTEGER NOT NULL,
    `booking_date` DATE NOT NULL,
    `start_time` TIME NOT NULL,
    `end_time` TIME NOT NULL,
    `total_price` DECIMAL(10, 2) NOT NULL,
    `status` ENUM('PENDING', 'CONFIRMED', 'PAID', 'EXPIRED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `otp_code` VARCHAR(191) NULL,
    `otp_expiry` DATETIME(3) NULL,
    `expired_at` DATETIME(3) NOT NULL,
    `payment_qr` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `inventory_shifts` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `facility_id` INTEGER NOT NULL,
    `manager_id` INTEGER NOT NULL,
    `shift_date` DATE NOT NULL,
    `shift_type` ENUM('MORNING', 'AFTERNOON', 'EVENING') NOT NULL,
    `notes` TEXT NULL,
    `status` ENUM('OPEN', 'CLOSED', 'VERIFIED') NOT NULL DEFAULT 'OPEN',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `closed_at` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `inventory_shift_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `shift_id` INTEGER NOT NULL,
    `service_id` INTEGER NOT NULL,
    `opening_stock` INTEGER NOT NULL,
    `sold` INTEGER NOT NULL DEFAULT 0,
    `returned` INTEGER NOT NULL DEFAULT 0,
    `closing_stock` INTEGER NULL,
    `discrepancy` INTEGER NULL,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `booking` ADD CONSTRAINT `booking_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `booking` ADD CONSTRAINT `booking_staff_id_fkey` FOREIGN KEY (`staff_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `facility_staff` ADD CONSTRAINT `facility_staff_facility_id_fkey` FOREIGN KEY (`facility_id`) REFERENCES `facilities`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `facility_staff` ADD CONSTRAINT `facility_staff_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `guest_bookings` ADD CONSTRAINT `guest_bookings_court_id_fkey` FOREIGN KEY (`court_id`) REFERENCES `courts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_shifts` ADD CONSTRAINT `inventory_shifts_facility_id_fkey` FOREIGN KEY (`facility_id`) REFERENCES `facilities`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_shifts` ADD CONSTRAINT `inventory_shifts_manager_id_fkey` FOREIGN KEY (`manager_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_shift_items` ADD CONSTRAINT `inventory_shift_items_shift_id_fkey` FOREIGN KEY (`shift_id`) REFERENCES `inventory_shifts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_shift_items` ADD CONSTRAINT `inventory_shift_items_service_id_fkey` FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
