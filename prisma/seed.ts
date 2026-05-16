import { PrismaClient } from "../src/generated/prisma";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// ── Geocoding helpers ─────────────────────────────────────────────────────────
function stripAdminPrefixes(text: string): string {
  return text
    .replace(/^(Thành phố|Thành Phố|TP\.|TP |Tỉnh|Quận|Huyện|Thị xã|Thị Xã|Thị trấn|Thị Trấn|Phường|Xã)\s+/gi, "")
    .trim();
}

async function nominatimSearch(query: string): Promise<{ lat: number; lng: number } | null> {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=vn`,
    { headers: { "Accept-Language": "vi", "User-Agent": "SportHubAI/1.0 (seed)" } }
  );
  if (!res.ok) return null;
  const data = await res.json() as Array<{ lat: string; lon: string }>;
  if (Array.isArray(data) && data.length > 0) return { lat: Number(data[0].lat), lng: Number(data[0].lon) };
  return null;
}

async function geocodeFacilityAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  const simplified = address.split(", ").map(stripAdminPrefixes).filter(Boolean).join(", ");
  const parts = simplified.split(", ").filter(Boolean);
  const candidates = [
    simplified + ", Việt Nam",
    parts.length >= 3 ? parts.slice(1).join(", ") + ", Việt Nam" : "",
    parts.length >= 2 ? parts.slice(-2).join(", ") + ", Việt Nam" : "",
  ].filter(Boolean);
  for (const candidate of candidates) {
    const result = await nominatimSearch(candidate);
    if (result) return result;
    await new Promise(r => setTimeout(r, 300));
  }
  return null;
}

async function geocodeAllFacilities() {
  const facilities = await prisma.facility.findMany({ select: { id: true, name: true, address: true } });
  console.log(`\n📍 Geocoding ${facilities.length} cơ sở sân...`);
  for (const f of facilities) {
    await new Promise(r => setTimeout(r, 1100)); // Nominatim rate limit
    const coords = await geocodeFacilityAddress(f.address);
    if (coords) {
      await prisma.facility.update({ where: { id: f.id }, data: { latitude: coords.lat, longitude: coords.lng } });
      console.log(`  ✓ ${f.name} → (${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)})`);
    } else {
      console.log(`  ✗ ${f.name} — không tìm thấy tọa độ`);
    }
  }
  console.log("✅ Geocoding hoàn tất");
}

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

  console.log("✅ Tạo users (owner, staff, customer)");

  // ===================== 3. FACILITIES =====================
  console.log("🏟️ Tạo cơ sở sân...");

  const facility1 = await prisma.facility.upsert({
    where: { id: 1 },
    update: { latitude: null, longitude: null },
    create: {
      name: "Sân thể thao Hòa Xuân",
      address: "123 Hòa Xuân, Cẩm Lệ, Đà Nẵng",
      description: "Cụm sân thể thao hiện đại tại Hòa Xuân với đầy đủ tiện nghi",
      latitude: null,
      longitude: null,
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
    update: { latitude: null, longitude: null },
    create: {
      name: "SportHub Ngũ Hành Sơn",
      address: "456 Trường Sa, Ngũ Hành Sơn, Đà Nẵng",
      description: "Sân Pickleball & Tennis chuẩn quốc tế gần biển Mỹ Khê",
      latitude: null,
      longitude: null,
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

  const facility3 = await prisma.facility.upsert({
    where: { id: 3 },
    update: { latitude: null, longitude: null },
    create: {
      name: "Arena Sport Liên Chiểu",
      address: "768 Nguyễn Lương Bằng, Liên Chiểu, Đà Nẵng",
      description: "Cụm sân bóng đá và bóng rổ chuẩn thi đấu tại Liên Chiểu",
      latitude: null,
      longitude: null,
      isActive: true,
      ownerId: owner.id,
      facilitySports: {
        create: [
          { sportCategoryId: sports[0].id }, // Bóng đá
          { sportCategoryId: sports[3].id }, // Bóng rổ
        ],
      },
    },
  });

  const facility4 = await prisma.facility.upsert({
    where: { id: 4 },
    update: { latitude: null, longitude: null },
    create: {
      name: "Cầu lông Thanh Khê",
      address: "45 Điện Biên Phủ, Thanh Khê, Đà Nẵng",
      description: "Hệ thống 8 sân cầu lông trong nhà, đầy đủ ánh sáng và điều hòa",
      latitude: null,
      longitude: null,
      isActive: true,
      ownerId: owner.id,
      facilitySports: {
        create: [
          { sportCategoryId: sports[1].id }, // Cầu lông
        ],
      },
    },
  });

  const facility5 = await prisma.facility.upsert({
    where: { id: 5 },
    update: { latitude: null, longitude: null },
    create: {
      name: "Green Court Hải Châu",
      address: "12 Lý Tự Trọng, Hải Châu, Đà Nẵng",
      description: "Sân Tennis và Pickleball cao cấp ngay trung tâm thành phố",
      latitude: null,
      longitude: null,
      isActive: true,
      ownerId: owner.id,
      facilitySports: {
        create: [
          { sportCategoryId: sports[4].id }, // Tennis
          { sportCategoryId: sports[2].id }, // Pickleball
        ],
      },
    },
  });

  const facility6 = await prisma.facility.upsert({
    where: { id: 6 },
    update: { latitude: null, longitude: null },
    create: {
      name: "Hoà Khánh Sport Center",
      address: "234 Hoàng Văn Thái, Liên Chiểu, Đà Nẵng",
      description: "Trung tâm thể thao đa năng phục vụ cộng đồng khu vực Hoà Khánh",
      latitude: null,
      longitude: null,
      isActive: true,
      ownerId: owner.id,
      facilitySports: {
        create: [
          { sportCategoryId: sports[0].id }, // Bóng đá
          { sportCategoryId: sports[1].id }, // Cầu lông
          { sportCategoryId: sports[3].id }, // Bóng rổ
        ],
      },
    },
  });

  const facility7 = await prisma.facility.upsert({
    where: { id: 7 },
    update: { latitude: null, longitude: null },
    create: {
      name: "Pickleball Sơn Trà",
      address: "67 Phạm Văn Đồng, Sơn Trà, Đà Nẵng",
      description: "Sân Pickleball chuẩn quốc tế view biển Sơn Trà tuyệt đẹp",
      latitude: null,
      longitude: null,
      isActive: true,
      ownerId: owner.id,
      facilitySports: {
        create: [
          { sportCategoryId: sports[2].id }, // Pickleball
        ],
      },
    },
  });

  const facility8 = await prisma.facility.upsert({
    where: { id: 8 },
    update: { latitude: null, longitude: null },
    create: {
      name: "Vũng Thùng Basketball Arena",
      address: "89 Võ Nguyên Giáp, Sơn Trà, Đà Nẵng",
      description: "Sân bóng rổ trong nhà và ngoài trời chuẩn thi đấu tại Mỹ Khê",
      latitude: null,
      longitude: null,
      isActive: true,
      ownerId: owner.id,
      facilitySports: {
        create: [
          { sportCategoryId: sports[3].id }, // Bóng rổ
          { sportCategoryId: sports[0].id }, // Bóng đá
        ],
      },
    },
  });

  console.log("✅ Tạo 8 cơ sở sân");

  // Geocode tất cả facilities sau khi tạo xong
  await geocodeAllFacilities();

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
  console.log("   (admin removed)");
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