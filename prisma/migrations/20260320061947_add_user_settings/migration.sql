-- AlterTable
ALTER TABLE `users` ADD COLUMN `language` VARCHAR(191) NOT NULL DEFAULT 'vi',
    ADD COLUMN `notif_email` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `notif_push` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `notif_sms` BOOLEAN NOT NULL DEFAULT false;
