-- AlterTable: Add required_membership_tier to vouchers
ALTER TABLE `vouchers`
  ADD COLUMN `required_membership_tier` ENUM('FREE', 'SILVER', 'GOLD', 'PLATINUM') NULL;
