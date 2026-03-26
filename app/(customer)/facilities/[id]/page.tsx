"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
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

interface MatchPost {
  id: number;
  title: string;
  description: string | null;
  matchDate: string;
  startTime: string;
  endTime: string;
  level: string;
  status: string;
  requiredPlayers: number;
  joinedPlayers: number;
  remaining: number;
  facility: { id: number; name: string; address: string };
  sport: { id: number; name: string; iconUrl: string };
  creator: { id: number; fullName: string };
  courtName: string | null;
  pricePerPerson: number | null;
  totalPrice: number | null;
}

const LEVEL_LABEL: Record<string, string> = {
  BEGINNER: "Người mới",
  INTERMEDIATE: "Trung bình",
  PRO: "Chuyên nghiệp",
};

export default function FacilityDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const [facility, setFacility] = useState<Facility | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("courts");
  const [hasReviewed, setHasReviewed] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewToast, setReviewToast] = useState("");
  const [selectedSport, setSelectedSport] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState(
  new Date(new Date().getTime() + 7 * 60 * 60 * 1000).toISOString().split("T")[0]
);
  // Tìm đồng đội
  const [matchPosts, setMatchPosts] = useState<MatchPost[]>([]);
  const [matchPostsLoading, setMatchPostsLoading] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);
  const [joinModal, setJoinModal] = useState<MatchPost | null>(null);
  const [joining, setJoining] = useState(false);
  const [joinToast, setJoinToast] = useState("");
  // Form đăng tìm đồng đội trong tab
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState({
    categoryId: "", courtId: "", courtName: "",
    matchDate: new Date(new Date().getTime() + 7 * 60 * 60 * 1000).toISOString().split("T")[0],
    startTime: "", endTime: "",
    level: "BEGINNER", requiredPlayers: "4", description: "", totalPrice: "",
  });
  const [createSelectedSlots, setCreateSelectedSlots] = useState<string[]>([]);
  const [createBookedSlots, setCreateBookedSlots] = useState<string[]>([]);
  const [createLoadingSlots, setCreateLoadingSlots] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createFilteredCourts, setCreateFilteredCourts] = useState<Court[]>([]);

  useEffect(() => {
    fetch(`/api/facilities/${id}`)
      .then((r) => r.json())
      .then((data) => { setFacility(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (session && id) {
      fetch("/api/reviews")
        .then((r) => r.json())
        .then((d) => setHasReviewed((d.reviewed || []).includes(Number(id))));
      fetch("/api/wallet")
        .then((r) => r.json())
        .then((d) => setWalletBalance(Number(d.balance) || 0));
    }
  }, [session, id]);

  useEffect(() => {
    if (activeTab === "teammate" && id) {
      setMatchPostsLoading(true);
      fetch(`/api/match-posts?facilityId=${id}&status=OPEN`)
        .then((r) => r.json())
        .then((data) => { setMatchPosts(Array.isArray(data) ? data : []); setMatchPostsLoading(false); })
        .catch(() => setMatchPostsLoading(false));
    }
  }, [activeTab, id]);

  async function handleJoin(post: MatchPost) {
    if (!session) { router.push("/login"); return; }
    setJoining(true);
    const res = await fetch(`/api/match-posts/${post.id}/join`, { method: "POST" });
    const data = await res.json();
    setJoining(false);
    setJoinModal(null);
    if (res.ok) {
      setJoinToast("Tham gia thành công!");
      // Reload match posts
      fetch(`/api/match-posts?facilityId=${id}&status=OPEN`)
        .then((r) => r.json())
        .then((data) => setMatchPosts(Array.isArray(data) ? data : []));
      if (session) {
        fetch("/api/wallet").then((r) => r.json()).then((d) => setWalletBalance(Number(d.balance) || 0));
      }
    } else {
      setJoinToast(data.error || "Tham gia thất bại!");
    }
    setTimeout(() => setJoinToast(""), 4000);
  }

  // Handlers cho form tạo bài tìm đồng đội trong tab
  function handleCreateSportChange(categoryId: string) {
    setCreateForm((f) => ({ ...f, categoryId, courtId: "", courtName: "", startTime: "", endTime: "", totalPrice: "" }));
    setCreateSelectedSlots([]);
    setCreateBookedSlots([]);
    if (facility && categoryId) {
      setCreateFilteredCourts(facility.courts.filter((c) => String(c.category.id) === categoryId));
    } else {
      setCreateFilteredCourts([]);
    }
  }

  function handleCreateCourtChange(courtId: string) {
    const court = createFilteredCourts.find((c) => String(c.id) === courtId);
    setCreateForm((f) => ({ ...f, courtId, courtName: court?.name || "", startTime: "", endTime: "", totalPrice: "" }));
    setCreateSelectedSlots([]);
    if (courtId && createForm.matchDate) loadCreateBookedSlots(courtId, createForm.matchDate);
  }

  function handleCreateDateChange(matchDate: string) {
    setCreateForm((f) => ({ ...f, matchDate, startTime: "", endTime: "", totalPrice: "" }));
    setCreateSelectedSlots([]);
    if (createForm.courtId && matchDate) loadCreateBookedSlots(createForm.courtId, matchDate);
  }

  async function loadCreateBookedSlots(courtId: string, date: string) {
    setCreateLoadingSlots(true);
    const data = await fetch(`/api/courts/${courtId}/booked-slots?date=${date}`).then((r) => r.json());
    setCreateBookedSlots(data.bookedSlots || []);
    setCreateLoadingSlots(false);
  }

  function toggleCreateSlot(slotTime: string, allSlots: CourtSlot[], sportName: string) {
    if (createBookedSlots.includes(slotTime)) return;
    const nowVN2 = new Date(new Date().getTime() + 7 * 60 * 60 * 1000);
    const todayVN2 = nowVN2.toISOString().split("T")[0];
    const nowMin2 = nowVN2.getUTCHours() * 60 + nowVN2.getUTCMinutes();
    if (createForm.matchDate === todayVN2 && toMinutes(slotTime) < nowMin2) return;

    const newSlots = createSelectedSlots.includes(slotTime)
      ? createSelectedSlots.filter((s) => s !== slotTime)
      : [...createSelectedSlots, slotTime];
    setCreateSelectedSlots(newSlots);

    if (newSlots.length === 0) {
      setCreateForm((f) => ({ ...f, startTime: "", endTime: "", totalPrice: "" }));
    } else {
      const sorted = [...newSlots].sort((a, b) => toMinutes(a) - toMinutes(b));
      const lastSlot = allSlots.find((s) => s.time === sorted[sorted.length - 1]);
      const total = newSlots.reduce((sum, t) => {
        const slot = allSlots.find((s) => s.time === t);
        return sum + (slot ? getSlotPrice(slot, createForm.matchDate) : 0);
      }, 0);
      setCreateForm((f) => ({ ...f, startTime: sorted[0], endTime: lastSlot?.end || "", totalPrice: String(total) }));
    }
  }

  async function handleCreateSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!session) { router.push("/login"); return; }
    if (!createForm.categoryId || !createForm.courtId || !createForm.matchDate || !createForm.startTime || !createForm.endTime) {
      setJoinToast("Vui lòng chọn sân và khung giờ!");
      setTimeout(() => setJoinToast(""), 3000);
      return;
    }
    setCreateSubmitting(true);
    const res = await fetch("/api/match-posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        facilityId: Number(id),
        categoryId: Number(createForm.categoryId),
        matchDate: createForm.matchDate,
        startTime: createForm.startTime,
        endTime: createForm.endTime,
        level: createForm.level,
        requiredPlayers: Number(createForm.requiredPlayers),
        description: createForm.description,
        courtName: createForm.courtName,
        totalPrice: createForm.totalPrice ? Number(createForm.totalPrice) : undefined,
      }),
    });
    const data = await res.json();
    setCreateSubmitting(false);
    if (res.ok) {
      setJoinToast("Đã đăng bài tìm đồng đội!");
      setShowCreateForm(false);
      setCreateForm({
        categoryId: "", courtId: "", courtName: "",
        matchDate: new Date(new Date().getTime() + 7 * 60 * 60 * 1000).toISOString().split("T")[0],
        startTime: "", endTime: "",
        level: "BEGINNER", requiredPlayers: "4", description: "", totalPrice: "",
      });
      setCreateSelectedSlots([]);
      setCreateBookedSlots([]);
      setCreateFilteredCourts([]);
      // Reload match posts
      fetch(`/api/match-posts?facilityId=${id}&status=OPEN`)
        .then((r) => r.json())
        .then((d) => setMatchPosts(Array.isArray(d) ? d : []));
    } else {
      setJoinToast(data.error || "Có lỗi xảy ra!");
    }
    setTimeout(() => setJoinToast(""), 4000);
  }

  async function submitFacilityReview() {
    if (!reviewRating) return;
    setReviewSubmitting(true);
    const res = await fetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ facilityId: Number(id), rating: reviewRating, comment: reviewComment }),
    });
    const data = await res.json();
    setReviewSubmitting(false);
    if (res.ok) {
      setHasReviewed(true);
      setShowReviewForm(false);
      setReviewRating(0);
      setReviewComment("");
      setReviewToast("Cảm ơn bạn đã đánh giá!");
      // Reload để hiển thị review mới
      fetch(`/api/facilities/${id}`).then(r => r.json()).then(data => setFacility(data));
    } else {
      setReviewToast(data.error || "Có lỗi xảy ra!");
    }
    setTimeout(() => setReviewToast(""), 4000);
  }

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
    { id: "teammate", icon: <img src="/group.png" className="w-4 h-4 inline-block" alt="group" />, label: "Tìm đồng đội" },
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

        {/* Tab: Tìm đồng đội */}
        {activeTab === "teammate" && (
          <div>
            {joinToast && (
              <div className={`mb-4 px-4 py-3 rounded-xl text-sm font-medium text-white ${joinToast.includes("thành công") ? "bg-emerald-500" : "bg-red-500"}`}>
                {joinToast}
              </div>
            )}

            {/* Nút đăng bài */}
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold text-gray-700">
                {matchPosts.length > 0 ? `${matchPosts.length} bài đăng đang mở` : "Chưa có bài đăng"}
              </p>
              {session && (
                <button
                  onClick={() => setShowCreateForm((v) => !v)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                    showCreateForm
                      ? "bg-gray-200 text-gray-600"
                      : "bg-emerald-500 hover:bg-emerald-400 text-white"
                  }`}
                >
                  {showCreateForm ? "✕ Đóng" : "+ Đăng tìm đồng đội"}
                </button>
              )}
            </div>

            {/* Form tạo bài */}
            {showCreateForm && facility && (
              <form
                onSubmit={handleCreateSubmit}
                className="border border-emerald-300 rounded-2xl p-5 mb-5 space-y-4"
                style={{ background: "#f0fdf4" }}
              >
                <h3 className="font-bold text-black text-base flex items-center gap-2">
                  <img src="/group.png" className="w-5 h-5" alt="" />
                  Đăng tìm đồng đội tại {facility.name}
                </h3>

                {/* Môn thể thao + Trình độ */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-600 font-medium mb-1 block">Môn thể thao *</label>
                    <select
                      value={createForm.categoryId}
                      onChange={(e) => handleCreateSportChange(e.target.value)}
                      required
                      className="w-full bg-white border border-gray-300 text-black rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-400"
                    >
                      <option value="">-- Chọn môn --</option>
                      {facility.sports.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-600 font-medium mb-1 block">Trình độ *</label>
                    <select
                      value={createForm.level}
                      onChange={(e) => setCreateForm((f) => ({ ...f, level: e.target.value }))}
                      className="w-full bg-white border border-gray-300 text-black rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-400"
                    >
                      <option value="BEGINNER">Người mới</option>
                      <option value="INTERMEDIATE">Trung bình</option>
                      <option value="PRO">Chuyên nghiệp</option>
                    </select>
                  </div>
                </div>

                {/* Chọn sân cụ thể */}
                {createForm.categoryId && (
                  <div>
                    <label className="text-xs text-gray-600 font-medium mb-1 block">Sân *</label>
                    {createFilteredCourts.length === 0 ? (
                      <p className="text-xs text-gray-400">Không có sân nào cho môn này</p>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        {createFilteredCourts.map((court) => (
                          <button
                            key={court.id}
                            type="button"
                            onClick={() => handleCreateCourtChange(String(court.id))}
                            className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm text-left transition-colors ${
                              createForm.courtId === String(court.id)
                                ? "bg-emerald-500 text-white border-emerald-500"
                                : "bg-white text-gray-700 border-gray-300 hover:border-emerald-400"
                            }`}
                          >
                            <img src={court.category.iconUrl} className="w-5 h-5 flex-shrink-0" alt="" />
                            <span className="font-medium truncate">{court.name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Thông tin sân đã chọn */}
                {createForm.courtId && (
                  <div className="bg-white border border-emerald-200 rounded-xl px-4 py-2.5 flex items-center gap-3">
                    <img src="/placeholder.png" className="w-4 h-4 flex-shrink-0 opacity-60" alt="" />
                    <div className="text-xs">
                      <p className="font-semibold text-gray-800">{createForm.courtName} · {facility.name}</p>
                      <p className="text-gray-500">{facility.address}</p>
                    </div>
                  </div>
                )}

                {/* Ngày chơi */}
                {createForm.courtId && (
                  <div>
                    <label className="text-xs text-gray-600 font-medium mb-1 block">Ngày chơi *</label>
                    <input
                      type="date"
                      value={createForm.matchDate}
                      onChange={(e) => handleCreateDateChange(e.target.value)}
                      min={new Date(new Date().getTime() + 7 * 60 * 60 * 1000).toISOString().split("T")[0]}
                      required
                      className="w-full bg-white border border-gray-300 text-black rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-400"
                    />
                  </div>
                )}

                {/* Slot picker */}
                {createForm.courtId && createForm.matchDate && (() => {
                  const sport = facility.sports.find((s) => String(s.id) === createForm.categoryId);
                  const sportName = sport?.name || "";
                  const allSlots = generateCourtSlots(sportName, createForm.matchDate);
                  const nowVN3 = new Date(new Date().getTime() + 7 * 60 * 60 * 1000);
                  const todayVN3 = nowVN3.toISOString().split("T")[0];
                  const nowMin3 = nowVN3.getUTCHours() * 60 + nowVN3.getUTCMinutes();
                  const isToday3 = createForm.matchDate === todayVN3;
                  const holiday3 = isHoliday(createForm.matchDate);
                  const weekend3 = isWeekend(createForm.matchDate);
                  const totalCreatePrice = createSelectedSlots.reduce((sum, t) => {
                    const slot = allSlots.find((s) => s.time === t);
                    return sum + (slot ? getSlotPrice(slot, createForm.matchDate) : 0);
                  }, 0);
                  return (
                    <div>
                      <label className="text-xs text-gray-600 font-medium mb-2 block">Chọn khung giờ *</label>
                      {/* Chú thích */}
                      <div className="flex gap-2 flex-wrap text-xs mb-3">
                        <span className="flex items-center gap-1">
                          <span className="w-3 h-3 rounded inline-block" style={{ background: "#96CDCD", border: "1px solid #D1EEEE" }}></span>
                          <span className="text-gray-600">Còn trống</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-3 h-3 rounded inline-block" style={{ background: "#EED5D2" }}></span>
                          <span className="text-gray-600">Đã đặt</span>
                        </span>
                        {(weekend3 || holiday3) && (
                          <span className="flex items-center gap-1">
                            <span className="w-3 h-3 rounded inline-block" style={{ background: "#FFD580" }}></span>
                            <span className="text-gray-600">Cao điểm sáng</span>
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <span className="w-3 h-3 rounded inline-block" style={{ background: "#9BCD9B" }}></span>
                          <span className="text-gray-600">Cao điểm chiều</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-3 h-3 rounded inline-block" style={{ background: "#B0C4DE" }}></span>
                          <span className="text-gray-600">Đang chọn</span>
                        </span>
                      </div>
                      {createLoadingSlots ? (
                        <div className="h-20 bg-gray-100 rounded-xl animate-pulse" />
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {allSlots.map((slot) => {
                            const isBooked = createBookedSlots.includes(slot.time);
                            const isPast = isToday3 && toMinutes(slot.time) < nowMin3;
                            const isSelected = createSelectedSlots.includes(slot.time);
                            let bgStyle: React.CSSProperties = { fontWeight: "bold" };
                            let cls = "border rounded-lg text-xs font-medium transition-all text-left ";
                            const pad = slot.isPeak ? "px-4 py-2.5" : "px-2.5 py-2";
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
                            return (
                              <button key={slot.time} type="button"
                                onClick={() => toggleCreateSlot(slot.time, allSlots, sportName)}
                                disabled={isBooked || isPast}
                                className={`${cls} ${pad}`} style={bgStyle}>
                                <div className="font-semibold text-[11px]">{slot.label}</div>
                                <div className="text-[10px] opacity-70 mt-0.5">{getSlotPriceLabel(slot, createForm.matchDate)}</div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                      {createSelectedSlots.length > 0 && (
                        <div className="mt-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-center justify-between">
                          <div>
                            <p className="text-xs text-gray-500">{createSelectedSlots.length} slot · {createForm.startTime} – {createForm.endTime}</p>
                            <p className="font-bold text-emerald-600">{totalCreatePrice.toLocaleString("vi-VN")}đ</p>
                          </div>
                          <button type="button" onClick={() => { setCreateSelectedSlots([]); setCreateForm((f) => ({ ...f, startTime: "", endTime: "", totalPrice: "" })); }}
                            className="text-xs text-gray-400 hover:text-red-500 transition-colors">Xóa chọn</button>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Số người */}
                <div>
                  <label className="text-xs text-gray-600 font-medium mb-1 block">Cần bao nhiêu người? *</label>
                  <input
                    type="number"
                    value={createForm.requiredPlayers}
                    onChange={(e) => setCreateForm((f) => ({ ...f, requiredPlayers: e.target.value }))}
                    min="2" max="30" required
                    className="w-full bg-white border border-gray-300 text-black rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-400"
                  />
                  <p className="text-xs text-gray-400 mt-1">Tổng số người cần (bao gồm bạn)</p>
                </div>

                {/* Mô tả */}
                <div>
                  <label className="text-xs text-gray-600 font-medium mb-1 block">Mô tả (không bắt buộc)</label>
                  <textarea
                    value={createForm.description}
                    onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder="VD: Tìm 3 người chơi pickleball trình độ beginner, vui vẻ..."
                    rows={2}
                    className="w-full bg-white border border-gray-300 text-black rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-400 resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={createSubmitting || !createForm.startTime}
                  className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-300 text-white py-3 rounded-xl text-sm font-semibold transition-colors"
                >
                  {createSubmitting ? "Đang đăng..." : "Đăng tìm đồng đội"}
                </button>
              </form>
            )}

            {matchPostsLoading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => <div key={i} className="h-32 rounded-2xl animate-pulse" style={{ background: "#E0EEE0" }} />)}
              </div>
            ) : matchPosts.length === 0 ? (
              <div className="text-center py-16 border border-gray-300 rounded-2xl" style={{ background: "#E0EEE0" }}>
                <div className="flex justify-center mb-3"><img src="/group.png" alt="" className="w-12 h-12 opacity-40" /></div>
                <p className="text-sm text-gray-500">Chưa có bài tìm đồng đội nào tại sân này</p>
                <p className="text-xs text-gray-400 mt-1">Đặt sân và đăng bài để tìm người cùng chơi!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {matchPosts.map((post) => {
                  const isCreator = session && Number((session.user as any).id) === post.creator.id;
                  const canJoin = post.status === "OPEN" && !isCreator;
                  const matchDateObj = new Date(post.matchDate);
                  const dateLabel = matchDateObj.toLocaleDateString("vi-VN", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" });
                  return (
                    <div key={post.id} className="border border-gray-300 rounded-2xl p-5" style={{ background: "#E0EEE0" }}>
                      {/* Header */}
                      <div className="flex items-start justify-between mb-3 gap-3">
                        <div className="flex items-center gap-2">
                          <img src={post.sport.iconUrl} className="w-6 h-6 flex-shrink-0" alt={post.sport.name} />
                          <div>
                            <p className="font-semibold text-black text-sm leading-tight">{post.title}</p>
                            <p className="text-xs text-gray-500">{post.sport.name} · {LEVEL_LABEL[post.level] || post.level}</p>
                          </div>
                        </div>
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0 ${post.status === "OPEN" ? "bg-emerald-100 text-emerald-700" : "bg-gray-200 text-gray-500"}`}>
                          {post.status === "OPEN" ? "Đang mở" : "Đủ người"}
                        </span>
                      </div>

                      {/* Thông tin chi tiết */}
                      <div className="bg-white rounded-xl px-4 py-3 space-y-2 text-sm mb-3">
                        {/* Sân */}
                        <div className="flex items-center gap-2 text-gray-700">
                          <img src="/list.png" className="w-4 h-4 flex-shrink-0 opacity-60" alt="" />
                          <span className="font-medium">{post.courtName || "Chưa rõ sân"}</span>
                          <span className="text-gray-400">·</span>
                          <span className="text-gray-500">{post.facility.name}</span>
                        </div>
                        {/* Địa chỉ */}
                        <div className="flex items-center gap-2 text-gray-500 text-xs pl-6">
                          <img src="/placeholder.png" className="w-3.5 h-3.5 flex-shrink-0 opacity-50" alt="" />
                          {post.facility.address}
                        </div>
                        {/* Ngày + giờ */}
                        <div className="flex items-center gap-2 text-gray-700">
                          <img src="/calendar.png" className="w-4 h-4 flex-shrink-0 opacity-60" alt="" />
                          <span>{dateLabel}</span>
                          <span className="text-gray-400">·</span>
                          <span className="font-medium">{post.startTime} – {post.endTime}</span>
                        </div>
                        {/* Số người */}
                        <div className="flex items-center gap-2 text-gray-700">
                          <img src="/group.png" className="w-4 h-4 flex-shrink-0 opacity-60" alt="" />
                          <span>
                            <span className="font-semibold text-emerald-600">{post.joinedPlayers}</span>
                            <span className="text-gray-400">/{post.requiredPlayers} người tham gia</span>
                            {post.remaining > 0 && (
                              <span className="ml-1.5 text-xs bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full">còn {post.remaining} chỗ</span>
                            )}
                          </span>
                        </div>
                        {/* Giá mỗi người */}
                        {post.pricePerPerson != null && post.pricePerPerson > 0 && (
                          <div className="flex items-center gap-2 border-t border-gray-100 pt-2 mt-1">
                            <img src="/atm-card.png" className="w-4 h-4 flex-shrink-0 opacity-60" alt="" />
                            <span className="text-gray-600">Mỗi người trả:</span>
                            <span className="font-bold text-emerald-600">{post.pricePerPerson.toLocaleString("vi-VN")}đ</span>
                            <span className="text-xs text-gray-400">(qua ví SportHub)</span>
                          </div>
                        )}
                      </div>

                      {/* Mô tả */}
                      {post.description && (
                        <p className="text-xs text-gray-500 mb-3 italic">"{post.description}"</p>
                      )}

                      {/* Footer */}
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-gray-400">Đăng bởi {post.creator.fullName}</p>
                        {canJoin ? (
                          <button
                            onClick={() => { if (!session) { router.push("/login"); return; } setJoinModal(post); }}
                            className="bg-emerald-500 hover:bg-emerald-400 text-white text-sm px-5 py-2 rounded-xl font-medium transition-colors flex items-center gap-1.5">
                            <img src="/group.png" className="w-4 h-4" alt="" />
                            Tham gia
                          </button>
                        ) : isCreator ? (
                          <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1.5 rounded-xl">Bài của bạn</span>
                        ) : (
                          <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1.5 rounded-xl">Đã đủ người</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Modal xác nhận tham gia */}
            {joinModal && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
                <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
                  <div className="flex items-center gap-2 mb-4">
                    <img src="/group.png" className="w-6 h-6" alt="" />
                    <h3 className="font-bold text-black text-lg">Xác nhận tham gia</h3>
                  </div>

                  <div className="bg-gray-50 rounded-xl px-4 py-3 space-y-2 text-sm mb-4">
                    <div className="flex items-center gap-2 text-gray-700">
                      <img src="/list.png" className="w-4 h-4 opacity-60" alt="" />
                      <span className="font-medium">{joinModal.courtName || "Sân"}</span>
                      <span className="text-gray-400">·</span>
                      <span className="text-gray-500">{joinModal.facility.name}</span>
                    </div>
                    <div className="text-xs text-gray-500 pl-6">{joinModal.facility.address}</div>
                    <div className="flex items-center gap-2 text-gray-700">
                      <img src="/calendar.png" className="w-4 h-4 opacity-60" alt="" />
                      <span>{new Date(joinModal.matchDate).toLocaleDateString("vi-VN", { weekday: "short", day: "2-digit", month: "2-digit" })}</span>
                      <span className="text-gray-400">·</span>
                      <span className="font-medium">{joinModal.startTime} – {joinModal.endTime}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-700">
                      <img src="/group.png" className="w-4 h-4 opacity-60" alt="" />
                      <span>{joinModal.joinedPlayers}/{joinModal.requiredPlayers} người · còn {joinModal.remaining} chỗ</span>
                    </div>
                  </div>

                  {joinModal.pricePerPerson != null && joinModal.pricePerPerson > 0 ? (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 mb-4">
                      <p className="text-sm text-emerald-800 font-semibold mb-1">
                        Phí tham gia: {joinModal.pricePerPerson.toLocaleString("vi-VN")}đ
                      </p>
                      <p className="text-xs text-emerald-700">
                        Số dư ví: <span className={walletBalance >= joinModal.pricePerPerson ? "font-semibold text-emerald-600" : "font-semibold text-red-500"}>{walletBalance.toLocaleString("vi-VN")}đ</span>
                      </p>
                      {walletBalance < joinModal.pricePerPerson && (
                        <p className="text-xs text-red-600 mt-1">
                          Số dư không đủ.{" "}
                          <button onClick={() => { setJoinModal(null); router.push("/profile?tab=wallet"); }} className="underline font-medium">Nạp ví ngay</button>
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mb-4">
                      <p className="text-sm text-blue-700">Tham gia miễn phí</p>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button onClick={() => setJoinModal(null)}
                      className="flex-1 border border-gray-300 text-gray-600 py-2.5 rounded-xl text-sm hover:bg-gray-50 transition-colors">
                      Hủy
                    </button>
                    <button
                      onClick={() => handleJoin(joinModal)}
                      disabled={joining || (joinModal.pricePerPerson != null && joinModal.pricePerPerson > 0 && walletBalance < joinModal.pricePerPerson)}
                      className="flex-1 bg-emerald-500 hover:bg-emerald-400 disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-2.5 rounded-xl text-sm font-semibold transition-colors">
                      {joining ? "Đang xử lý..." : "Xác nhận tham gia"}
                    </button>
                  </div>
                </div>
              </div>
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
            {/* Nút viết đánh giá */}
            {session && !hasReviewed && !showReviewForm && (
              <div className="border border-amber-200 rounded-xl p-4 flex items-center justify-between" style={{ background: "#fffbeb" }}>
                <div>
                  <p className="text-sm font-medium text-black">Bạn đã từng chơi tại đây?</p>
                  <p className="text-xs text-gray-500 mt-0.5">Chia sẻ trải nghiệm để giúp người khác tìm sân!</p>
                </div>
                <button
                  onClick={() => setShowReviewForm(true)}
                  className="bg-amber-500 hover:bg-amber-400 text-white text-sm px-4 py-2 rounded-xl transition-colors font-medium flex-shrink-0">
                  <img src="/star.png" className="w-4 h-4 inline mr-1" alt="" />Viết đánh giá
                </button>
              </div>
            )}
            {session && hasReviewed && (
              <div className="border border-emerald-200 rounded-xl p-3 text-center text-sm text-emerald-700" style={{ background: "#f0fdf4" }}>
                Bạn đã đánh giá cơ sở này
              </div>
            )}

            {/* Form đánh giá inline */}
            {showReviewForm && (
              <div className="border border-amber-300 rounded-2xl p-5" style={{ background: "#fffbeb" }}>
                <h3 className="font-semibold text-black mb-3 flex items-center gap-2">
                  <img src="/star.png" alt="" className="w-5 h-5" /> Viết đánh giá của bạn
                </h3>
                <div className="flex gap-2 mb-3">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button key={star} onClick={() => setReviewRating(star)}
                      className={`transition-transform hover:scale-110 ${star <= reviewRating ? "opacity-100" : "opacity-30"}`}>
                      <img src="/star.png" className="w-7 h-7" alt={`${star} sao`} />
                    </button>
                  ))}
                  {reviewRating > 0 && (
                    <span className="text-sm text-gray-500 ml-2 self-center">
                      {["", "Rất tệ", "Tệ", "Bình thường", "Tốt", "Tuyệt vời"][reviewRating]}
                    </span>
                  )}
                </div>
                <textarea
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder="Chia sẻ trải nghiệm của bạn... (không bắt buộc)"
                  rows={3}
                  className="w-full bg-white border border-gray-300 text-black rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-400 resize-none mb-3"
                />
                <div className="flex gap-3">
                  <button onClick={() => { setShowReviewForm(false); setReviewRating(0); setReviewComment(""); }}
                    className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-xl text-sm hover:bg-gray-50 transition-colors">
                    Hủy
                  </button>
                  <button onClick={submitFacilityReview} disabled={reviewSubmitting || reviewRating === 0}
                    className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:bg-amber-300 text-white py-2 rounded-xl text-sm font-medium transition-colors">
                    {reviewSubmitting ? "Đang gửi..." : "Gửi đánh giá"}
                  </button>
                </div>
              </div>
            )}

            {/* Toast */}
            {reviewToast && (
              <div className={`px-4 py-3 rounded-xl text-sm font-medium text-white ${reviewToast.includes("Cảm ơn") || reviewToast.includes("thành công") ? "bg-emerald-500" : "bg-red-500"}`}>
                {reviewToast}
              </div>
            )}

            {facility.reviews.length === 0 && !showReviewForm ? (
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