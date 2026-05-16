"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Navbar from "@/components/Navbar";
import { useTranslations, useLocale } from "next-intl";
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
  defaultQrUrl?: string | null;
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

type BookParams = { courtId: number; date: string; start: string; end: string; price: number };

function CourtSchedule({ court, selectedDate, facilityId, onBook }: { court: Court; selectedDate: string; facilityId: number; onBook: (p: BookParams) => void }) {
  const t = useTranslations("facility");
  const locale = useLocale();
  const dateLocale = locale === "en" ? "en-US" : "vi-VN";
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
              {isOneHour ? t("minOneHour") : hasGapRule ? t("thirtyMinSlot") : t("minOneHour")}
            </p>
          </div>
        </div>
        <div className="flex gap-1 shrink-0">
          {weekend && !holiday && <span className="text-[10px] bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full font-medium">{t("weekend")}</span>}
          {holiday && <span className="text-[11px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">{t("holiday")}</span>}
        </div>
      </div>

      {/* Chú thích */}
      <div className="flex gap-3 text-xs mb-4 flex-wrap">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded inline-block" style={{ background: "#96CDCD", border: "1px solid #D1EEEE" }}></span>
          <span className="text-black">{isOneHour ? t("available1h") : t("available30m")}</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded inline-block" style={{ background: "#EED5D2" }}></span>
          <span className="text-black">{t("bookedLegend")}</span>
        </span>
        {(weekend || holiday) && (
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded inline-block" style={{ background: "#FFD580" }}></span>
            <span className="text-black">{t("morningPeak")}</span>
          </span>
        )}
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded inline-block" style={{ background: "#9BCD9B" }}></span>
          <span className="text-black">{holiday ? t("afternoonPeakHoliday") : t("afternoonPeakNormal")}</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded inline-block" style={{ background: "#B0C4DE" }}></span>
          <span className="text-black">{t("selectedSlot")}</span>
        </span>
        {isToday && (
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded inline-block" style={{ background: "#D1D5DB", border: "1px solid #9CA3AF" }}></span>
            <span className="text-black">{t("past")}</span>
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
            <p className="text-xs text-gray-500">{holiday ? t("slotSummaryHoliday", { count: selectedSlots.length, minutes: totalMinutes }) : t("slotSummary", { count: selectedSlots.length, minutes: totalMinutes })}</p>
            <p className="font-bold text-emerald-600 text-lg">{totalPrice.toLocaleString(dateLocale)}đ</p>
          </div>
          <button onClick={() => {
              const sorted = [...selectedSlots].sort((a, b) => toMinutes(a) - toMinutes(b));
              const endSlot = ALL_SLOTS.find((s) => s.time === sorted[sorted.length - 1])!;
              onBook({ courtId: court.id, date: selectedDate, start: sorted[0], end: endSlot.end, price: totalPrice });
            }}
            className="bg-emerald-500 hover:bg-emerald-400 text-white text-sm px-6 py-2.5 rounded-lg transition-colors font-medium">
            {t("bookCourt")}
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

export default function FacilityDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const t = useTranslations("facility");
  const locale = useLocale();
  const dateLocale = locale === "en" ? "en-US" : "vi-VN";
  const LEVEL_LABEL: Record<string, string> = {
    BEGINNER: t("beginner"),
    INTERMEDIATE: t("intermediate"),
    PRO: t("pro"),
  };
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
  const [joinToastSuccess, setJoinToastSuccess] = useState(false);
  const [reviewToastSuccess, setReviewToastSuccess] = useState(false);
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
  const [showCreatePayConfirm, setShowCreatePayConfirm] = useState(false);
  // Guest booking
  const [guestBookingParams, setGuestBookingParams] = useState<BookParams | null>(null);
  const [guestForm, setGuestForm] = useState({ guestName: "", guestPhone: "", guestEmail: "", guestBankName: "", guestBankAccount: "" });
  const [guestSubmitting, setGuestSubmitting] = useState(false);
  const [guestError, setGuestError] = useState("");
  const [guestSuccess, setGuestSuccess] = useState<{ bookingId: number; qrUrl: string | null; vietqrUrl: string | null } | null>(null);

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
      setJoinToast(t("joinSuccess"));
      setJoinToastSuccess(true);
      // Reload match posts
      fetch(`/api/match-posts?facilityId=${id}&status=OPEN`)
        .then((r) => r.json())
        .then((data) => setMatchPosts(Array.isArray(data) ? data : []));
      if (session) {
        fetch("/api/wallet").then((r) => r.json()).then((d) => setWalletBalance(Number(d.balance) || 0));
      }
    } else {
      setJoinToast(data.error || t("joinFailed"));
      setJoinToastSuccess(false);
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
      setJoinToast(t("createValidation"));
      setJoinToastSuccess(false);
      setTimeout(() => setJoinToast(""), 3000);
      return;
    }
    // Refresh số dư ví rồi hiện bước xác nhận
    const walletData = await fetch("/api/wallet/detail").then((r) => r.json());
    setWalletBalance(walletData.wallet ? Number(walletData.wallet.balance) : 0);
    setShowCreatePayConfirm(true);
  }

  async function handleCreateConfirmPay() {
    setCreateSubmitting(true);
    setShowCreatePayConfirm(false);
    const res = await fetch("/api/match-posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        facilityId: Number(id),
        categoryId: Number(createForm.categoryId),
        courtId: Number(createForm.courtId),
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
      setJoinToast(t("createSuccess"));
      setJoinToastSuccess(true);
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
      fetch(`/api/match-posts?facilityId=${id}&status=OPEN`)
        .then((r) => r.json())
        .then((d) => setMatchPosts(Array.isArray(d) ? d : []));
      // Refresh số dư ví sau khi trừ tiền
      fetch("/api/wallet").then((r) => r.json()).then((d) => setWalletBalance(Number(d.balance) || 0));
    } else {
      setJoinToast(data.error || t("createError"));
      setJoinToastSuccess(false);
    }
    setTimeout(() => setJoinToast(""), 5000);
  }

  function handleBook(params: BookParams) {
    if (session) {
      const urlParams = new URLSearchParams({
        courtId: String(params.courtId), facilityId: String(id),
        date: params.date, start: params.start, end: params.end, price: String(params.price),
      });
      router.push(`/bookings?${urlParams}`);
    } else {
      setGuestBookingParams(params);
      setGuestForm({ guestName: "", guestPhone: "", guestEmail: "", guestBankName: "", guestBankAccount: "" });
      setGuestError("");
    }
  }

  async function handleGuestSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!guestBookingParams) return;
    setGuestSubmitting(true);
    setGuestError("");
    const res = await fetch("/api/guest-bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        guestName: guestForm.guestName,
        guestPhone: guestForm.guestPhone,
        guestEmail: guestForm.guestEmail || undefined,
        guestBankName: guestForm.guestBankName || undefined,
        guestBankAccount: guestForm.guestBankAccount || undefined,
        courtId: guestBookingParams.courtId,
        bookingDate: guestBookingParams.date,
        startTime: guestBookingParams.start,
        endTime: guestBookingParams.end,
        totalPrice: guestBookingParams.price,
      }),
    });
    const data = await res.json();
    setGuestSubmitting(false);
    if (res.ok) {
      setGuestSuccess({ bookingId: data.bookingId, qrUrl: facility?.defaultQrUrl || null, vietqrUrl: data.vietqrUrl || null });
      setGuestBookingParams(null);
    } else {
      setGuestError(data.error || "Đặt sân thất bại. Vui lòng thử lại.");
    }
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
      setReviewToast(t("thankYou"));
      setReviewToastSuccess(true);
      // Reload
      fetch(`/api/facilities/${id}`).then(r => r.json()).then(data => setFacility(data));
    } else {
      setReviewToast(data.error || t("reviewError"));
      setReviewToastSuccess(false);
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
        <div className="text-center py-20 text-gray-500">{t("notFound")}</div>
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
    { id: "courts", icon: <img src="/list.png" className="w-4 h-4 inline-block" alt="list" />, label: t("courtsTab", { count: facility.courts.length }) },
    { id: "teammate", icon: <img src="/group.png" className="w-4 h-4 inline-block" alt="group" />, label: t("teammateTab") },
    { id: "services", icon: <img src="/shopping-cart.png" className="w-4 h-4 inline-block" alt="cart" />, label: t("servicesTab", { count: facility.services.length }) },
    { id: "reviews", icon: <img src="/star.png" className="w-4 h-4 inline-block" alt="star" />, label: t("reviewsTab", { count: facility.reviews.length }) },
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
                <span>{t("courtsCount", { count: facility.courts.length })}</span>
                <span className="flex items-center gap-1"><img src="/call.png" className="w-4 h-4 inline-block" alt="call" /> {facility.owner.phone}</span>
                {facility.avgRating && <span className="flex items-center gap-1"><img src="/star.png" alt="" className="w-3 h-3" />{facility.avgRating}</span>}
              </div>
              {facility.description && <p className="text-gray-600 text-sm mt-2">{facility.description}</p>}
            </div>
          </div>
          <button className="bg-emerald-500 hover:bg-emerald-400 text-white font-semibold px-6 py-3 rounded-xl transition-colors flex-shrink-0">
            {t("bookNow")}
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
              <label className="text-sm font-medium text-gray-700 flex items-center gap-1"><img src="/calendar.png" className="w-4 h-4 inline-block" alt="calendar" /> {t("selectDate")}</label>
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
                {t("allCourts")}
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
              <div className="text-center py-10 text-gray-500">{t("noCourts")}</div>
            ) : (
              filteredGroups.map((group) => (
                <div key={group.sport.id} className="mb-6">
                  <div className="flex items-center gap-2 mb-4">
                    <img src={group.sport.iconUrl} className="w-5 h-5" alt={group.sport.name} />
                    <h3 className="font-bold text-black text-base">{t("courtGroupTitle", { sport: group.sport.name })}</h3>
                    <div className="flex-1 h-0.5 bg-emerald-400 rounded ml-1" />
                  </div>
                  {group.courts.map((court) => (
                    <CourtSchedule key={court.id} court={court} selectedDate={selectedDate} facilityId={facility.id} onBook={handleBook} />
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
              <div className={`mb-4 px-4 py-3 rounded-xl text-sm font-medium text-white flex items-center gap-2 ${
                joinToastSuccess ? "bg-emerald-500" : "bg-red-500"
              }`}>
                {joinToast}
              </div>
            )}

            {/* Nút đăng bài */}
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold text-gray-700">
                {matchPosts.length > 0 ? t("postsOpen", { count: matchPosts.length }) : t("noPostsYet")}
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
                  {showCreateForm ? t("closeForm") : t("createPost")}
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
                  {t("createFormTitle", { name: facility.name })}
                </h3>

                {/* Môn thể thao + Trình độ */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-600 font-medium mb-1 block">{t("sportLabel")}</label>
                    <select
                      value={createForm.categoryId}
                      onChange={(e) => handleCreateSportChange(e.target.value)}
                      required
                      className="w-full bg-white border border-gray-300 text-black rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-400"
                    >
                      <option value="">{t("chooseSport")}</option>
                      {facility.sports.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-600 font-medium mb-1 block">{t("levelLabel")}</label>
                    <select
                      value={createForm.level}
                      onChange={(e) => setCreateForm((f) => ({ ...f, level: e.target.value }))}
                      className="w-full bg-white border border-gray-300 text-black rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-400"
                    >
                      <option value="BEGINNER">{t("beginner")}</option>
                      <option value="INTERMEDIATE">{t("intermediate")}</option>
                      <option value="PRO">{t("pro")}</option>
                    </select>
                  </div>
                </div>

                {/* Chọn sân cụ thể */}
                {createForm.categoryId && (
                  <div>
                    <label className="text-xs text-gray-600 font-medium mb-1 block">{t("courtLabel")}</label>
                    {createFilteredCourts.length === 0 ? (
                      <p className="text-xs text-gray-400">{t("noCourtsForSport")}</p>
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
                    <label className="text-xs text-gray-600 font-medium mb-1 block">{t("matchDate")}</label>
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
                      <label className="text-xs text-gray-600 font-medium mb-2 block">{t("selectSlot")}</label>
                      <div className="flex gap-2 flex-wrap text-xs mb-3">
                        <span className="flex items-center gap-1">
                          <span className="w-3 h-3 rounded inline-block" style={{ background: "#96CDCD", border: "1px solid #D1EEEE" }}></span>
                          <span className="text-gray-600">{t("availableLegend")}</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-3 h-3 rounded inline-block" style={{ background: "#EED5D2" }}></span>
                          <span className="text-gray-600">{t("bookedLegend")}</span>
                        </span>
                        {(weekend3 || holiday3) && (
                          <span className="flex items-center gap-1">
                            <span className="w-3 h-3 rounded inline-block" style={{ background: "#FFD580" }}></span>
                            <span className="text-gray-600">{t("morningPeakLegend")}</span>
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <span className="w-3 h-3 rounded inline-block" style={{ background: "#9BCD9B" }}></span>
                          <span className="text-gray-600">{t("afternoonPeakLegend")}</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-3 h-3 rounded inline-block" style={{ background: "#B0C4DE" }}></span>
                          <span className="text-gray-600">{t("selectedLegend")}</span>
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
                            <p className="text-xs text-gray-500">{t("slotRange", { count: createSelectedSlots.length, start: createForm.startTime, end: createForm.endTime })}</p>
                            <p className="font-bold text-emerald-600">{totalCreatePrice.toLocaleString(dateLocale)}đ</p>
                          </div>
                          <button type="button" onClick={() => { setCreateSelectedSlots([]); setCreateForm((f) => ({ ...f, startTime: "", endTime: "", totalPrice: "" })); }}
                            className="text-xs text-gray-400 hover:text-red-500 transition-colors">{t("clearSelection")}</button>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Số người */}
                <div>
                  <label className="text-xs text-gray-600 font-medium mb-1 block">{t("playersNeededLabel")}</label>
                  <input
                    type="number"
                    value={createForm.requiredPlayers}
                    onChange={(e) => setCreateForm((f) => ({ ...f, requiredPlayers: e.target.value }))}
                    min="2" max="30" required
                    className="w-full bg-white border border-gray-300 text-black rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-400"
                  />
                  <p className="text-xs text-gray-400 mt-1">{t("playersHint")}</p>
                </div>

                {/* Mô tả */}
                <div>
                  <label className="text-xs text-gray-600 font-medium mb-1 block">{t("descLabel")}</label>
                  <textarea
                    value={createForm.description}
                    onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder={t("descPlaceholder")}
                    rows={2}
                    className="w-full bg-white border border-gray-300 text-black rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-400 resize-none"
                  />
                </div>

                {createForm.totalPrice && Number(createForm.totalPrice) > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-700">
                    <p className="font-semibold mb-0.5">{t("paymentOnPost")}</p>
                    <p>{t("paymentDesc", { amount: Number(createForm.totalPrice).toLocaleString(dateLocale) + "đ" })}</p>
                    {Number(createForm.requiredPlayers) > 1 && (
                      <p className="mt-0.5">{t("refundNote", { amount: Math.ceil(Number(createForm.totalPrice) / Number(createForm.requiredPlayers)).toLocaleString(dateLocale) + "đ" })}</p>
                    )}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={createSubmitting || !createForm.startTime}
                  className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-300 text-white py-3 rounded-xl text-sm font-semibold transition-colors"
                >
                  {createSubmitting ? t("processing") : createForm.totalPrice && Number(createForm.totalPrice) > 0 ? t("bookAndPost") : t("postTeammate")}
                </button>
              </form>
            )}

            {/* Modal xác nhận thanh toán khi đăng bài */}
            {showCreatePayConfirm && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
                <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
                  <h3 className="font-bold text-black text-base mb-4 flex items-center gap-2">
                    <img src="/atm-card.png" className="w-5 h-5" alt="" />
                    {t("confirmPaymentTitle")}
                  </h3>

                  <div className="bg-gray-50 rounded-xl p-3 mb-4 space-y-1.5 text-xs">
                    <div className="flex items-center gap-1.5 text-gray-700">
                      <img src="/placeholder.png" className="w-3.5 h-3.5 flex-shrink-0" alt="" />
                      <span className="font-medium">{createForm.courtName}</span>
                      <span className="text-gray-400">·</span>
                      <span className="text-gray-500 truncate">{facility?.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-gray-700">
                      <img src="/calendar.png" className="w-3.5 h-3.5 flex-shrink-0" alt="" />
                      <span>
                        {(() => { const [y,m,d] = createForm.matchDate.split("-").map(Number); return new Date(y,m-1,d).toLocaleDateString(dateLocale,{weekday:"long",day:"2-digit",month:"2-digit"}); })()}
                        {" · "}{createForm.startTime} – {createForm.endTime}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2 mb-5">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">{t("courtTotal")}</span>
                      <span className="font-bold text-black">{Number(createForm.totalPrice || 0).toLocaleString(dateLocale)}đ</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">{t("currentBalance")}</span>
                      <span className={`font-semibold ${walletBalance >= Number(createForm.totalPrice) ? "text-emerald-600" : "text-red-500"}`}>
                        {walletBalance.toLocaleString(dateLocale)}đ
                      </span>
                    </div>
                    <div className="border-t border-gray-100 pt-2 flex justify-between text-sm">
                      <span className="text-gray-600">{t("balanceAfter")}</span>
                      <span className="font-semibold text-gray-700">{(walletBalance - Number(createForm.totalPrice || 0)).toLocaleString(dateLocale)}đ</span>
                    </div>
                    {Number(createForm.requiredPlayers) > 1 && Number(createForm.totalPrice) > 0 && (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-xs text-emerald-700">
                        <p>{t("feePerPerson")} <span className="font-bold">{Math.ceil(Number(createForm.totalPrice) / Number(createForm.requiredPlayers)).toLocaleString(dateLocale)}đ</span></p>
                        <p className="mt-0.5 text-emerald-600">{t("refundToWallet")}</p>
                      </div>
                    )}
                  </div>

                  {walletBalance < Number(createForm.totalPrice || 0) && (
                    <div className="mb-4 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex items-center justify-between">
                      <span>{t("insufficientBalance")}</span>
                      <button onClick={() => { setShowCreatePayConfirm(false); router.push("/profile?tab=wallet"); }}
                        className="underline font-medium ml-2">{t("topupNow")}</button>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button onClick={() => setShowCreatePayConfirm(false)}
                      className="flex-1 border border-gray-300 text-gray-600 py-2.5 rounded-xl text-sm hover:bg-gray-50 transition-colors">
                      {t("cancel")}
                    </button>
                    <button
                      onClick={handleCreateConfirmPay}
                      disabled={createSubmitting || walletBalance < Number(createForm.totalPrice || 0)}
                      className="flex-1 bg-emerald-500 hover:bg-emerald-400 disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-2.5 rounded-xl text-sm font-semibold transition-colors">
                      {createSubmitting ? t("processing") : t("confirmPayment")}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {matchPostsLoading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => <div key={i} className="h-32 rounded-2xl animate-pulse" style={{ background: "#E0EEE0" }} />)}
              </div>
            ) : matchPosts.length === 0 ? (
              <div className="text-center py-16 border border-gray-300 rounded-2xl" style={{ background: "#E0EEE0" }}>
                <div className="flex justify-center mb-3"><img src="/group.png" alt="" className="w-12 h-12 opacity-40" /></div>
                <p className="text-sm text-gray-500">{t("noMatchPosts")}</p>
                <p className="text-xs text-gray-400 mt-1">{t("noMatchPostsSub")}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {matchPosts.map((post) => {
                  const isCreator = session && Number((session.user as any).id) === post.creator.id;
                  const canJoin = post.status === "OPEN" && !isCreator;
                  const [py, pm, pd] = post.matchDate.toString().split("T")[0].split("-").map(Number);
                  const dateLabel = new Date(py, pm - 1, pd).toLocaleDateString(dateLocale, { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" });
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
                          {post.status === "OPEN" ? t("postOpen") : t("postFull")}
                        </span>
                      </div>

                      {/* Thông tin chi tiết */}
                      <div className="bg-white rounded-xl px-4 py-3 space-y-2 text-sm mb-3">
                        {/* Sân */}
                        <div className="flex items-center gap-2 text-gray-700">
                          <img src="/list.png" className="w-4 h-4 flex-shrink-0 opacity-60" alt="" />
                          <span className="font-medium">{post.courtName || t("unknownCourt")}</span>
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
                            {t("joinedPlayers", { joined: post.joinedPlayers, required: post.requiredPlayers })}
                            {post.remaining > 0 && (
                              <span className="ml-1.5 text-xs bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full">{t("spotsLeft", { count: post.remaining })}</span>
                            )}
                          </span>
                        </div>
                        {/* Giá mỗi người */}
                        {post.pricePerPerson != null && post.pricePerPerson > 0 && (
                          <div className="flex items-center gap-2 border-t border-gray-100 pt-2 mt-1">
                            <img src="/atm-card.png" className="w-4 h-4 flex-shrink-0 opacity-60" alt="" />
                            <span className="text-gray-600">{t("perPersonPays")}</span>
                            <span className="font-bold text-emerald-600">{post.pricePerPerson.toLocaleString(dateLocale)}đ</span>
                            <span className="text-xs text-gray-400">{t("viaWallet")}</span>
                          </div>
                        )}
                      </div>

                      {/* Mô tả */}
                      {post.description && (
                        <p className="text-xs text-gray-500 mb-3 italic">"{post.description}"</p>
                      )}

                      {/* Footer */}
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-gray-400">{t("postedBy", { name: post.creator.fullName })}</p>
                        {canJoin ? (
                          <button
                            onClick={() => { if (!session) { router.push("/login"); return; } setJoinModal(post); }}
                            className="bg-emerald-500 hover:bg-emerald-400 text-white text-sm px-5 py-2 rounded-xl font-medium transition-colors flex items-center gap-1.5">
                            <img src="/group.png" className="w-4 h-4" alt="" />
                            {t("joinBtn")}
                          </button>
                        ) : isCreator ? (
                          <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1.5 rounded-xl">{t("yourPost")}</span>
                        ) : (
                          <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1.5 rounded-xl">{t("postFull")}</span>
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
                    <h3 className="font-bold text-black text-lg">{t("confirmJoinTitle")}</h3>
                  </div>

                  <div className="bg-gray-50 rounded-xl px-4 py-3 space-y-2 text-sm mb-4">
                    <div className="flex items-center gap-2 text-gray-700">
                      <img src="/list.png" className="w-4 h-4 opacity-60" alt="" />
                      <span className="font-medium">{joinModal.courtName || t("unknownCourt")}</span>
                      <span className="text-gray-400">·</span>
                      <span className="text-gray-500">{joinModal.facility.name}</span>
                    </div>
                    <div className="text-xs text-gray-500 pl-6">{joinModal.facility.address}</div>
                    <div className="flex items-center gap-2 text-gray-700">
                      <img src="/calendar.png" className="w-4 h-4 opacity-60" alt="" />
                      <span>{(() => { const [jy,jm,jd] = joinModal.matchDate.toString().split("T")[0].split("-").map(Number); return new Date(jy,jm-1,jd).toLocaleDateString(dateLocale,{weekday:"long",day:"2-digit",month:"2-digit"}); })()}</span>
                      <span className="text-gray-400">·</span>
                      <span className="font-medium">{joinModal.startTime} – {joinModal.endTime}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-700">
                      <img src="/group.png" className="w-4 h-4 opacity-60" alt="" />
                      <span>{t("spotsInfo", { joined: joinModal.joinedPlayers, required: joinModal.requiredPlayers, remaining: joinModal.remaining })}</span>
                    </div>
                  </div>

                  {joinModal.pricePerPerson != null && joinModal.pricePerPerson > 0 ? (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 mb-4">
                      <p className="text-sm text-emerald-800 font-semibold mb-1">
                        {t("joinFee")} {joinModal.pricePerPerson.toLocaleString(dateLocale)}đ
                      </p>
                      <p className="text-xs text-emerald-700">
                        {t("walletBalanceLabel")} <span className={walletBalance >= joinModal.pricePerPerson ? "font-semibold text-emerald-600" : "font-semibold text-red-500"}>{walletBalance.toLocaleString(dateLocale)}đ</span>
                      </p>
                      {walletBalance < joinModal.pricePerPerson && (
                        <p className="text-xs text-red-600 mt-1">
                          {t("insufficientWallet")}{" "}
                          <button onClick={() => { setJoinModal(null); router.push("/profile?tab=wallet"); }} className="underline font-medium">{t("topupNow")}</button>
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mb-4">
                      <p className="text-sm text-blue-700">{t("freeJoin")}</p>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button onClick={() => setJoinModal(null)}
                      className="flex-1 border border-gray-300 text-gray-600 py-2.5 rounded-xl text-sm hover:bg-gray-50 transition-colors">
                      {t("cancel")}
                    </button>
                    <button
                      onClick={() => handleJoin(joinModal)}
                      disabled={joining || (joinModal.pricePerPerson != null && joinModal.pricePerPerson > 0 && walletBalance < joinModal.pricePerPerson)}
                      className="flex-1 bg-emerald-500 hover:bg-emerald-400 disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-2.5 rounded-xl text-sm font-semibold transition-colors">
                      {joining ? t("processing") : t("confirmJoin")}
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
              <p className="text-gray-500 text-sm col-span-3 text-center py-10">{t("noServices")}</p>
            ) : (
              facility.services.map((s) => (
                <div key={s.id} className="border border-gray-300 rounded-xl p-4" style={{ background: "#E0EEE0" }}>
                  <div className="flex items-start justify-between mb-2">
                    <p className="font-semibold text-black text-sm">{s.name}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${s.type === "RENTAL" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"}`}>
                      {s.type === "RENTAL" ? t("serviceRental") : t("serviceSale")}
                    </span>
                  </div>
                  <p className="text-emerald-600 font-bold text-sm">{Number(s.price).toLocaleString(dateLocale)}đ</p>
                  <p className="text-gray-400 text-xs mt-1">{t("stockLeft", { count: s.stockQuantity })}</p>
                  <button className="mt-3 w-full bg-white border border-emerald-400 text-emerald-600 hover:bg-emerald-50 text-sm py-2 rounded-lg transition-colors">
                    {t("addToOrder")}
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
                  <p className="text-sm font-medium text-black">{t("reviewPrompt")}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{t("reviewPromptSub")}</p>
                </div>
                <button
                  onClick={() => setShowReviewForm(true)}
                  className="bg-amber-500 hover:bg-amber-400 text-white text-sm px-4 py-2 rounded-xl transition-colors font-medium flex-shrink-0">
                  <img src="/star.png" className="w-4 h-4 inline mr-1" alt="" />{t("writeReview")}
                </button>
              </div>
            )}
            {session && hasReviewed && (
              <div className="border border-emerald-200 rounded-xl p-3 text-center text-sm text-emerald-700" style={{ background: "#f0fdf4" }}>
                {t("alreadyReviewed")}
              </div>
            )}

            {/* Form đánh giá inline */}
            {showReviewForm && (
              <div className="border border-amber-300 rounded-2xl p-5" style={{ background: "#fffbeb" }}>
                <h3 className="font-semibold text-black mb-3 flex items-center gap-2">
                  <img src="/star.png" alt="" className="w-5 h-5" /> {t("writeYourReview")}
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
                      {["", t("rating1"), t("rating2"), t("rating3"), t("rating4"), t("rating5")][reviewRating]}
                    </span>
                  )}
                </div>
                <textarea
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder={t("reviewPlaceholder")}
                  rows={3}
                  className="w-full bg-white border border-gray-300 text-black rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-400 resize-none mb-3"
                />
                <div className="flex gap-3">
                  <button onClick={() => { setShowReviewForm(false); setReviewRating(0); setReviewComment(""); }}
                    className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-xl text-sm hover:bg-gray-50 transition-colors">
                    {t("cancel")}
                  </button>
                  <button onClick={submitFacilityReview} disabled={reviewSubmitting || reviewRating === 0}
                    className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:bg-amber-300 text-white py-2 rounded-xl text-sm font-medium transition-colors">
                    {reviewSubmitting ? t("submitting") : t("submitReview")}
                  </button>
                </div>
              </div>
            )}

            {/* Toast */}
            {reviewToast && (
              <div className={`px-4 py-3 rounded-xl text-sm font-medium text-white ${reviewToastSuccess ? "bg-emerald-500" : "bg-red-500"}`}>
                {reviewToast}
              </div>
            )}

            {facility.reviews.length === 0 && !showReviewForm ? (
              <div className="text-center py-16 text-gray-500 border border-gray-300 rounded-2xl" style={{ background: "#E0EEE0" }}>
                <div className="flex justify-center mb-3"><img src="/star.png" alt="" className="w-12 h-12 opacity-40" /></div>
                <p className="text-sm">{t("noReviews")}</p>
                <p className="text-xs mt-1 text-gray-400">{t("beFirst")}</p>
              </div>
            ) : (
              facility.reviews.map((r) => (
                <div key={r.id} className="border border-gray-300 rounded-xl p-4" style={{ background: "#E0EEE0" }}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-semibold text-black text-sm">{r.customer.fullName}</p>
                    <span className="flex items-center gap-0.5">{Array.from({ length: r.rating }).map((_, i) => <img key={i} src="/star.png" alt="" className="w-3.5 h-3.5" />)}</span>
                  </div>
                  {r.comment && <p className="text-gray-600 text-sm">{r.comment}</p>}
                  <p className="text-gray-400 text-xs mt-2">{new Date(r.createdAt).toLocaleDateString(dateLocale)}</p>
                </div>
              ))
            )}
          </div>
        )}

        <button onClick={() => router.back()} className="mt-8 text-sm text-gray-500 hover:text-black transition-colors">
          {t("back")}
        </button>
      </div>

      {/* Modal đặt sân cho khách vãng lai */}
      {guestBookingParams && !session && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <div className="flex items-center gap-2 mb-5">
              <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                <img src="/list.png" className="w-5 h-5" alt="" />
              </div>
              <div>
                <h3 className="font-bold text-black text-base">Đặt sân không cần đăng nhập</h3>
                <p className="text-xs text-gray-500">Thanh toán qua mã QR của chủ sân</p>
              </div>
            </div>

            {/* Thông tin khung giờ */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 mb-4 text-sm">
              <div className="flex justify-between text-gray-700 mb-1">
                <span>Ngày:</span>
                <span className="font-medium">{new Date(guestBookingParams.date).toLocaleDateString("vi-VN")}</span>
              </div>
              <div className="flex justify-between text-gray-700 mb-1">
                <span>Giờ:</span>
                <span className="font-medium">{guestBookingParams.start} – {guestBookingParams.end}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-700">Tổng tiền:</span>
                <span className="font-bold text-emerald-600 text-base">{guestBookingParams.price.toLocaleString("vi-VN")}đ</span>
              </div>
            </div>

            {guestError && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-3 py-2 rounded-lg mb-3">
                {guestError}
              </div>
            )}

            <form onSubmit={handleGuestSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">Họ tên <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  value={guestForm.guestName}
                  onChange={(e) => setGuestForm(f => ({ ...f, guestName: e.target.value }))}
                  placeholder="Nguyễn Văn A"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-emerald-400"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">Số điện thoại <span className="text-red-500">*</span></label>
                <input
                  type="tel"
                  required
                  value={guestForm.guestPhone}
                  onChange={(e) => setGuestForm(f => ({ ...f, guestPhone: e.target.value }))}
                  placeholder="0901234567"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-emerald-400"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">Email (tùy chọn)</label>
                <input
                  type="email"
                  value={guestForm.guestEmail}
                  onChange={(e) => setGuestForm(f => ({ ...f, guestEmail: e.target.value }))}
                  placeholder="example@gmail.com"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-emerald-400"
                />
              </div>
              <div className="border border-blue-100 rounded-xl p-3 bg-blue-50 space-y-2">
                <p className="text-xs font-medium text-blue-700">Tài khoản nhận hoàn tiền (nếu đơn bị từ chối)</p>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={guestForm.guestBankName}
                    onChange={(e) => setGuestForm(f => ({ ...f, guestBankName: e.target.value }))}
                    placeholder="Ngân hàng (VD: MBBank)"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-blue-400"
                  />
                  <input
                    type="text"
                    value={guestForm.guestBankAccount}
                    onChange={(e) => setGuestForm(f => ({ ...f, guestBankAccount: e.target.value }))}
                    placeholder="Số tài khoản"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-blue-400"
                  />
                </div>
                <p className="text-xs text-blue-500">Không bắt buộc. Dùng để chủ sân hoàn tiền nếu từ chối đơn.</p>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-700">
                Sau khi đặt, bạn cần thanh toán qua mã QR của chủ sân. Lưu lại số điện thoại để tra cứu lịch đặt.
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setGuestBookingParams(null)}
                  className="flex-1 border border-gray-300 text-gray-600 py-2.5 rounded-xl text-sm hover:bg-gray-50 transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={guestSubmitting}
                  className="flex-1 bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-300 text-white py-2.5 rounded-xl text-sm font-medium transition-colors"
                >
                  {guestSubmitting ? "Đang xử lý..." : "Xác nhận đặt sân"}
                </button>
              </div>
            </form>

            <div className="mt-3 text-center">
              <button
                type="button"
                onClick={() => { setGuestBookingParams(null); router.push("/login"); }}
                className="text-xs text-emerald-600 hover:underline"
              >
                Đã có tài khoản? Đăng nhập để đặt sân
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal thành công - Hiện QR thanh toán */}
      {guestSuccess && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl text-center">
            <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="font-bold text-black text-lg mb-1">Đặt sân thành công!</h3>
            <p className="text-gray-500 text-sm mb-4">Mã đặt sân: <span className="font-semibold text-black">#{guestSuccess.bookingId}</span></p>

            {guestSuccess.vietqrUrl ? (
              <div>
                <p className="text-sm text-gray-700 mb-1 font-medium">Quét mã VietQR để thanh toán</p>
                <p className="text-xs text-emerald-600 mb-3">Tự động điền đúng số tiền & mã đặt sân — dùng mọi app ngân hàng</p>
                <div className="flex justify-center mb-3">
                  <img
                    src={guestSuccess.vietqrUrl}
                    alt="VietQR thanh toán"
                    className="w-52 h-52 object-contain border border-emerald-200 rounded-xl"
                  />
                </div>
                <p className="text-xs text-gray-400 mb-4">Mở app ngân hàng → Quét QR → Kiểm tra thông tin → Xác nhận chuyển khoản</p>
              </div>
            ) : guestSuccess.qrUrl ? (
              <div>
                <p className="text-sm text-gray-700 mb-3 font-medium">Quét mã QR để thanh toán cho chủ sân</p>
                <div className="flex justify-center mb-3">
                  <img
                    src={guestSuccess.qrUrl}
                    alt="QR thanh toán"
                    className="w-48 h-48 object-contain border border-gray-200 rounded-xl"
                  />
                </div>
                <p className="text-xs text-gray-400 mb-4">Vui lòng chuyển khoản theo thông tin trong QR và ghi rõ mã đặt sân</p>
              </div>
            ) : (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4 text-sm text-amber-700">
                Chủ sân chưa thiết lập mã QR. Vui lòng liên hệ <strong>{facility?.owner?.phone}</strong> để thanh toán.
              </div>
            )}

            <div className="bg-gray-50 rounded-xl px-4 py-3 text-xs text-gray-600 mb-4 text-left space-y-1">
              <p>Tra cứu lịch đặt tại trang chủ bằng số điện thoại đã đăng ký.</p>
              <p>Lịch sẽ hiển thị đến khi kết thúc giờ chơi.</p>
            </div>

            <button
              onClick={() => setGuestSuccess(null)}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-white py-3 rounded-xl text-sm font-medium transition-colors"
            >
              Đóng
            </button>
          </div>
        </div>
      )}
    </div>
  );
}