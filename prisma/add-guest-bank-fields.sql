ALTER TABLE `guest_bookings`
ADD COLUMN IF NOT EXISTS `guest_bank_name` VARCHAR(191) NULL,
ADD COLUMN IF NOT EXISTS `guest_bank_account` VARCHAR(191) NULL;
