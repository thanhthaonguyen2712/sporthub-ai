"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";

interface PricingRule {
  dayType: string;
  startTime: string;
  endTime: string;
  pricePerHour: number;
}

interface Court {
  id: number;
  name: string;
  category: { id: number; name: string; iconUrl: string };
  pricingRules: PricingRule[];
}

interface Service {
  id: number;
  name: string;
  type: string;
  price: string;
  stockQuantity: number;
}

interface Review {
  id: number;
  rating: number;
  comment: string;
  createdAt: string;
  customer: { fullName: string };
}

interface Facility {
  id: number;
  name: string;
  address: string;
  description: string;
  owner: { fullName: string; phone: string };
  sports: { id: number; name: string; slug: string; iconUrl: string }[];
  courts: Court[];
  services: Service[];
  reviews: Review[];
  avgRating: string | null;
}

interface Slot {
  time: string;
  duration: number;
  isPeak: boolean;
  label: string;
  endLabel: string;
}

const ONE_HOUR_SPORTS = ["Bóng đá", "Bóng rổ"];
const GAP_RULE_SPORTS = ["Cầu lông", "Pickleball", "Tennis"];

function addMinutes(time: string, mins: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + mins;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function generateSlots(sportName: string): Slot[] {
  const isOneHour = ONE_HOUR_SPORTS.includes(sportName);
  const slots: Slot[] = [];

  for (let h = 6; h < 17; h++) {
    if (isOneHour) {
      const time = `${String(h).padStart(2, "0")}:00`;
      const end = addMinutes(time, 60);
      slots.push({ time, duration: 60, isPeak: false, label: `${time} – ${end}`, endLabel: end });
    } else {
      for (const m of [0, 30]) {
        const time = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
        const end = addMinutes(time, 30);
        slots.push({ time, duration: 30, isPeak: false, label: `${time} – ${end}`, endLabel: end });
      }
    }
  }

  slots.push({ time: "17:00", duration: 120, isPeak: true, label: "17:00 – 19:00", endLabel: "19:00" });
  slots.push({ time: "19:00", duration: 120, isPeak: true, label: "19:00 – 21:00", endLabel: "21:00" });

  if (isOneHour) {
    slots.push({ time: "21:00", duration: 60, isPeak: false, label: "21:00 – 22:00", endLabel: "22:00" });
  } else {
    slots.push({ time: "21:00", duration: 30, isPeak: false, label: "21:00 – 21:30", endLabel: "21:30" });
    slots.push({ time: "21:30", duration: 30, isPeak: false, label: "21:30 – 22:00", endLabel: "22:00" });
  }

  return slots;
}

function isValidSelection(
  slots: Slot[],
  selected: string[],
  newTime: string,
  sportName: string
): { valid: boolean; error: string } {
  return { valid: true, error: "" };
}

const MOCK_BOOKED: Record<number, string[]> = {
  1: ["07:00", "08:00", "17:00", "19:00"],
  2: ["08:00", "09:00", "19:00"],
  3: ["09:00", "17:00"],
  4: ["10:00", "10:30", "19:00"],
  5: ["07:30", "08:00", "17:00"],
};

function CourtSchedule({ court, selectedDate }: { court: Court; selectedDate: string }) {
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const booked = MOCK_BOOKED[court.id] || [];
  const sportName = court.category.name;
  const ALL_SLOTS = generateSlots(sportName);
  const isOneHour = ONE_HOUR_SPORTS.includes(sportName);
  const hasGapRule = GAP_RULE_SPORTS.includes(sportName);

  function getPrice(slot: Slot): number {
    if (slot.isPeak) return 160000;
    if (slot.duration === 60) return 80000;
    return 40000;
  }

  function toggleSlot(slotTime: string) {
    if (booked.includes(slotTime)) return;
    setErrorMsg("");

    if (selectedSlots.includes(slotTime)) {
      setSelectedSlots(selectedSlots.filter((s) => s !== slotTime));
      return;
    }

    const { valid, error } = isValidSelection(ALL_SLOTS, selectedSlots, slotTime, sportName);
    if (!valid) {
      setErrorMsg(error);
      return;
    }

    setSelectedSlots((prev) => [...prev, slotTime]);
  }

  const totalPrice = selectedSlots.reduce((sum, t) => {
    const slot = ALL_SLOTS.find((s) => s.time === t);
    return sum + (slot ? getPrice(slot) : 0);
  }, 0);

  const totalMinutes = selectedSlots.reduce((sum, t) => {
    const slot = ALL_SLOTS.find((s) => s.time === t);
    return sum + (slot?.duration || 0);
  }, 0);

  return (
    <div className="border border-gray-300 rounded-xl p-4 mb-4" style={{ background: "#E0EEE0" }}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <img src={court.category.iconUrl} className="w-8 h-8" alt={court.category.name} />
        <div>
          <p className="font-semibold text-black">{court.name}</p>
          <p className="text-gray-500 text-xs">
            {sportName} ·{" "}
            {isOneHour
              ? "Tối thiểu 1h · Đặt liên tiếp"
              : hasGapRule
              ? "30p/slot · Liên tiếp hoặc cách ≥1h"
              : "Tối thiểu 1h · Đặt liên tiếp"}
          </p>
        </div>
      </div>

      {/* Chú thích */}
      <div className="flex gap-3 text-xs mb-4 flex-wrap">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded inline-block" style={{ background: "#96CDCD", border: "1px solid #D1EEEE" }}></span>
          <span className="text-black">{isOneHour ? "Còn trống (80k/1h)" : "Còn trống (40k/30p)"}</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded inline-block" style={{ background: "#EED5D2" }}></span>
          <span className="text-black">Đã đặt</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded inline-block" style={{ background: "#9BCD9B" }}></span>
          <span className="text-black">Cao điểm (160k/2h)</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded inline-block" style={{ background: "#B0C4DE" }}></span>
          <span className="text-black">Đang chọn</span>
        </span>
      </div>

      {/* Slots */}
      <div className="flex flex-wrap gap-2 mb-3">
        {ALL_SLOTS.map((slot) => {
          const isBooked = booked.includes(slot.time);
          const isSelected = selectedSlots.includes(slot.time);

          let bgStyle: React.CSSProperties = {};
          let cls = "border rounded-lg text-xs font-medium transition-all text-left ";

          if (isBooked) {
            bgStyle = { background: "#EED5D2", borderColor: "#FFB5C5", color: "#000" };
            cls += "cursor-not-allowed ";
          } else if (isSelected) {
            bgStyle = { background: "#B0C4DE", borderColor: "#7a9cbf", color: "#000" };
            cls += "cursor-pointer ring-2 ring-blue-400";
          } else if (slot.isPeak) {
            bgStyle = { background: "#9BCD9B", borderColor: "#a8e050", color: "#000" };
            cls += "cursor-pointer hover:opacity-80";
          } else {
            bgStyle = { background: "#96CDCD", borderColor: "#D1EEEE", color: "#000" };
            cls += "cursor-pointer hover:opacity-80";
          }

          // Áp dụng chữ đậm cho tất cả các loại ô
          bgStyle.fontWeight = "bold";

          const pad = slot.isPeak ? "px-4 py-2.5" : "px-2.5 py-2";

          return (
            <button
              key={slot.time}
              onClick={() => toggleSlot(slot.time)}
              disabled={isBooked}
              className={`${cls} ${pad}`}
              style={bgStyle}
            >
              <div className="font-semibold text-[11px]">{slot.label}</div>
              <div className="text-[10px] opacity-70 mt-0.5">
                {slot.isPeak ? "160k/2h" : slot.duration === 60 ? "80k/1h" : "40k · 30p"}
              </div>
            </button>
          );
        })}
      </div>

      {/* Thông báo lỗi */}
      {errorMsg && (
        <p className="text-red-600 text-xs mb-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          ⚠️ {errorMsg}
        </p>
      )}

      {/* Tổng tiền */}
      {selectedSlots.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center justify-between mt-2">
          <div>
            <p className="text-xs text-gray-500">
              {selectedSlots.length} slot · {totalMinutes} phút
            </p>
            <p className="font-bold text-emerald-600 text-lg">
              {totalPrice.toLocaleString("vi-VN")}đ
            </p>
          </div>
          <button className="bg-emerald-500 hover:bg-emerald-400 text-white text-sm px-6 py-2.5 rounded-lg transition-colors font-medium">
            Đặt sân →
          </button>
        </div>
      )}
    </div>
  );
}

export default function FacilityDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [facility, setFacility] = useState<Facility | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("courts");
  const [selectedSport, setSelectedSport] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  useEffect(() => {
    fetch(`/api/facilities/${id}`)
      .then((r) => r.json())
      .then((data) => { setFacility(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen" style={{ fontFamily: "Arial, sans-serif", background: "linear-gradient(to right, #DDEFBB, #FFEEEE)" }}>
        <Navbar />
        <div className="max-w-6xl mx-auto px-6 py-10">
          <div className="h-40 rounded-2xl animate-pulse" style={{ background: "#E0EEE0" }} />
        </div>
      </div>
    );
  }

  if (!facility) {
    return (
      <div className="min-h-screen" style={{ fontFamily: "Arial, sans-serif", background: "linear-gradient(to right, #DDEFBB, #FFEEEE)" }}>
        <Navbar />
        <div className="text-center py-20 text-gray-500">Không tìm thấy sân</div>
      </div>
    );
  }

  const sportGroups = facility.sports
    .map((sport) => ({
      sport,
      courts: facility.courts.filter((c) => c.category.id === sport.id),
    }))
    .filter((g) => g.courts.length > 0);

  const filteredGroups = selectedSport
    ? sportGroups.filter((g) => g.sport.id === selectedSport)
    : sportGroups;

  const tabs = [
    { id: "courts", label: `🏸 Danh sách sân (${facility.courts.length})` },
    { id: "services", label: `🛒 Dịch vụ (${facility.services.length})` },
    { id: "reviews", label: `⭐ Đánh giá (${facility.reviews.length})` },
  ];

  return (
    <div className="min-h-screen text-black" style={{ fontFamily: "Arial, sans-serif", background: "linear-gradient(to right, #DDEFBB, #FFEEEE)" }}>
      <Navbar />
      <div className="max-w-6xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="border border-gray-300 rounded-2xl p-6 mb-6 flex items-start justify-between" style={{ background: "#B4EEB4" }}>
          <div className="flex items-start gap-5">
            <div className="w-16 h-16 bg-white rounded-xl flex items-center justify-center border border-gray-200 flex-shrink-0">
              {facility.sports[0] && <img src={facility.sports[0].iconUrl} className="w-10 h-10" alt={facility.sports[0].name} />}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-black mb-1">{facility.name}</h1>
              <p className="text-gray-500 text-sm mb-2">📍 {facility.address}</p>
              <div className="flex gap-2 flex-wrap mb-2">
                {facility.sports.map((s) => (
                  <span key={s.id} className="flex items-center gap-1 bg-white border border-gray-200 text-gray-700 text-xs px-2 py-1 rounded-full">
                    <img src={s.iconUrl} className="w-4 h-4" alt={s.name} />{s.name}
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <span>🏸 {facility.courts.length} sân</span>
                <span>📞 {facility.owner.phone}</span>
                {facility.avgRating && <span>⭐ {facility.avgRating}</span>}
              </div>
              {facility.description && <p className="text-gray-600 text-sm mt-2">{facility.description}</p>}
            </div>
          </div>
          <button className="bg-emerald-500 hover:bg-emerald-400 text-white font-semibold px-6 py-3 rounded-xl transition-colors flex-shrink-0">
            Đặt sân ngay
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-5">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors border ${
                activeTab === tab.id
                  ? "bg-emerald-500 text-white border-emerald-500"
                  : "bg-white text-gray-600 border-gray-300 hover:border-emerald-400"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab: Danh sách sân */}
        {activeTab === "courts" && (
          <div>
            <div className="flex items-center gap-3 mb-5">
              <label className="text-sm font-medium text-gray-700">📅 Chọn ngày:</label>
              <input
                type="date"
                value={selectedDate}
                min={new Date().toISOString().split("T")[0]}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-white border border-gray-300 text-black rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-emerald-400"
              />
            </div>

            <div className="flex gap-2 flex-wrap mb-6">
              <button
                onClick={() => setSelectedSport(null)}
                className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
                  selectedSport === null
                    ? "bg-emerald-500 text-white border-emerald-500"
                    : "bg-white text-gray-600 border-gray-300 hover:border-emerald-400"
                }`}
              >
                Tất cả sân
              </button>
              {facility.sports.map((sport) => (
                <button
                  key={sport.id}
                  onClick={() => setSelectedSport(selectedSport === sport.id ? null : sport.id)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
                    selectedSport === sport.id
                      ? "bg-emerald-500 text-white border-emerald-500"
                      : "bg-white text-gray-600 border-gray-300 hover:border-emerald-400"
                  }`}
                >
                  <img src={sport.iconUrl} className="w-4 h-4" alt={sport.name} />
                  {sport.name}
                </button>
              ))}
            </div>

            {filteredGroups.length === 0 ? (
              <div className="text-center py-10 text-gray-500">Không có sân nào</div>
            ) : (
              filteredGroups.map((group) => (
                <div key={group.sport.id} className="mb-6">
                  <div className="flex items-center gap-2 mb-4">
                    <img src={group.sport.iconUrl} className="w-5 h-5" alt={group.sport.name} />
                    <h3 className="font-bold text-black text-base">Sân {group.sport.name}</h3>
                    <div className="flex-1 h-0.5 bg-emerald-400 rounded ml-1" />
                  </div>
                  {group.courts.map((court) => (
                    <CourtSchedule key={court.id} court={court} selectedDate={selectedDate} />
                  ))}
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab: Dịch vụ */}
        {activeTab === "services" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {facility.services.length === 0 ? (
              <p className="text-gray-500 text-sm col-span-3 text-center py-10">Chưa có dịch vụ</p>
            ) : (
              facility.services.map((s) => (
                <div key={s.id} className="border border-gray-300 rounded-xl p-4" style={{ background: "#E0EEE0" }}>
                  <div className="flex items-start justify-between mb-2">
                    <p className="font-semibold text-black text-sm">{s.name}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${s.type === "RENTAL" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"}`}>
                      {s.type === "RENTAL" ? "Thuê" : "Mua"}
                    </span>
                  </div>
                  <p className="text-emerald-600 font-bold text-sm">{Number(s.price).toLocaleString("vi-VN")}đ</p>
                  <p className="text-gray-400 text-xs mt-1">Còn {s.stockQuantity} sản phẩm</p>
                  <button className="mt-3 w-full bg-white border border-emerald-400 text-emerald-600 hover:bg-emerald-50 text-sm py-2 rounded-lg transition-colors">
                    + Thêm vào đơn
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab: Đánh giá */}
        {activeTab === "reviews" && (
          <div className="space-y-4">
            {facility.reviews.length === 0 ? (
              <div className="text-center py-16 text-gray-500 border border-gray-300 rounded-2xl" style={{ background: "#E0EEE0" }}>
                <div className="text-5xl mb-3">⭐</div>
                <p className="text-sm">Chưa có đánh giá nào</p>
                <p className="text-xs mt-1 text-gray-400">Hãy là người đầu tiên đánh giá!</p>
              </div>
            ) : (
              facility.reviews.map((r) => (
                <div key={r.id} className="border border-gray-300 rounded-xl p-4" style={{ background: "#E0EEE0" }}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-semibold text-black text-sm">{r.customer.fullName}</p>
                    <span className="text-yellow-500 text-sm">{"⭐".repeat(r.rating)}</span>
                  </div>
                  {r.comment && <p className="text-gray-600 text-sm">{r.comment}</p>}
                  <p className="text-gray-400 text-xs mt-2">{new Date(r.createdAt).toLocaleDateString("vi-VN")}</p>
                </div>
              ))
            )}
          </div>
        )}

        <button onClick={() => router.back()} className="mt-8 text-sm text-gray-500 hover:text-black transition-colors">
          ← Quay lại
        </button>
      </div>
    </div>
  );
}