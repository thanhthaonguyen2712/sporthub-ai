"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import {
  generateCourtSlots, getSlotPrice, getSlotPriceLabel,
  isHoliday, isWeekend, CourtSlot,
} from "@/lib/court-slots";

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

function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

const GAP_RULE_SPORTS = ["Cầu lông", "Pickleball", "Tennis"];
const ONE_HOUR_SPORTS_CUSTOMER = ["Bóng đá", "Bóng rổ"];

function CourtSchedule({ court, selectedDate, facilityId }: { court: Court; selectedDate: string; facilityId: number }) {
  const router = useRouter();
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);
  const [booked, setBooked] = useState<string[]>([]);

  useEffect(() => {
    if (!selectedDate) return;
    setSelectedSlots([]);
    fetch(`/api/courts/${court.id}/booked-slots?date=${selectedDate}`)
      .then((r) => r.json())
      .then((data) => setBooked(data.bookedSlots || []));
  }, [court.id, selectedDate]);

  const sportName = court.category.name;
  const ALL_SLOTS: CourtSlot[] = generateCourtSlots(sportName, selectedDate);
  const isOneHour = ONE_HOUR_SPORTS_CUSTOMER.includes(sportName);
  const hasGapRule = GAP_RULE_SPORTS.includes(sportName);
  const holiday = isHoliday(selectedDate);
  const weekend = isWeekend(selectedDate);

  // Tính giờ hiện tại theo giờ Việt Nam (UTC+7)
  const nowVN = new Date(new Date().getTime() + 7 * 60 * 60 * 1000);
  const todayVN = nowVN.toISOString().split("T")[0];
  const nowMinutes = nowVN.getUTCHours() * 60 + nowVN.getUTCMinutes();
  const isToday = selectedDate === todayVN;

  function isPastSlot(slotTime: string): boolean {
    return isToday && toMinutes(slotTime) < nowMinutes;
  }

  function toggleSlot(slotTime: string) {
    if (booked.includes(slotTime) || isPastSlot(slotTime)) return;
    setSelectedSlots((prev) =>
      prev.includes(slotTime) ? prev.filter((s) => s !== slotTime) : [...prev, slotTime]
    );
  }

  const totalPrice = selectedSlots.reduce((sum, t) => {
    const slot = ALL_SLOTS.find((s) => s.time === t);
    return sum + (slot ? getSlotPrice(slot, selectedDate) : 0);
  }, 0);

  const totalMinutes = selectedSlots.reduce((sum, t) => {
    const slot = ALL_SLOTS.find((s) => s.time === t);
    return sum + (slot?.duration || 0);
  }, 0);

  return (
    <div className="border border-gray-300 rounded-xl p-4 mb-4" style={{ background: "#E0EEE0" }}>
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          <img src={court.category.iconUrl} className="w-8 h-8" alt={court.category.name} />
          <div>
            <p className="font-semibold text-black">{court.name}</p>
            <p className="text-gray-500 text-xs">
              {sportName} ·{" "}
              {isOneHour ? "Tối thiểu 1h · Đặt liên tiếp" : hasGapRule ? "30p/slot · Liên tiếp hoặc cách ≥1h" : "Tối thiểu 1h · Đặt liên tiếp"}
            </p>
          </div>
        </div>
        <div className="flex gap-1 shrink-0">
          {weekend && !holiday && <span className="text-[10px] bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full font-medium">Cuối tuần</span>}
          {holiday && <span className="text-[11px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">Ngày lễ +15%</span>}
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
        {(weekend || holiday) && (
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded inline-block" style={{ background: "#FFD580" }}></span>
            <span className="text-black">Cao điểm sáng 7–9h</span>
          </span>
        )}
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded inline-block" style={{ background: "#9BCD9B" }}></span>
          <span className="text-black">Cao điểm chiều {holiday ? "(+15%)" : "(160k/2h)"}</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded inline-block" style={{ background: "#B0C4DE" }}></span>
          <span className="text-black">Đang chọn</span>
        </span>
        {isToday && (
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded inline-block" style={{ background: "#D1D5DB", border: "1px solid #9CA3AF" }}></span>
            <span className="text-black">Đã qua</span>
          </span>
        )}
      </div>

      {/* Slots */}
      <div className="flex flex-wrap gap-2 mb-3">
        {ALL_SLOTS.map((slot) => {
          const isBooked = booked.includes(slot.time);
          const isPast = isPastSlot(slot.time);
          const isSelected = selectedSlots.includes(slot.time);

          let bgStyle: React.CSSProperties = { fontWeight: "bold" };
          let cls = "border rounded-lg text-xs font-medium transition-all text-left ";

          if (isPast) {
            bgStyle = { ...bgStyle, background: "#D1D5DB", borderColor: "#9CA3AF", color: "#6B7280" };
            cls += "cursor-not-allowed opacity-60 ";
          } else if (isBooked) {
            bgStyle = { ...bgStyle, background: "#EED5D2", borderColor: "#FFB5C5", color: "#000" };
            cls += "cursor-not-allowed ";
          } else if (isSelected) {
            bgStyle = { ...bgStyle, background: "#B0C4DE", borderColor: "#7a9cbf", color: "#000" };
            cls += "cursor-pointer ring-2 ring-blue-400";
          } else if (slot.isMorningPeak) {
            bgStyle = { ...bgStyle, background: "#FFD580", borderColor: "#FFC107", color: "#000" };
            cls += "cursor-pointer hover:opacity-80";
          } else if (slot.isPeak) {
            bgStyle = { ...bgStyle, background: "#9BCD9B", borderColor: "#a8e050", color: "#000" };
            cls += "cursor-pointer hover:opacity-80";
          } else {
            bgStyle = { ...bgStyle, background: "#96CDCD", borderColor: "#D1EEEE", color: "#000" };
            cls += "cursor-pointer hover:opacity-80";
          }

          const pad = slot.isPeak ? "px-4 py-2.5" : "px-2.5 py-2";

          return (
            <button key={slot.time} onClick={() => toggleSlot(slot.time)} disabled={isBooked || isPast}
              className={`${cls} ${pad}`} style={bgStyle}>
              <div className="font-semibold text-[11px]">{slot.label}</div>
              <div className="text-[10px] opacity-70 mt-0.5">{getSlotPriceLabel(slot, selectedDate)}</div>
            </button>
          );
        })}
      </div>

      {/* Tổng tiền */}
      {selectedSlots.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center justify-between mt-2">
          <div>
            <p className="text-xs text-gray-500">{selectedSlots.length} slot · {totalMinutes} phút{holiday ? " · Ngày lễ" : ""}</p>
            <p className="font-bold text-emerald-600 text-lg">{totalPrice.toLocaleString("vi-VN")}đ</p>
          </div>
          <button onClick={() => {
              const sorted = [...selectedSlots].sort((a, b) => toMinutes(a) - toMinutes(b));
              const endSlot = ALL_SLOTS.find((s) => s.time === sorted[sorted.length - 1])!;
              const params = new URLSearchParams({
                courtId: String(court.id), facilityId: String(facilityId),
                date: selectedDate, start: sorted[0], end: endSlot.end, price: String(totalPrice),
              });
              router.push(`/bookings?${params}`);
            }}
            className="bg-emerald-500 hover:bg-emerald-400 text-white text-sm px-6 py-2.5 rounded-lg transition-colors font-medium">
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
  new Date(new Date().getTime() + 7 * 60 * 60 * 1000).toISOString().split("T")[0]
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
    { id: "courts", icon: <img src="/list.png" className="w-4 h-4 inline-block" alt="list" />, label: `Danh sách sân (${facility.courts.length})` },
    { id: "services", icon: <img src="/shopping-cart.png" className="w-4 h-4 inline-block" alt="cart" />, label: `Dịch vụ (${facility.services.length})` },
    { id: "reviews", icon: <img src="/star.png" className="w-4 h-4 inline-block" alt="star" />, label: `Đánh giá (${facility.reviews.length})` },
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
              <p className="text-gray-500 text-sm mb-2 flex items-center gap-1"><img src="/placeholder.png" className="w-4 h-4 inline-block" alt="location" /> {facility.address}</p>
              <div className="flex gap-2 flex-wrap mb-2">
                {facility.sports.map((s) => (
                  <span key={s.id} className="flex items-center gap-1 bg-white border border-gray-200 text-gray-700 text-xs px-2 py-1 rounded-full">
                    <img src={s.iconUrl} className="w-4 h-4" alt={s.name} />{s.name}
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <span>{facility.courts.length} sân</span>
                <span className="flex items-center gap-1"><img src="/call.png" className="w-4 h-4 inline-block" alt="call" /> {facility.owner.phone}</span>
                {facility.avgRating && <span className="flex items-center gap-1"><img src="/star.png" alt="" className="w-3 h-3" />{facility.avgRating}</span>}
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
              <span className="flex items-center gap-1">{tab.icon} {tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab: Danh sách sân */}
        {activeTab === "courts" && (
          <div>
            <div className="flex items-center gap-3 mb-5">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-1"><img src="/calendar.png" className="w-4 h-4 inline-block" alt="calendar" /> Chọn ngày:</label>
              <input
                type="date"
                value={selectedDate}
                min={new Date(new Date().getTime() + 7 * 60 * 60 * 1000).toISOString().split("T")[0]}
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
                    <CourtSchedule key={court.id} court={court} selectedDate={selectedDate} facilityId={facility.id} />
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
                <div className="flex justify-center mb-3"><img src="/star.png" alt="" className="w-12 h-12 opacity-40" /></div>
                <p className="text-sm">Chưa có đánh giá nào</p>
                <p className="text-xs mt-1 text-gray-400">Hãy là người đầu tiên đánh giá!</p>
              </div>
            ) : (
              facility.reviews.map((r) => (
                <div key={r.id} className="border border-gray-300 rounded-xl p-4" style={{ background: "#E0EEE0" }}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-semibold text-black text-sm">{r.customer.fullName}</p>
                    <span className="flex items-center gap-0.5">{Array.from({ length: r.rating }).map((_, i) => <img key={i} src="/star.png" alt="" className="w-3.5 h-3.5" />)}</span>
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