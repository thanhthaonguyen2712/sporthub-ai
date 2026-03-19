-- AlterTable
ALTER TABLE `users` ADD COLUMN `reset_token` VARCHAR(191) NULL,
    ADD COLUMN `reset_token_exp` DATETIME(3) NULL;
