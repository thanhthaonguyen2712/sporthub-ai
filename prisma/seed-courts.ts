import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();

async function main() {
  // Lấy tất cả cơ sở cùng môn thể thao và sân hiện có
  const facilities = await prisma.facility.findMany({
    include: {
      facilitySports: {
        include: { sportCategory: true },
      },
      courts: {
        select: { categoryId: true, name: true },
      },
    },
  });

  let created = 0;

  for (const facility of facilities) {
    console.log(`\n📍 ${facility.name}`);

    for (const fs of facility.facilitySports) {
      const sport = fs.sportCategory;

      // Đếm sân đã có của môn này trong cơ sở
      const existing = facility.courts.filter(c => c.categoryId === sport.id);
      const existingNames = new Set(existing.map(c => c.name));

      for (let i = 1; i <= 5; i++) {
        const name = `${sport.name} ${i}`;
        if (existingNames.has(name)) {
          console.log(`  ✅ Đã có: ${name}`);
          continue;
        }
        await prisma.court.create({
          data: {
            name,
            facilityId: facility.id,
            categoryId: sport.id,
            isActive: true,
          },
        });
        console.log(`  ➕ Tạo: ${name}`);
        created++;
      }
    }
  }

  console.log(`\n✅ Hoàn thành. Đã tạo ${created} sân mới.`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
