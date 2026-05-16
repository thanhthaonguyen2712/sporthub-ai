import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();

async function main() {
  const staffWithoutWallet = await prisma.user.findMany({
    where: {
      role: { in: ["STAFF", "WAREHOUSE_MANAGER"] },
      wallet: null,
    },
    select: { id: true, fullName: true, email: true, role: true },
  });

  console.log(`Tìm thấy ${staffWithoutWallet.length} nhân viên chưa có ví SportHub`);

  if (staffWithoutWallet.length === 0) {
    console.log("Tất cả nhân viên đã có ví. Không cần đồng bộ.");
    return;
  }

  for (const user of staffWithoutWallet) {
    await prisma.wallet.create({ data: { userId: user.id, balance: 0 } });
    console.log(`  ✓ Tạo ví cho ${user.fullName} (${user.email}) — vai trò: ${user.role}`);
  }

  console.log(`\nĐồng bộ xong. Đã tạo ${staffWithoutWallet.length} ví mới.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
