-- AlterTable: StaffAttendance - add shift tracking fields
ALTER TABLE `staff_attendance`
  ADD COLUMN `is_late` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `forgot_check_in` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `forgot_check_out` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `overtime_minutes` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `shift_id` INTEGER NULL;

-- AlterTable: CourtPricingRule - add isPeak flag
ALTER TABLE `court_pricerule`
  ADD COLUMN `is_peak` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: StaffSalaryRecord - add overtime and penalty fields
ALTER TABLE `staff_salary_records`
  ADD COLUMN `overtime_hours` DECIMAL(6, 2) NOT NULL DEFAULT 0,
  ADD COLUMN `overtime_pay` DECIMAL(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN `penalty_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0;

-- CreateEnum
ALTER TABLE `staff_attendance` MODIFY COLUMN `status` ENUM('WORKING', 'COMPLETED', 'ABSENT') NOT NULL DEFAULT 'WORKING';

-- CreateTable: work_shifts
CREATE TABLE `work_shifts` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `facility_id` INTEGER NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `shift_date` DATE NOT NULL,
  `start_time` TIME NOT NULL,
  `end_time` TIME NOT NULL,
  `max_staff` INTEGER NOT NULL DEFAULT 5,
  `status` ENUM('OPEN', 'CLOSED') NOT NULL DEFAULT 'OPEN',
  `note` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: shift_registrations
CREATE TABLE `shift_registrations` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `shift_id` INTEGER NOT NULL,
  `staff_id` INTEGER NOT NULL,
  `status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
  `note` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `shift_registrations_shift_id_staff_id_key`(`shift_id`, `staff_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: court_locks
CREATE TABLE `court_locks` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `court_id` INTEGER NOT NULL,
  `reason` VARCHAR(191) NOT NULL,
  `note` TEXT NULL,
  `start_date` DATE NOT NULL,
  `end_date` DATE NOT NULL,
  `is_active` BOOLEAN NOT NULL DEFAULT true,
  `locked_by` INTEGER NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey: work_shifts -> facilities
ALTER TABLE `work_shifts` ADD CONSTRAINT `work_shifts_facility_id_fkey`
  FOREIGN KEY (`facility_id`) REFERENCES `facilities`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: shift_registrations -> work_shifts
ALTER TABLE `shift_registrations` ADD CONSTRAINT `shift_registrations_shift_id_fkey`
  FOREIGN KEY (`shift_id`) REFERENCES `work_shifts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: shift_registrations -> users
ALTER TABLE `shift_registrations` ADD CONSTRAINT `shift_registrations_staff_id_fkey`
  FOREIGN KEY (`staff_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: court_locks -> courts
ALTER TABLE `court_locks` ADD CONSTRAINT `court_locks_court_id_fkey`
  FOREIGN KEY (`court_id`) REFERENCES `courts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: court_locks -> users
ALTER TABLE `court_locks` ADD CONSTRAINT `court_locks_locked_by_fkey`
  FOREIGN KEY (`locked_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: staff_attendance -> work_shifts
ALTER TABLE `staff_attendance` ADD CONSTRAINT `staff_attendance_shift_id_fkey`
  FOREIGN KEY (`shift_id`) REFERENCES `work_shifts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
