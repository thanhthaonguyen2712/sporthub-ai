import { PrismaClient } from "../src/generated/prisma";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Bắt đầu seed data...");

  // ===================== 1. SPORT CATEGORIES =====================
  console.log("📌 Tạo danh mục môn thể thao...");

  const sports = await Promise.all([
    prisma.sportCategory.upsert({
      where: { slug: "bong-da" },
      update: { iconUrl: "https://cdn-icons-png.flaticon.com/128/1165/1165187.png" },
      create: { name: "Bóng đá", slug: "bong-da", iconUrl: "https://cdn-icons-png.flaticon.com/128/1165/1165187.png" },
    }),
    prisma.sportCategory.upsert({
      where: { slug: "cau-long" },
      update: { iconUrl: "https://cdn-icons-png.flaticon.com/128/2633/2633871.png" },
      create: { name: "Cầu lông", slug: "cau-long", iconUrl: "https://cdn-icons-png.flaticon.com/128/2633/2633871.png" },
    }),
    prisma.sportCategory.upsert({
      where: { slug: "pickleball" },
      update: { iconUrl: "https://cdn-icons-png.flaticon.com/512/16117/16117721.png" },
      create: { name: "Pickleball", slug: "pickleball", iconUrl: "https://cdn-icons-png.flaticon.com/512/16117/16117721.png" },
    }),
    prisma.sportCategory.upsert({
      where: { slug: "bong-ro" },
      update: { iconUrl: "https://cdn-icons-png.flaticon.com/128/2527/2527964.png" },
      create: { name: "Bóng rổ", slug: "bong-ro", iconUrl: "https://cdn-icons-png.flaticon.com/128/2527/2527964.png" },
    }),
    prisma.sportCategory.upsert({
      where: { slug: "tennis" },
      update: { iconUrl: "https://cdn-icons-png.flaticon.com/128/9012/9012192.png" },
      create: { name: "Tennis", slug: "tennis", iconUrl: "https://cdn-icons-png.flaticon.com/128/9012/9012192.png" },
    }),
  ]);

  console.log(`✅ Tạo ${sports.length} môn thể thao`);

  // ===================== 2. USERS =====================
  console.log("👤 Tạo users...");

  const hashedPassword = await bcrypt.hash("123456", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@sporthub.vn" },
    update: {},
    create: {
      email: "admin@sporthub.vn",
      phone: "0900000001",
      fullName: "Admin SportHub",
      password: hashedPassword,
      role: "ADMIN",
      wallet: { create: { balance: 0 } },
    },
  });

  const owner = await prisma.user.upsert({
    where: { email: "owner@sporthub.vn" },
    update: {},
    create: {
      email: "owner@sporthub.vn",
      phone: "0900000002",
      fullName: "Nguyễn Văn Owner",
      password: hashedPassword,
      role: "OWNER",
      wallet: { create: { balance: 5000000 } },
    },
  });

  const staff = await prisma.user.upsert({
    where: { email: "staff@sporthub.vn" },
    update: {},
    create: {
      email: "staff@sporthub.vn",
      phone: "0900000003",
      fullName: "Trần Thị Staff",
      password: hashedPassword,
      role: "STAFF",
      wallet: { create: { balance: 0 } },
    },
  });

  const customer = await prisma.user.upsert({
    where: { email: "customer@sporthub.vn" },
    update: {},
    create: {
      email: "customer@sporthub.vn",
      phone: "0900000004",
      fullName: "Lê Văn Customer",
      password: hashedPassword,
      role: "CUSTOMER",
      wallet: { create: { balance: 500000 } },
    },
  });

  console.log("✅ Tạo 4 users (admin, owner, staff, customer)");

  // ===================== 3. FACILITIES =====================
  console.log("🏟️ Tạo cơ sở sân...");

  const facility1 = await prisma.facility.upsert({
    where: { id: 1 },
    update: {},
    create: {
      name: "Sân thể thao Hòa Xuân",
      address: "123 Hòa Xuân, Cẩm Lệ, Đà Nẵng",
      description: "Cụm sân thể thao hiện đại tại Hòa Xuân với đầy đủ tiện nghi",
      latitude: 16.0021,
      longitude: 108.2141,
      isActive: true,
      ownerId: owner.id,
      facilitySports: {
        create: [
          { sportCategoryId: sports[0].id }, // Bóng đá
          { sportCategoryId: sports[1].id }, // Cầu lông
        ],
      },
    },
  });

  const facility2 = await prisma.facility.upsert({
    where: { id: 2 },
    update: {},
    create: {
      name: "SportHub Ngũ Hành Sơn",
      address: "456 Trường Sa, Ngũ Hành Sơn, Đà Nẵng",
      description: "Sân Pickleball & Tennis chuẩn quốc tế gần biển Mỹ Khê",
      latitude: 16.0472,
      longitude: 108.2526,
      isActive: true,
      ownerId: owner.id,
      facilitySports: {
        create: [
          { sportCategoryId: sports[2].id }, // Pickleball
          { sportCategoryId: sports[4].id }, // Tennis
        ],
      },
    },
  });

  console.log("✅ Tạo 2 cơ sở sân");

  // ===================== 4. COURTS =====================
  console.log("🏸 Tạo sân con...");

  // Sân con của facility 1
  const court1 = await prisma.court.create({
    data: {
      name: "Sân bóng đá số 1",
      isActive: true,
      facilityId: facility1.id,
      categoryId: sports[0].id, // Bóng đá
    },
  });

  const court2 = await prisma.court.create({
    data: {
      name: "Sân bóng đá số 2",
      isActive: true,
      facilityId: facility1.id,
      categoryId: sports[0].id,
    },
  });

  const court3 = await prisma.court.create({
    data: {
      name: "Sân cầu lông A",
      isActive: true,
      facilityId: facility1.id,
      categoryId: sports[1].id, // Cầu lông
    },
  });

  // Sân con của facility 2
  const court4 = await prisma.court.create({
    data: {
      name: "Sân Pickleball 1",
      isActive: true,
      facilityId: facility2.id,
      categoryId: sports[2].id, // Pickleball
    },
  });

  const court5 = await prisma.court.create({
    data: {
      name: "Sân Tennis A",
      isActive: true,
      facilityId: facility2.id,
      categoryId: sports[4].id, // Tennis
    },
  });

  console.log("✅ Tạo 5 sân con");

  // ===================== 5. PRICING RULES =====================
  console.log("💰 Tạo bảng giá...");

  // Giá sân bóng đá số 1
  await prisma.courtPricingRule.createMany({
    data: [
      {
        courtId: court1.id,
        startTime: new Date("1970-01-01T06:00:00"),
        endTime: new Date("1970-01-01T17:00:00"),
        pricePerHour: 150000,
        dayType: "WEEKDAY",
        priority: 1,
      },
      {
        courtId: court1.id,
        startTime: new Date("1970-01-01T17:00:00"),
        endTime: new Date("1970-01-01T22:00:00"),
        pricePerHour: 250000, // Giờ vàng
        dayType: "WEEKDAY",
        priority: 2,
      },
      {
        courtId: court1.id,
        startTime: new Date("1970-01-01T06:00:00"),
        endTime: new Date("1970-01-01T22:00:00"),
        pricePerHour: 300000, // Cuối tuần
        dayType: "WEEKEND",
        priority: 1,
      },
    ],
  });

  // Giá sân cầu lông
  await prisma.courtPricingRule.createMany({
    data: [
      {
        courtId: court3.id,
        startTime: new Date("1970-01-01T06:00:00"),
        endTime: new Date("1970-01-01T17:00:00"),
        pricePerHour: 80000,
        dayType: "WEEKDAY",
        priority: 1,
      },
      {
        courtId: court3.id,
        startTime: new Date("1970-01-01T17:00:00"),
        endTime: new Date("1970-01-01T22:00:00"),
        pricePerHour: 120000,
        dayType: "WEEKDAY",
        priority: 2,
      },
      {
        courtId: court3.id,
        startTime: new Date("1970-01-01T06:00:00"),
        endTime: new Date("1970-01-01T22:00:00"),
        pricePerHour: 150000,
        dayType: "WEEKEND",
        priority: 1,
      },
    ],
  });

  console.log("✅ Tạo bảng giá cho các sân");

  // ===================== 6. SERVICES =====================
  console.log("🛒 Tạo dịch vụ bán kèm...");

  await prisma.service.createMany({
    data: [
      {
        name: "Nước suối 500ml",
        type: "PRODUCT",
        price: 10000,
        stockQuantity: 100,
        facilityId: facility1.id,
      },
      {
        name: "Nước tăng lực Sting",
        type: "PRODUCT",
        price: 15000,
        stockQuantity: 50,
        facilityId: facility1.id,
      },
      {
        name: "Cho thuê vợt cầu lông",
        type: "RENTAL",
        price: 30000,
        stockQuantity: 10,
        facilityId: facility1.id,
      },
      {
        name: "Cho thuê giày thể thao",
        type: "RENTAL",
        price: 20000,
        stockQuantity: 5,
        facilityId: facility2.id,
      },
    ],
  });

  console.log("✅ Tạo 4 dịch vụ bán kèm");

  // ===================== 7. VOUCHERS =====================
  console.log("🎟️ Tạo voucher...");

await prisma.voucher.upsert({
  where: { code: "WELCOME20" },
  update: {},
  create: {
    code: "WELCOME20",
    discountType: "PERCENT",
    discountValue: 20,
    minOrderValue: 100000,
    maxDiscount: 50000,
    startDate: new Date("2026-01-01"),
    endDate: new Date("2026-12-31"),
    usageLimit: 100,
    ownerId: owner.id,
  },
});

await prisma.voucher.upsert({
  where: { code: "GIAM50K" },
  update: {},
  create: {
    code: "GIAM50K",
    discountType: "FIXED_AMOUNT",
    discountValue: 50000,
    minOrderValue: 200000,
    startDate: new Date("2026-01-01"),
    endDate: new Date("2026-06-30"),
    usageLimit: 50,
    ownerId: owner.id,
  },
});

  console.log("✅ Tạo 2 voucher");

  console.log("\n🎉 Seed data hoàn thành!");
  console.log("📋 Tài khoản test:");
  console.log("   Admin:    admin@sporthub.vn / 123456");
  console.log("   Owner:    owner@sporthub.vn / 123456");
  console.log("   Staff:    staff@sporthub.vn / 123456");
  console.log("   Customer: customer@sporthub.vn / 123456");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });