"use client";
import { useState, useEffect } from "react";
import {
  generateCourtSlots,
  getSlotPrice,
  getSlotPriceLabel,
  isHoliday,
  isWeekend,
  CourtSlot,
} from "@/lib/court-slots";

interface MatchPost {
  id: number;
  title: string;
  description?: string | null;
  matchDate: string;
  startTime: string;
  endTime: string;
  level: string;
  status: string;
  requiredPlayers: number;
  joinedPlayers: number;
  remaining: number;
  facility: { id: number; name: string; address: string };
  sport: { id: number; name: string; iconUrl: string | null };
  creator: { id: number; fullName: string };
  courtName?: string | null;
  pricePerPerson?: number | null;
  createdAt: string;
}

interface TeammateModalProps {
  onClose: () => void;
  currentUserId?: number;
}

const levelLabel: Record<string, string> = {
  BEGINNER: "Người mới",
  INTERMEDIATE: "Trung bình",
  PRO: "Chuyên nghiệp",
};

const levelColor: Record<string, string> = {
  BEGINNER: "bg-green-100 text-green-700",
  INTERMEDIATE: "bg-yellow-100 text-yellow-700",
  PRO: "bg-red-100 text-red-700",
};

function toMinutes(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export default function TeammateModal({ onClose, currentUserId }: TeammateModalProps) {
  const [posts, setPosts] = useState<MatchPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"list" | "create">("list");
  const [joining, setJoining] = useState<number | null>(null);
  const [toast, setToast] = useState("");

  // Lọc tỉnh/thành
  const [provinces, setProvinces] = useState<{ code: number; name: string }[]>([]);
  const [filterProvince, setFilterProvince] = useState("");
  const [filterProvinceCode, setFilterProvinceCode] = useState<number | null>(null);
  const [provinceQuery, setProvinceQuery] = useState("");
  const [showProvinceDrop, setShowProvinceDrop] = useState(false);

  // Lọc xã/phường
  const [districts, setDistricts] = useState<{ code: number; name: string }[]>([]);
  const [filterDistrict, setFilterDistrict] = useState("");
  const [districtQuery, setDistrictQuery] = useState("");
  const [showDistrictDrop, setShowDistrictDrop] = useState(false);

  // Danh sách cơ sở (list endpoint)
  const [facilities, setFacilities] = useState<any[]>([]);
  // Chi tiết cơ sở đang chọn (để lấy courts)
  const [facilityDetail, setFacilityDetail] = useState<any | null>(null);
  const [filteredCourts, setFilteredCourts] = useState<any[]>([]);

  // Slots
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);
  const [bookedSlots, setBookedSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  const [form, setForm] = useState({
    facilityId: "",
    categoryId: "",
    courtId: "",
    courtName: "",
    matchDate: "",
    startTime: "",
    endTime: "",
    level: "BEGINNER",
    requiredPlayers: "4",
    description: "",
    totalPrice: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [showPayConfirm, setShowPayConfirm] = useState(false);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);

  const nowVN = new Date(new Date().getTime() + 7 * 60 * 60 * 1000).toISOString().split("T")[0];
  const nowMinutes = (() => {
    const n = new Date(new Date().getTime() + 7 * 60 * 60 * 1000);
    return n.getUTCHours() * 60 + n.getUTCMinutes();
  })();

  useEffect(() => {
    loadPosts();
    fetch("/api/facilities")
      .then((r) => r.json())
      .then((data) => setFacilities(Array.isArray(data) ? data : []));
    fetch("https://provinces.open-api.vn/api/p/")
      .then((r) => r.json())
      .then((data) => setProvinces(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  function loadPosts() {
    setLoading(true);
    fetch("/api/match-posts?status=OPEN")
      .then((r) => r.json())
      .then((data) => {
        setPosts(Array.isArray(data) ? data : []);
        setLoading(false);
      });
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3500);
  }

  async function handleFacilityChange(facilityId: string) {
    setForm((f) => ({ ...f, facilityId, categoryId: "", courtId: "", courtName: "", startTime: "", endTime: "", totalPrice: "" }));
    setFilteredCourts([]);
    setSelectedSlots([]);
    setBookedSlots([]);
    setFacilityDetail(null);
    if (!facilityId) return;
    const data = await fetch(`/api/facilities/${facilityId}`).then((r) => r.json());
    setFacilityDetail(data);
  }

  function handleSportChange(categoryId: string) {
    setForm((f) => ({ ...f, categoryId, courtId: "", courtName: "", startTime: "", endTime: "", totalPrice: "" }));
    setSelectedSlots([]);
    setBookedSlots([]);
    if (facilityDetail && categoryId) {
      const courts = (facilityDetail.courts || []).filter(
        (c: any) => String(c.category.id) === categoryId
      );
      setFilteredCourts(courts);
    } else {
      setFilteredCourts([]);
    }
  }

  function handleCourtChange(courtId: string) {
    const court = filteredCourts.find((c: any) => String(c.id) === courtId);
    setForm((f) => ({ ...f, courtId, courtName: court?.name || "", startTime: "", endTime: "", totalPrice: "" }));
    setSelectedSlots([]);
    if (courtId && form.matchDate) loadBookedSlots(courtId, form.matchDate);
  }

  function handleDateChange(matchDate: string) {
    setForm((f) => ({ ...f, matchDate, startTime: "", endTime: "", totalPrice: "" }));
    setSelectedSlots([]);
    if (form.courtId && matchDate) loadBookedSlots(form.courtId, matchDate);
  }

  async function loadBookedSlots(courtId: string, date: string) {
    setLoadingSlots(true);
    const data = await fetch(`/api/courts/${courtId}/booked-slots?date=${date}`).then((r) => r.json());
    setBookedSlots(data.bookedSlots || []);
    setLoadingSlots(false);
  }

  // Lấy tên môn của court đang chọn
  const selectedSportName = (() => {
    if (!form.categoryId || !facilityDetail) return "";
    const sport = (facilityDetail.sports || []).find((s: any) => String(s.id) === form.categoryId);
    return sport?.name || "";
  })();

  const allSlots: CourtSlot[] = form.courtId && form.matchDate && selectedSportName
    ? generateCourtSlots(selectedSportName, form.matchDate)
    : [];

  const holiday = form.matchDate ? isHoliday(form.matchDate) : false;
  const weekend = form.matchDate ? isWeekend(form.matchDate) : false;
  const isToday = form.matchDate === nowVN;

  function isPastSlot(slotTime: string) {
    return isToday && toMinutes(slotTime) < nowMinutes;
  }

  function toggleSlot(slotTime: string) {
    if (bookedSlots.includes(slotTime) || isPastSlot(slotTime)) return;
    const newSlots = selectedSlots.includes(slotTime)
      ? selectedSlots.filter((s) => s !== slotTime)
      : [...selectedSlots, slotTime];
    setSelectedSlots(newSlots);

    if (newSlots.length === 0) {
      setForm((f) => ({ ...f, startTime: "", endTime: "", totalPrice: "" }));
    } else {
      const sorted = [...newSlots].sort((a, b) => toMinutes(a) - toMinutes(b));
      const lastSlot = allSlots.find((s) => s.time === sorted[sorted.length - 1]);
      const total = newSlots.reduce((sum, t) => {
        const slot = allSlots.find((s) => s.time === t);
        return sum + (slot ? getSlotPrice(slot, form.matchDate) : 0);
      }, 0);
      setForm((f) => ({
        ...f,
        startTime: sorted[0],
        endTime: lastSlot?.end || "",
        totalPrice: String(total),
      }));
    }
  }

  async function handleJoin(postId: number) {
    if (!currentUserId) {
      showToast("Vui lòng đăng nhập để tham gia!");
      return;
    }
    setJoining(postId);
    const res = await fetch(`/api/match-posts/${postId}/join`, { method: "POST" });
    const data = await res.json();
    setJoining(null);
    if (res.ok) {
      showToast("Đã tham gia thành công!");
      loadPosts();
    } else {
      showToast(data.error || "Có lỗi xảy ra!");
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!currentUserId) {
      showToast("Vui lòng đăng nhập để đăng bài!");
      return;
    }
    if (!form.facilityId || !form.categoryId || !form.courtId || !form.matchDate || !form.startTime || !form.endTime) {
      showToast("Vui lòng chọn sân và khung giờ!");
      return;
    }
    // Fetch số dư ví rồi hiển thị bước xác nhận
    const walletData = await fetch("/api/wallet/detail").then((r) => r.json());
    setWalletBalance(walletData.wallet ? Number(walletData.wallet.balance) : 0);
    setShowPayConfirm(true);
  }

  async function handleConfirmPay() {
    setSubmitting(true);
    setShowPayConfirm(false);
    const res = await fetch("/api/match-posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        facilityId: Number(form.facilityId),
        categoryId: Number(form.categoryId),
        courtId: Number(form.courtId),
        courtName: form.courtName,
        matchDate: form.matchDate,
        startTime: form.startTime,
        endTime: form.endTime,
        level: form.level,
        requiredPlayers: Number(form.requiredPlayers),
        description: form.description,
        totalPrice: form.totalPrice ? Number(form.totalPrice) : undefined,
      }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (res.ok) {
      showToast("Đã đăng bài tìm đồng đội!");
      setTab("list");
      loadPosts();
      setForm({
        facilityId: "", categoryId: "", courtId: "", courtName: "",
        matchDate: "", startTime: "", endTime: "",
        level: "BEGINNER", requiredPlayers: "4", description: "", totalPrice: "",
      });
      setFacilityDetail(null);
      setFilteredCourts([]);
      setSelectedSlots([]);
      setBookedSlots([]);
    } else {
      showToast(data.error || "Có lỗi xảy ra!");
    }
  }

  // Tổng tiền từ slot đã chọn
  const totalSlotPrice = selectedSlots.reduce((sum, t) => {
    const slot = allSlots.find((s) => s.time === t);
    return sum + (slot ? getSlotPrice(slot, form.matchDate) : 0);
  }, 0);

  const selectedFacilityObj = facilities.find((f: any) => String(f.id) === form.facilityId);

  // Lọc bài đăng theo tỉnh/thành + xã/phường
  const displayedPosts = posts.filter((p) => {
    const addr = p.facility.address.toLowerCase();
    if (filterProvince && !addr.includes(filterProvince.toLowerCase())) return false;
    if (filterDistrict && !addr.includes(filterDistrict.toLowerCase())) return false;
    return true;
  });

  // Gợi ý tỉnh theo query
  const provinceSuggestions = provinceQuery.trim()
    ? provinces.filter((p) =>
        p.name.toLowerCase().includes(provinceQuery.toLowerCase())
      ).slice(0, 8)
    : provinces.slice(0, 8);

  // Gợi ý quận/huyện/xã theo query
  const districtSuggestions = districtQuery.trim()
    ? districts.filter((d) =>
        d.name.toLowerCase().includes(districtQuery.toLowerCase())
      ).slice(0, 8)
    : districts.slice(0, 8);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between" style={{ background: "#E0EEE0" }}>
          <div className="flex items-center gap-3">
            <div>
              <h2 className="font-bold text-black text-lg">Tìm đồng đội</h2>
              <p className="text-gray-500 text-xs">Kết nối người chơi · Ghép nhóm · Đặt sân cùng nhau</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200 text-gray-500 transition-colors font-semibold"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 bg-white">
          <button
            onClick={() => setTab("list")}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              tab === "list"
                ? "text-emerald-600 border-b-2 border-emerald-500 bg-emerald-50"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <span className="flex items-center justify-center gap-1.5">
              <img src="/list.png" className="w-4 h-4" alt="" />
              Bài đăng ({(filterProvince || filterDistrict) ? `${displayedPosts.length}/${posts.length}` : posts.length})
            </span>
          </button>
          <button
            onClick={() => setTab("create")}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              tab === "create"
                ? "text-emerald-600 border-b-2 border-emerald-500 bg-emerald-50"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            + Đăng tìm đồng đội
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {tab === "list" ? (
            <>
              {/* Filter tỉnh/thành + xã/phường */}
              <div className="flex gap-2 mb-3">
                {/* Tỉnh / Thành phố */}
                <div className="relative flex-1">
                  <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
                    <img src="/placeholder.png" className="w-3.5 h-3.5 flex-shrink-0 opacity-50" alt="" />
                    <input
                      type="text"
                      placeholder="Tỉnh / Thành phố"
                      value={provinceQuery}
                      onChange={(e) => {
                        setProvinceQuery(e.target.value);
                        setShowProvinceDrop(true);
                        if (!e.target.value) {
                          setFilterProvince("");
                          setFilterProvinceCode(null);
                          setDistricts([]);
                          setFilterDistrict("");
                          setDistrictQuery("");
                        }
                      }}
                      onFocus={() => setShowProvinceDrop(true)}
                      onBlur={() => setTimeout(() => setShowProvinceDrop(false), 150)}
                      className="flex-1 bg-transparent text-xs text-black placeholder-gray-400 focus:outline-none min-w-0"
                    />
                    {filterProvince && (
                      <button
                        type="button"
                        onClick={() => {
                          setFilterProvince("");
                          setFilterProvinceCode(null);
                          setProvinceQuery("");
                          setDistricts([]);
                          setFilterDistrict("");
                          setDistrictQuery("");
                        }}
                        className="text-gray-400 hover:text-gray-600 text-xs flex-shrink-0"
                      >✕</button>
                    )}
                  </div>
                  {showProvinceDrop && provinceSuggestions.length > 0 && (
                    <ul className="absolute z-50 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-44 overflow-y-auto mt-1">
                      {provinceSuggestions.map((p) => (
                        <li
                          key={p.code}
                          onMouseDown={() => {
                            setFilterProvince(p.name);
                            setFilterProvinceCode(p.code);
                            setProvinceQuery(p.name);
                            setShowProvinceDrop(false);
                            setFilterDistrict("");
                            setDistrictQuery("");
                            fetch(`https://provinces.open-api.vn/api/p/${p.code}?depth=2`)
                              .then((r) => r.json())
                              .then((d) => setDistricts(Array.isArray(d.districts) ? d.districts : []))
                              .catch(() => {});
                          }}
                          className={`px-3 py-2 text-xs cursor-pointer transition-colors ${
                            filterProvince === p.name
                              ? "bg-emerald-50 text-emerald-700 font-medium"
                              : "text-black hover:bg-gray-50"
                          }`}
                        >
                          {p.name}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Quận / Phường */}
                <div className="relative flex-1">
                  <div className={`flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 ${!filterProvinceCode ? "opacity-50" : ""}`}>
                    <img src="/placeholder.png" className="w-3.5 h-3.5 flex-shrink-0 opacity-50" alt="" />
                    <input
                      type="text"
                      placeholder="Xã / Phường"
                      value={districtQuery}
                      disabled={!filterProvinceCode}
                      onChange={(e) => {
                        setDistrictQuery(e.target.value);
                        setShowDistrictDrop(true);
                        if (!e.target.value) setFilterDistrict("");
                      }}
                      onFocus={() => setShowDistrictDrop(true)}
                      onBlur={() => setTimeout(() => setShowDistrictDrop(false), 150)}
                      className="flex-1 bg-transparent text-xs text-black placeholder-gray-400 focus:outline-none min-w-0 disabled:cursor-not-allowed"
                    />
                    {filterDistrict && (
                      <button
                        type="button"
                        onClick={() => { setFilterDistrict(""); setDistrictQuery(""); }}
                        className="text-gray-400 hover:text-gray-600 text-xs flex-shrink-0"
                      >✕</button>
                    )}
                  </div>
                  {showDistrictDrop && districtSuggestions.length > 0 && (
                    <ul className="absolute z-50 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-44 overflow-y-auto mt-1">
                      {districtSuggestions.map((d) => (
                        <li
                          key={d.code}
                          onMouseDown={() => {
                            setFilterDistrict(d.name);
                            setDistrictQuery(d.name);
                            setShowDistrictDrop(false);
                          }}
                          className={`px-3 py-2 text-xs cursor-pointer transition-colors ${
                            filterDistrict === d.name
                              ? "bg-emerald-50 text-emerald-700 font-medium"
                              : "text-black hover:bg-gray-50"
                          }`}
                        >
                          {d.name}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-28 bg-gray-100 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : displayedPosts.length === 0 ? (
              <div className="text-center py-16 text-gray-500">
                <img src="/list.png" className="w-16 h-16 mx-auto opacity-30 mb-3" alt="" />
                {(filterProvince || filterDistrict) ? (
                  <>
                    <p className="text-sm font-medium">
                      Không có bài đăng {filterDistrict ? `tại ${filterDistrict}` : filterProvince ? `ở ${filterProvince}` : ""}
                    </p>
                    <button
                      onClick={() => {
                        setFilterProvince(""); setFilterProvinceCode(null); setProvinceQuery("");
                        setFilterDistrict(""); setDistrictQuery(""); setDistricts([]);
                      }}
                      className="mt-3 text-xs text-emerald-600 underline"
                    >
                      Xem tất cả
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-medium">Chưa có bài đăng nào</p>
                    <p className="text-xs text-gray-400 mt-1">Hãy là người đầu tiên tìm đồng đội!</p>
                    <button
                      onClick={() => setTab("create")}
                      className="mt-4 bg-emerald-500 hover:bg-emerald-400 text-white text-sm px-5 py-2 rounded-xl transition-colors font-medium"
                    >
                      + Đăng ngay
                    </button>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {(filterProvince || filterDistrict) && (
                  <p className="text-xs text-gray-500 mb-1">
                    {displayedPosts.length} bài đăng
                    {filterDistrict && <> tại <span className="font-semibold text-emerald-600">{filterDistrict}</span></>}
                    {filterProvince && !filterDistrict && <>, <span className="font-semibold text-emerald-600">{filterProvince}</span></>}
                  </p>
                )}
                {displayedPosts.map((post) => (
                  <div
                    key={post.id}
                    className="border border-gray-200 rounded-xl p-4 hover:border-emerald-300 transition-colors"
                    style={{ background: "#f8fffe" }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <img
                          src={post.sport.iconUrl || "/group.png"}
                          className="w-10 h-10 rounded-lg border border-gray-200 bg-white p-1 flex-shrink-0"
                          alt={post.sport.name}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="font-semibold text-black text-sm">{post.title}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${levelColor[post.level]}`}>
                              {levelLabel[post.level]}
                            </span>
                          </div>
                          {post.courtName && (
                            <p className="text-xs font-medium text-gray-700 mb-0.5 flex items-center gap-1">
                              <img src="/list.png" className="w-3.5 h-3.5 flex-shrink-0 opacity-60" alt="" />
                              {post.courtName}
                            </p>
                          )}
                          <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                            <img src="/placeholder.png" className="w-3.5 h-3.5 flex-shrink-0" alt="" />
                            {post.facility.name} · {post.facility.address}
                          </p>
                          <p className="text-xs text-gray-500 mb-2 flex items-center gap-1">
                            <img src="/calendar.png" className="w-3.5 h-3.5 flex-shrink-0" alt="" />
                            {(() => {
                              const [y, m, d] = post.matchDate.toString().split("T")[0].split("-").map(Number);
                              return new Date(y, m - 1, d).toLocaleDateString("vi-VN", {
                                weekday: "long",
                                day: "2-digit",
                                month: "2-digit",
                              });
                            })()}
                            {" "}· {post.startTime} – {post.endTime}
                          </p>
                          {post.description && (
                            <p className="text-xs text-gray-600 mb-2 italic">"{post.description}"</p>
                          )}
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                              <div
                                className="h-full bg-emerald-400 rounded-full transition-all"
                                style={{
                                  width: `${Math.min(100, (post.joinedPlayers / post.requiredPlayers) * 100)}%`,
                                }}
                              />
                            </div>
                            <span className="text-xs text-gray-600 font-medium whitespace-nowrap">
                              {post.joinedPlayers}/{post.requiredPlayers} · còn{" "}
                              <span className="text-red-500 font-semibold">{post.remaining}</span>
                            </span>
                          </div>
                          {post.pricePerPerson != null && post.pricePerPerson > 0 && (
                            <div className="mt-1.5 flex items-center gap-1">
                              <span className="text-xs text-gray-500">Phí tham gia:</span>
                              <span className="text-xs font-bold text-emerald-600">
                                {post.pricePerPerson.toLocaleString("vi-VN")}đ / người
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex-shrink-0">
                        {currentUserId && currentUserId === post.creator.id ? (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-lg font-medium">
                            Của bạn
                          </span>
                        ) : (
                          <button
                            onClick={() => handleJoin(post.id)}
                            disabled={joining === post.id}
                            className="bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-300 text-white text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
                          >
                            {joining === post.id ? "..." : "Tham gia"}
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">
                      Đăng bởi {post.creator.fullName} ·{" "}
                      {new Date(post.createdAt).toLocaleDateString("vi-VN")}
                    </p>
                  </div>
                ))}
              </div>
            )}
            </>
          ) : (
            <form onSubmit={handleCreate} className="space-y-4">
              {/* Cơ sở */}
              <div>
                <label className="text-xs text-gray-600 font-medium mb-1 block">Cơ sở sân *</label>
                <select
                  value={form.facilityId}
                  onChange={(e) => handleFacilityChange(e.target.value)}
                  required
                  className="w-full bg-white border border-gray-300 text-black rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-400"
                >
                  <option value="">-- Chọn cơ sở --</option>
                  {facilities.map((f: any) => (
                    <option key={f.id} value={f.id}>
                      {f.name} · {f.address}
                    </option>
                  ))}
                </select>
              </div>

              {/* Môn thể thao + Trình độ */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-600 font-medium mb-1 block">Môn thể thao *</label>
                  <select
                    value={form.categoryId}
                    onChange={(e) => handleSportChange(e.target.value)}
                    required
                    disabled={!form.facilityId || !facilityDetail}
                    className="w-full bg-white border border-gray-300 text-black rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-400 disabled:opacity-50"
                  >
                    <option value="">-- Chọn môn --</option>
                    {(facilityDetail?.sports || []).map((s: any) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-600 font-medium mb-1 block">Trình độ *</label>
                  <select
                    value={form.level}
                    onChange={(e) => setForm((f) => ({ ...f, level: e.target.value }))}
                    className="w-full bg-white border border-gray-300 text-black rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-400"
                  >
                    <option value="BEGINNER">Người mới</option>
                    <option value="INTERMEDIATE">Trung bình</option>
                    <option value="PRO">Chuyên nghiệp</option>
                  </select>
                </div>
              </div>

              {/* Chọn sân cụ thể */}
              {form.categoryId && (
                <div>
                  <label className="text-xs text-gray-600 font-medium mb-1 block">Sân *</label>
                  {filteredCourts.length === 0 ? (
                    <p className="text-xs text-gray-400 px-1">Không có sân nào cho môn này</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {filteredCourts.map((court: any) => (
                        <button
                          key={court.id}
                          type="button"
                          onClick={() => handleCourtChange(String(court.id))}
                          className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm text-left transition-colors ${
                            form.courtId === String(court.id)
                              ? "bg-emerald-500 text-white border-emerald-500"
                              : "bg-white text-gray-700 border-gray-300 hover:border-emerald-400"
                          }`}
                        >
                          <img
                            src={court.category?.iconUrl || "/list.png"}
                            className="w-5 h-5 flex-shrink-0"
                            alt=""
                          />
                          <span className="font-medium truncate">{court.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Thông tin sân + địa chỉ khi đã chọn */}
              {form.courtId && selectedFacilityObj && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center gap-3">
                  <img src="/placeholder.png" className="w-4 h-4 flex-shrink-0 opacity-60" alt="" />
                  <div className="text-xs">
                    <p className="font-semibold text-gray-800">{form.courtName} · {selectedFacilityObj.name}</p>
                    <p className="text-gray-500">{selectedFacilityObj.address}</p>
                  </div>
                </div>
              )}

              {/* Ngày chơi */}
              {form.courtId && (
                <div>
                  <label className="text-xs text-gray-600 font-medium mb-1 block">Ngày chơi *</label>
                  <input
                    type="date"
                    value={form.matchDate}
                    onChange={(e) => handleDateChange(e.target.value)}
                    min={nowVN}
                    required
                    className="w-full bg-white border border-gray-300 text-black rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-400"
                  />
                </div>
              )}

              {/* Slot picker */}
              {form.courtId && form.matchDate && (
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
                    {(weekend || holiday) && (
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

                  {loadingSlots ? (
                    <div className="h-20 bg-gray-100 rounded-xl animate-pulse" />
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {allSlots.map((slot) => {
                        const isBooked = bookedSlots.includes(slot.time);
                        const isPast = isPastSlot(slot.time);
                        const isSelected = selectedSlots.includes(slot.time);

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
                          <button
                            key={slot.time}
                            type="button"
                            onClick={() => toggleSlot(slot.time)}
                            disabled={isBooked || isPast}
                            className={`${cls} ${pad}`}
                            style={bgStyle}
                          >
                            <div className="font-semibold text-[11px]">{slot.label}</div>
                            <div className="text-[10px] opacity-70 mt-0.5">
                              {getSlotPriceLabel(slot, form.matchDate)}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Tổng kết khung giờ đã chọn */}
                  {selectedSlots.length > 0 && (
                    <div className="mt-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-center justify-between">
                      <div>
                        <p className="text-xs text-gray-500">{selectedSlots.length} slot · {form.startTime} – {form.endTime}</p>
                        <p className="font-bold text-emerald-600">{totalSlotPrice.toLocaleString("vi-VN")}đ</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedSlots([]);
                          setForm((f) => ({ ...f, startTime: "", endTime: "", totalPrice: "" }));
                        }}
                        className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                      >
                        Xóa chọn
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Số người cần */}
              <div>
                <label className="text-xs text-gray-600 font-medium mb-1 block">Cần bao nhiêu người? *</label>
                <input
                  type="number"
                  value={form.requiredPlayers}
                  onChange={(e) => setForm((f) => ({ ...f, requiredPlayers: e.target.value }))}
                  min="2"
                  max="30"
                  required
                  className="w-full bg-white border border-gray-300 text-black rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-400"
                />
                <p className="text-xs text-gray-400 mt-1">Tổng số người cần (bao gồm bạn)</p>
              </div>

              {/* Mô tả */}
              <div>
                <label className="text-xs text-gray-600 font-medium mb-1 block">Mô tả (không bắt buộc)</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="VD: Tìm 3 người chơi pickleball trình độ beginner, vui vẻ..."
                  rows={3}
                  className="w-full bg-white border border-gray-300 text-black rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-400 resize-none"
                />
              </div>

              {form.totalPrice && Number(form.totalPrice) > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-700">
                  <p className="font-semibold mb-0.5">Thanh toán khi đăng bài</p>
                  <p>Bạn sẽ thanh toán <span className="font-bold">{Number(form.totalPrice).toLocaleString("vi-VN")}đ</span> từ ví SportHub để đặt sân.</p>
                  {Number(form.requiredPlayers) > 1 && (
                    <p className="mt-0.5">Mỗi người tham gia sẽ trả lại <span className="font-bold">{Math.ceil(Number(form.totalPrice) / Number(form.requiredPlayers)).toLocaleString("vi-VN")}đ</span> vào ví của bạn.</p>
                  )}
                </div>
              )}
              <button
                type="submit"
                disabled={submitting || !form.startTime}
                className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-300 text-white py-3 rounded-xl text-sm font-semibold transition-colors"
              >
                {submitting ? "Đang xử lý..." : form.totalPrice && Number(form.totalPrice) > 0 ? `Đặt sân & Đăng tìm đồng đội` : "Đăng tìm đồng đội"}
              </button>
            </form>
          )}
        </div>

        {/* Modal xác nhận thanh toán */}
        {showPayConfirm && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50 rounded-2xl p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
              <h3 className="font-bold text-black text-base mb-4 flex items-center gap-2">
                <img src="/atm-card.png" className="w-5 h-5" alt="" />
                Xác nhận thanh toán
              </h3>

              {/* Chi tiết đặt sân */}
              <div className="bg-gray-50 rounded-xl p-3 mb-4 space-y-1.5 text-xs">
                {selectedFacilityObj && (
                  <div className="flex items-center gap-1.5 text-gray-700">
                    <img src="/placeholder.png" className="w-3.5 h-3.5 flex-shrink-0" alt="" />
                    <span className="font-medium">{form.courtName}</span>
                    <span className="text-gray-400">·</span>
                    <span className="text-gray-500 truncate">{selectedFacilityObj.name}</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5 text-gray-700">
                  <img src="/calendar.png" className="w-3.5 h-3.5 flex-shrink-0" alt="" />
                  <span>
                    {(() => {
                      const [y, m, d] = form.matchDate.split("-").map(Number);
                      return new Date(y, m - 1, d).toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit" });
                    })()}
                    {" · "}{form.startTime} – {form.endTime}
                  </span>
                </div>
              </div>

              {/* Thông tin thanh toán */}
              <div className="space-y-2 mb-5">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Tổng tiền sân:</span>
                  <span className="font-bold text-black">{Number(form.totalPrice).toLocaleString("vi-VN")}đ</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Số dư ví hiện tại:</span>
                  <span className={`font-semibold ${(walletBalance ?? 0) >= Number(form.totalPrice) ? "text-emerald-600" : "text-red-500"}`}>
                    {(walletBalance ?? 0).toLocaleString("vi-VN")}đ
                  </span>
                </div>
                <div className="border-t border-gray-100 pt-2 flex justify-between text-sm">
                  <span className="text-gray-600">Số dư sau thanh toán:</span>
                  <span className="font-semibold text-gray-700">
                    {((walletBalance ?? 0) - Number(form.totalPrice)).toLocaleString("vi-VN")}đ
                  </span>
                </div>
                {Number(form.requiredPlayers) > 1 && Number(form.totalPrice) > 0 && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-xs text-emerald-700 mt-1">
                    <p>Phí tham gia / người: <span className="font-bold">{Math.ceil(Number(form.totalPrice) / Number(form.requiredPlayers)).toLocaleString("vi-VN")}đ</span></p>
                    <p className="mt-0.5 text-emerald-600">Tiền của người tham gia sẽ hoàn lại vào ví bạn.</p>
                  </div>
                )}
              </div>

              {(walletBalance ?? 0) < Number(form.totalPrice) ? (
                <div className="mb-4 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  Số dư ví không đủ. Vui lòng nạp thêm tiền vào ví SportHub.
                </div>
              ) : null}

              <div className="flex gap-3">
                <button
                  onClick={() => setShowPayConfirm(false)}
                  className="flex-1 border border-gray-300 text-gray-600 py-2.5 rounded-xl text-sm hover:bg-gray-50 transition-colors"
                >
                  Hủy
                </button>
                <button
                  onClick={handleConfirmPay}
                  disabled={(walletBalance ?? 0) < Number(form.totalPrice)}
                  className="flex-1 bg-emerald-500 hover:bg-emerald-400 disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-2.5 rounded-xl text-sm font-semibold transition-colors"
                >
                  Xác nhận thanh toán
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Toast */}
        {toast && (
          <div
            className={`mx-4 mb-4 px-4 py-3 rounded-xl text-sm font-medium text-white ${
              toast.includes("thành công") || toast.includes("Đã")
                ? "bg-emerald-500"
                : "bg-red-500"
            }`}
          >
            {toast}
          </div>
        )}
      </div>
    </div>
  );
}
