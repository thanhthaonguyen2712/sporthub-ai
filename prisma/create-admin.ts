/**
 * Script tạo / cập nhật tài khoản admin hệ thống cố định.
 * Chạy: npx ts-node --project tsconfig.seed.json prisma/create-admin.ts
 */
import { PrismaClient } from "../src/generated/prisma";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email    = "Adminsporthub58@gmail.com";
  const password = "sporthubAiadmin58!";
  const hashed   = await bcrypt.hash(password, 10);

  const admin = await prisma.user.upsert({
    where:  { email },
    update: { password: hashed, role: "ADMIN", isLocked: false },
    create: {
      email,
      phone:    "0900000000",
      fullName: "Admin SportHub",
      password: hashed,
      role:     "ADMIN",
      wallet:   { create: { balance: 0 } },
    },
  });

  console.log(`✅ Tài khoản admin đã sẵn sàng (id=${admin.id})`);
  console.log(`   Email   : ${email}`);
  console.log(`   Password: ${password}`);
  console.log(`   Role    : ${admin.role}`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
