import { NextRequest, NextResponse } from "next/server";

// Nominatim không nhận diện được tiền tố hành chính Việt Nam
// VD: "Quận Hải Châu" → "Hải Châu", "Thành phố Đà Nẵng" → "Đà Nẵng"
function stripAdminPrefixes(text: string): string {
  return text
    .replace(
      /^(Thành phố|Thành Phố|TP\.|TP |Tỉnh|Quận|Huyện|Thị xã|Thị Xã|Thị trấn|Thị Trấn|Phường|Xã)\s+/gi,
      ""
    )
    .trim();
}

function simplifyAddress(address: string): string {
  return address
    .split(", ")
    .map((part) => stripAdminPrefixes(part))
    .filter(Boolean)
    .join(", ");
}

async function nominatimSearch(query: string): Promise<{ lat: string; lon: string } | null> {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=vn`,
    {
      headers: {
        "Accept-Language": "vi",
        "User-Agent": "SportHubAI/1.0 (sports-court-booking-app)",
      },
    }
  );
  if (!res.ok) return null;
  const data = await res.json();
  if (Array.isArray(data) && data.length > 0) return { lat: data[0].lat, lon: data[0].lon };
  return null;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get("address");

  if (!address || !address.trim()) {
    return NextResponse.json({ error: "Thiếu địa chỉ" }, { status: 400 });
  }

  try {
    const raw = address.trim();
    const simplified = simplifyAddress(raw);

    // Chiến lược fallback: thử lần lượt từ chi tiết → khái quát
    const parts = simplified.split(", ").filter(Boolean);

    const candidates: string[] = [
      // 1. Địa chỉ đã strip prefix (đầy đủ)
      simplified + ", Việt Nam",
      // 2. Bỏ phần đầu (số nhà/đường) nếu có ≥3 phần → chỉ giữ quận + tỉnh
      parts.length >= 3 ? parts.slice(1).join(", ") + ", Việt Nam" : "",
      // 3. Chỉ quận + tỉnh (2 phần cuối)
      parts.length >= 2 ? parts.slice(-2).join(", ") + ", Việt Nam" : "",
      // 4. Chỉ tỉnh/thành phố
      parts.length >= 1 ? parts[parts.length - 1] + ", Việt Nam" : "",
    ].filter(Boolean);

    for (const candidate of candidates) {
      const result = await nominatimSearch(candidate);
      if (result) {
        return NextResponse.json({ lat: result.lat, lng: result.lon });
      }
      // Nominatim rate limit: tối thiểu 1 req/sec
      await new Promise((r) => setTimeout(r, 200));
    }

    return NextResponse.json(
      { error: "Không tìm thấy tọa độ cho địa chỉ này" },
      { status: 404 }
    );
  } catch (error) {
    console.error("[geocode] error:", error);
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}
