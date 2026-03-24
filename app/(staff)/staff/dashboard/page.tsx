"use client";
import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import {
  generateCourtSlots, getSlotPrice, getSlotPriceLabel,
  isHoliday, isWeekend, CourtSlot,
} from "@/lib/court-slots";

// ─── Types ───────────────────────────────────────────────────────────────────
interface StaffInfo {
  facilityStaff: { facilityId: number; role: string; facility: { id: number; name: string; address: string } } | null;
  attendance: AttendanceRecord | null;
  walletBalance: number;
}
interface AttendanceRecord {
  id: number; status: string;
  checkInTime: string | null; checkOutTime: string | null; totalHours: number | null;
}
interface Booking {
  id: number; startTime: string; endTime: string; totalPrice: string;
  status: string; isWalkIn: boolean; createdByStaff: boolean; walkInName: string | null;
  court: { name: string; category: { name: string } };
  customer: { fullName: string; phone: string } | null;
  invoice: { id: number; finalTotal: string; paymentMethod: string } | null;
}
interface Service { id: number; name: string; type: string; price: string; stockQuantity: number }
interface StockLog { id: number; type: string; quantity: number; note: string | null; createdAt: string; service: { name: string } }
interface POSBooking {
  id: number; startTime: string; endTime: string; totalPrice: string;
  isWalkIn: boolean; createdByStaff: boolean; walkInName: string | null;
  customer: { fullName: string; phone: string } | null;
  invoice: { id: number; finalTotal: string; paymentMethod: string; items: { id: number; quantity: number; price: string; service: { name: string } | null }[] } | null;
}
interface POSCourt { id: number; name: string; category: string; activeBooking: POSBooking | null; upcomingCount: number }

const CARD = "border border-gray-300 rounded-2xl p-5 mb-4";
const BG = { background: "#E0EEE0" };
const INPUT = "w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:border-emerald-400";
const BTN_G = "bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-300 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors";
const BTN_R = "bg-red-500 hover:bg-red-400 text-white px-3 py-1.5 rounded-lg text-xs transition-colors";
const BTN_W = "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 px-4 py-2 rounded-xl text-sm transition-colors";

const PM_LABEL: Record<string, string> = { CASH: "💵 Tiền mặt", TRANSFER: "🏦 Chuyển khoản", QR: "📱 VNPay/QR", WALLET: "👜 Ví SportHub" };
// Chỉ 2 phương thức cho nhân viên đặt hộ
const STAFF_PM: { key: string; label: string }[] = [
  { key: "CASH", label: "💵 Tiền mặt" },
  { key: "QR",   label: "📱 VNPay/QR" },
];
const LOG_COLOR: Record<string, string> = { IMPORT: "text-emerald-600", EXPORT: "text-orange-500", DAMAGE: "text-red-500", SOLD: "text-blue-500" };
const LOG_LABEL: Record<string, string> = { IMPORT: "Nhập kho", EXPORT: "Xuất kho", DAMAGE: "Hàng hỏng", SOLD: "Đã bán" };

function fmtTime(iso: string) { return new Date(iso).toISOString().substring(11, 16); }
function fmtHHMM(date: Date) { return date.toTimeString().substring(0, 5); }

// ─── Attendance Tab ───────────────────────────────────────────────────────────
function AttendanceTab({ info, onRefresh }: { info: StaffInfo; onRefresh: () => void }) {
  const [loading, setLoading] = useState(false);
  const [geoError, setGeoError] = useState("");
  const [geoStatus, setGeoStatus] = useState<"idle" | "locating" | "ready">("idle");
  const att = info.attendance;
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);

  function getPosition(): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Trình duyệt không hỗ trợ định vị"));
        return;
      }
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      });
    });
  }

  async function handleAttendance(method: "POST" | "PUT") {
    setGeoError("");
    setGeoStatus("locating");
    setLoading(true);

    let position: GeolocationPosition;
    try {
      position = await getPosition();
    } catch (e: any) {
      setGeoStatus("idle");
      setLoading(false);
      if (e.code === 1) setGeoError("Bạn đã từ chối quyền định vị. Vui lòng cấp quyền trong cài đặt trình duyệt.");
      else if (e.code === 2) setGeoError("Không thể xác định vị trí. Hãy thử lại.");
      else if (e.code === 3) setGeoError("Hết thời gian lấy vị trí. Hãy thử lại.");
      else setGeoError("Không lấy được vị trí: " + e.message);
      return;
    }

    setGeoStatus("ready");
    const { latitude, longitude } = position.coords;

    const res = await fetch("/api/staff/attendance", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ latitude, longitude }),
    });
    const data = await res.json();
    setLoading(false);
    setGeoStatus("idle");

    if (!res.ok) {
      if (data.error === "OUT_OF_RANGE") {
        setGeoError(
          `Bạn đang cách ${info.facilityStaff?.facility.name || "cơ sở"} khoảng ${data.distance}m. ` +
          `Phải ở trong phạm vi ${data.max}m để chấm công.`
        );
      } else if (data.error === "NO_LOCATION") {
        setGeoError("Không nhận được tọa độ. Hãy thử lại.");
      } else if (data.error === "NO_FACILITY_LOCATION") {
        setGeoError("Cơ sở chưa cập nhật tọa độ. Liên hệ chủ sân.");
      } else {
        setGeoError(data.error || "Có lỗi xảy ra.");
      }
      return;
    }

    setGeoError("");
    onRefresh();
  }

  return (
    <div className="max-w-md mx-auto">
      {/* Đồng hồ */}
      <div className={CARD + " text-center"} style={BG}>
        <p className="text-4xl font-bold text-black tabular-nums">{fmtHHMM(now)}</p>
        <p className="text-gray-500 text-sm mt-1">
          {now.toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" })}
        </p>
      </div>

      {/* Thông báo định vị / lỗi */}
      {geoStatus === "locating" && (
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mb-3 text-sm text-blue-700">
          <span className="animate-spin">🔄</span> Đang lấy vị trí GPS...
        </div>
      )}
      {geoError && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-3 text-sm text-red-600">
          📍 {geoError}
        </div>
      )}

      {/* Trạng thái */}
      <div className={CARD} style={BG}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-gray-700">Trạng thái hôm nay</p>
          <span className="text-xs text-gray-400 flex items-center gap-1">📍 Xác minh GPS</span>
        </div>

        {!att ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-200">
              <img src="/infor.png" alt="" className="w-8 h-8 opacity-60" />
              <div>
                <p className="font-semibold text-gray-700">Chưa check-in</p>
                <p className="text-xs text-gray-400">Phải ở trong phạm vi 300m của cơ sở</p>
              </div>
            </div>
            <button onClick={() => handleAttendance("POST")} disabled={loading}
              className={BTN_G + " w-full py-3 text-base"}>
              {loading ? "Đang xử lý..." : "Check-in bắt đầu ca"}
            </button>
          </div>
        ) : att.status === "WORKING" ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-4 bg-emerald-50 rounded-xl border border-emerald-200">
              <span className="text-3xl">🟢</span>
              <div>
                <p className="font-semibold text-emerald-700">Đang làm việc</p>
                <p className="text-xs text-emerald-600">
                  Check-in lúc: {att.checkInTime ? new Date(att.checkInTime).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "--"}
                </p>
              </div>
            </div>
            <button onClick={() => handleAttendance("PUT")} disabled={loading}
              className="w-full bg-orange-500 hover:bg-orange-400 disabled:bg-orange-300 text-white py-3 rounded-xl text-sm font-semibold transition-colors">
              {loading ? "Đang xử lý..." : "🔴 Check-out kết thúc ca"}
            </button>
          </div>
        ) : (
          <div className="p-4 bg-blue-50 rounded-xl border border-blue-200 space-y-1">
            <p className="font-semibold text-blue-700">Đã hoàn thành ca hôm nay</p>
            <p className="text-xs text-blue-600">Check-in: {att.checkInTime ? new Date(att.checkInTime).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "--"}</p>
            <p className="text-xs text-blue-600">Check-out: {att.checkOutTime ? new Date(att.checkOutTime).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "--"}</p>
            <p className="text-xs font-semibold text-blue-700">Tổng giờ làm: {att.totalHours ?? 0}h</p>
          </div>
        )}
      </div>

      {/* Ví */}
      <div className={CARD} style={BG}>
        <p className="text-sm text-gray-500">Số dư ví SportHub</p>
        <p className="text-2xl font-bold text-emerald-600 mt-1">{Number(info.walletBalance).toLocaleString("vi-VN")}đ</p>
      </div>
    </div>
  );
}

// ─── Today's Bookings Tab ─────────────────────────────────────────────────────
function TodayBookingsTab({ facilityId }: { facilityId: number }) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (d: string) => {
    setLoading(true);
    const res = await fetch(`/api/staff/bookings?date=${d}`);
    const data = await res.json();
    setLoading(false);
    setBookings(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => { load(date); }, [date, load]);

  const STATUS_COLOR: Record<string, string> = {
    PENDING: "bg-yellow-100 text-yellow-700 border-yellow-200",
    CONFIRMED: "bg-emerald-100 text-emerald-700 border-emerald-200",
    COMPLETED: "bg-blue-100 text-blue-700 border-blue-200",
    CANCELLED: "bg-red-100 text-red-700 border-red-200",
    NO_SHOW: "bg-gray-100 text-gray-600 border-gray-200",
  };
  const STATUS_LABEL: Record<string, string> = {
    PENDING: "Chờ xác nhận", CONFIRMED: "Đã xác nhận",
    COMPLETED: "Hoàn thành", CANCELLED: "Đã hủy", NO_SHOW: "Vắng mặt",
  };

  return (
    <div>
      <div className={CARD} style={BG}>
        <div className="flex items-center gap-3">
          <input type="date" value={date} onChange={e => { setDate(e.target.value); load(e.target.value); }}
            className={INPUT + " w-44"} />
          <p className="text-sm text-gray-600">{bookings.length} lịch đặt</p>
        </div>
      </div>

      {loading ? (
        <p className="text-center text-gray-400 py-10">Đang tải...</p>
      ) : bookings.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <div className="flex justify-center mb-3"><img src="/calendar.png" alt="" className="w-10 h-10 opacity-40" /></div>
          <p>Không có lịch đặt sân ngày này</p>
        </div>
      ) : (
        <div className="space-y-3">
          {bookings.map(b => (
            <div key={b.id} className={CARD} style={BG}>
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="font-semibold text-black">{b.court.name} <span className="text-gray-400 font-normal text-xs">({b.court.category.name})</span></p>
                  <p className="text-sm font-medium text-emerald-700">{fmtTime(b.startTime)} – {fmtTime(b.endTime)}</p>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${STATUS_COLOR[b.status] || "bg-gray-100 text-gray-600 border-gray-200"}`}>
                  {STATUS_LABEL[b.status] || b.status}
                </span>
              </div>
              <div className="bg-white rounded-xl px-4 py-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Khách</span>
                  <span className="font-medium">
                    {b.isWalkIn ? (b.walkInName || "Khách vãng lai") : (b.customer?.fullName || "—")}
                  </span>
                </div>
                {(b.isWalkIn ? b.walkInName : b.customer?.phone) && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">SĐT</span>
                    <span>{b.isWalkIn ? "—" : b.customer?.phone}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-500">Tiền sân</span>
                  <span className="font-semibold text-emerald-600">{Number(b.totalPrice).toLocaleString("vi-VN")}đ</span>
                </div>
                {b.invoice && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Hóa đơn #{b.invoice.id}</span>
                    <span className="font-semibold text-blue-600">{Number(b.invoice.finalTotal).toLocaleString("vi-VN")}đ — {PM_LABEL[b.invoice.paymentMethod] || b.invoice.paymentMethod}</span>
                  </div>
                )}
              </div>
              <div className="flex gap-2 mt-2">
                {b.isWalkIn && <span className="text-xs text-gray-400">Walk-in tại quầy</span>}
                {(b as any).createdByStaff && <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-medium">Đặt hộ</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Slot helpers → dùng từ @/lib/court-slots

// ─── Court slot picker (1 sân) ────────────────────────────────────────────────
function CourtSlotPicker({
  court, bookedTimes, selectedCourtId, selectedSlots, date,
  onSelect,
}: {
  court: any; bookedTimes: string[]; date: string;
  selectedCourtId: number | null; selectedSlots: string[];
  onSelect: (courtId: number, slot: CourtSlot) => void;
}) {
  const sport = court.category?.name || "";
  const slots = generateCourtSlots(sport, date);
  const isThisCourt = selectedCourtId === court.id;
  const holiday = isHoliday(date);
  const weekend = isWeekend(date);

  return (
    <div className={`border-2 rounded-2xl p-4 transition-all ${isThisCourt ? "border-emerald-400 bg-emerald-50" : "border-gray-200 bg-white"}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">🏟️</span>
          <div>
            <p className="font-semibold text-black text-sm">{court.name}</p>
            <p className="text-xs text-gray-400">{sport}</p>
          </div>
        </div>
        <div className="flex gap-1">
          {weekend && !holiday && <span className="text-[10px] bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full font-medium">Cuối tuần</span>}
          {holiday && <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">Ngày lễ +15%</span>}
        </div>
      </div>

      {/* Chú thích */}
      <div className="flex gap-3 text-[10px] mb-2 flex-wrap">
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded inline-block" style={{background:"#96CDCD"}}></span>Trống</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded inline-block" style={{background:"#EED5D2"}}></span>Đã đặt</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded inline-block" style={{background:"#9BCD9B"}}></span>Cao điểm chiều</span>
        {(weekend || holiday) && <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded inline-block" style={{background:"#FFD580"}}></span>Cao điểm sáng</span>}
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded inline-block" style={{background:"#B0C4DE"}}></span>Đang chọn</span>
      </div>

      {/* Slots */}
      <div className="flex flex-wrap gap-1.5">
        {slots.map(slot => {
          const isBooked = bookedTimes.includes(slot.time);
          const isSelected = isThisCourt && selectedSlots.includes(slot.time);
          let bg = "#96CDCD", border = "#D1EEEE";
          if (isBooked)        { bg = "#EED5D2"; border = "#FFB5C5"; }
          else if (isSelected) { bg = "#B0C4DE"; border = "#7a9cbf"; }
          else if (slot.isMorningPeak) { bg = "#FFD580"; border = "#FFC107"; }
          else if (slot.isPeak)        { bg = "#9BCD9B"; border = "#a8e050"; }
          return (
            <button key={slot.time} disabled={isBooked}
              onClick={() => onSelect(court.id, slot)}
              className={`rounded-lg text-[11px] font-bold border transition-all ${slot.isPeak ? "px-3 py-2" : "px-2 py-1.5"} ${isBooked ? "cursor-not-allowed" : "cursor-pointer hover:opacity-80"} ${isSelected ? "ring-2 ring-blue-400" : ""}`}
              style={{ background: bg, borderColor: border, color: "#000", fontWeight: "bold" }}>
              <div>{slot.label}</div>
              <div className="text-[9px] opacity-70">{getSlotPriceLabel(slot, date)}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Create Invoice Tab ───────────────────────────────────────────────────────
function CreateInvoiceTab({ facilityId }: { facilityId: number }) {
  const [courts, setCourts] = useState<any[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedSport, setSelectedSport] = useState<number | null>(null);
  // courtId → booked time strings
  const [bookedMap, setBookedMap] = useState<Record<number, string[]>>({});
  // slot selection
  const [selectedCourtId, setSelectedCourtId] = useState<number | null>(null);
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);
  // other form
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [selectedServices, setSelectedServices] = useState<{serviceId:number;name:string;quantity:number;price:number}[]>([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<{bookingId:number;invoiceId:number}|null>(null);
  const [error, setError] = useState("");

  // Load courts + services
  useEffect(() => {
    fetch(`/api/facilities/${facilityId}`).then(r=>r.json()).then(d=>setCourts(d.courts||[]));
    fetch(`/api/staff/inventory`).then(r=>r.json()).then(d=>setServices(d.services||[]));
  }, [facilityId]);

  // Load booked slots cho tất cả sân khi đổi ngày
  useEffect(() => {
    if (!courts.length || !date) return;
    const activeCourts = courts.filter((c:any) => c.isActive !== false);
    Promise.all(
      activeCourts.map((c:any) =>
        fetch(`/api/courts/${c.id}/booked-slots?date=${date}`)
          .then(r=>r.json())
          .then(d => ({ id: c.id, slots: (d.bookedSlots||[]) as string[] }))
      )
    ).then(results => {
      const map: Record<number,string[]> = {};
      results.forEach(r => { map[r.id] = r.slots; });
      setBookedMap(map);
    });
    // Reset selection khi đổi ngày
    setSelectedCourtId(null);
    setSelectedSlots([]);
  }, [date, courts]);

  function handleSlotClick(courtId: number, slot: CourtSlot) {
    if (courtId !== selectedCourtId) {
      // Chuyển sang sân khác → reset
      setSelectedCourtId(courtId);
      setSelectedSlots([slot.time]);
      return;
    }
    setSelectedSlots(prev =>
      prev.includes(slot.time) ? prev.filter(s=>s!==slot.time) : [...prev, slot.time]
    );
  }

  const allSlots = (() => {
    if (!selectedCourtId) return [];
    const c = courts.find((c:any)=>c.id===selectedCourtId);
    return c ? generateCourtSlots(c.category?.name||"", date) : [];
  })();

  const sortedSelected = [...selectedSlots].sort();
  const startTime = sortedSelected[0] || "";
  const endSlot = allSlots.find(s=>s.time===sortedSelected[sortedSelected.length-1]);
  const endTime = endSlot?.end || "";
  const courtPrice = selectedSlots.reduce((sum,t)=>{
    const s = allSlots.find(x=>x.time===t);
    return sum+(s?getSlotPrice(s, date):0);
  },0);
  const serviceFee = selectedServices.reduce((sum,s)=>sum+s.quantity*s.price,0);
  const total = courtPrice + serviceFee;

  // Sport groups for filter
  const sports = Array.from(new Map(
    courts.filter((c:any)=>c.isActive!==false).map((c:any)=>[c.category?.id, c.category])
  ).values()).filter(Boolean);

  const filteredCourts = courts.filter((c:any) =>
    c.isActive !== false &&
    (selectedSport === null || c.category?.id === selectedSport)
  );

  function addSvc(svc:Service) {
    setSelectedServices(prev=>{
      const ex=prev.find(s=>s.serviceId===svc.id);
      if(ex) return prev.map(s=>s.serviceId===svc.id?{...s,quantity:s.quantity+1}:s);
      return [...prev,{serviceId:svc.id,name:svc.name,quantity:1,price:Number(svc.price)}];
    });
  }

  async function handleSubmit() {
    setError("");
    if (!selectedCourtId||!selectedSlots.length||!startTime||!endTime) {
      setError("Vui lòng chọn sân và khung giờ!"); return;
    }
    setLoading(true);
    const res = await fetch("/api/staff/bookings", {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        courtId:selectedCourtId, bookingDate:date,
        startTime, endTime, totalPrice:courtPrice,
        customerName:customerName||"Khách vãng lai",
        customerPhone, isWalkIn:true,
        services:selectedServices, paymentMethod,
      }),
    });
    const data = await res.json();
    setLoading(false);
    if(res.ok){
      setSuccess({bookingId:data.booking.id,invoiceId:data.invoice.id});
      setSelectedCourtId(null); setSelectedSlots([]);
      setCustomerName(""); setCustomerPhone("");
      setSelectedServices([]); setPaymentMethod("CASH");
    } else { setError(data.error||"Có lỗi xảy ra"); }
  }

  if(success) return (
    <div className="max-w-md mx-auto text-center py-12">
      <div className="flex justify-center mb-4"><img src="/check-out.png" alt="" className="w-14 h-14" /></div>
      <h2 className="text-xl font-bold text-black mb-2">Đặt hộ thành công!</h2>
      <p className="text-gray-600 mb-1">Mã đặt sân: <span className="font-semibold text-emerald-600">#{success.bookingId}</span></p>
      <p className="text-gray-600 mb-6">Mã hóa đơn: <span className="font-semibold text-blue-600">#{success.invoiceId}</span></p>
      <button onClick={()=>setSuccess(null)} className={BTN_G+" px-8 py-3"}>Đặt hộ mới</button>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Bộ lọc ngày + môn */}
      <div className={CARD} style={BG}>
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Ngày đặt</label>
            <input type="date" className={INPUT+" w-44"} value={date}
              min={new Date().toISOString().split("T")[0]}
              onChange={e=>{setDate(e.target.value);}} />
          </div>
          <div className="flex gap-2 flex-wrap mt-4">
            <button onClick={()=>setSelectedSport(null)}
              className={`px-3 py-1.5 rounded-xl border text-xs font-medium transition-colors ${selectedSport===null?"bg-emerald-500 text-white border-emerald-500":"bg-white text-gray-600 border-gray-300"}`}>
              Tất cả
            </button>
            {sports.map((s:any)=>(
              <button key={s.id} onClick={()=>setSelectedSport(s.id)}
                className={`px-3 py-1.5 rounded-xl border text-xs font-medium transition-colors ${selectedSport===s.id?"bg-emerald-500 text-white border-emerald-500":"bg-white text-gray-600 border-gray-300"}`}>
                {s.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grid sân */}
      <div className="space-y-3">
        {filteredCourts.map((c:any)=>(
          <CourtSlotPicker key={c.id} court={c}
            bookedTimes={bookedMap[c.id]||[]}
            selectedCourtId={selectedCourtId}
            selectedSlots={selectedSlots}
            date={date}
            onSelect={handleSlotClick} />
        ))}
      </div>

      {/* Phần bên dưới chỉ hiện khi đã chọn sân + giờ */}
      {selectedCourtId && selectedSlots.length > 0 && (
        <>
          {/* Tóm tắt lựa chọn */}
          <div className={CARD} style={BG}>
            <p className="font-semibold text-black mb-2">Đã chọn</p>
            <div className="bg-white rounded-xl px-4 py-3 text-sm space-y-1 border border-gray-200">
              <div className="flex justify-between">
                <span className="text-gray-500">Sân</span>
                <span className="font-medium">{courts.find((c:any)=>c.id===selectedCourtId)?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Khung giờ</span>
                <span className="font-medium">{startTime} – {endTime}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Tiền sân</span>
                <span className="font-semibold text-emerald-600">{courtPrice.toLocaleString("vi-VN")}đ</span>
              </div>
            </div>
          </div>

          {/* Thông tin khách */}
          <div className={CARD} style={BG}>
            <p className="font-semibold text-black mb-3">Thông tin khách</p>
            <div className="grid grid-cols-2 gap-2.5">
              <input className={INPUT} placeholder="Tên khách (không bắt buộc)" value={customerName}
                onChange={e=>setCustomerName(e.target.value)} />
              <input className={INPUT} placeholder="Số điện thoại" value={customerPhone}
                onChange={e=>setCustomerPhone(e.target.value)} />
            </div>
          </div>

          {/* Dịch vụ */}
          {services.filter(s=>s.stockQuantity>0).length>0 && (
            <div className={CARD} style={BG}>
              <p className="font-semibold text-black mb-3">Dịch vụ kèm theo</p>
              <div className="grid grid-cols-2 gap-2 mb-3">
                {services.filter(s=>s.stockQuantity>0).map(svc=>(
                  <button key={svc.id} onClick={()=>addSvc(svc)}
                    className="text-left p-3 bg-white rounded-xl border border-gray-200 hover:border-emerald-300 transition-colors">
                    <p className="text-sm font-medium text-black">{svc.name}</p>
                    <p className="text-xs text-gray-500">{Number(svc.price).toLocaleString("vi-VN")}đ · Còn {svc.stockQuantity}</p>
                  </button>
                ))}
              </div>
              {selectedServices.length>0 && (
                <div className="bg-white rounded-xl p-3 border border-gray-200 space-y-1.5">
                  {selectedServices.map(s=>(
                    <div key={s.serviceId} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <button onClick={()=>setSelectedServices(p=>p.filter(x=>x.serviceId!==s.serviceId))} className="text-red-400 text-xs">✕</button>
                        <span>{s.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={()=>setSelectedServices(p=>p.map(x=>x.serviceId===s.serviceId?{...x,quantity:Math.max(1,x.quantity-1)}:x))}
                          className="w-6 h-6 bg-gray-100 rounded-full text-xs font-bold">-</button>
                        <span className="font-medium w-4 text-center">{s.quantity}</span>
                        <button onClick={()=>setSelectedServices(p=>p.map(x=>x.serviceId===s.serviceId?{...x,quantity:x.quantity+1}:x))}
                          className="w-6 h-6 bg-gray-100 rounded-full text-xs font-bold">+</button>
                        <span className="text-emerald-600 w-20 text-right">{(s.quantity*s.price).toLocaleString("vi-VN")}đ</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Thanh toán */}
          <div className={CARD} style={BG}>
            <p className="font-semibold text-black mb-3">Thanh toán</p>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {STAFF_PM.map(({key,label})=>(
                <button key={key} onClick={()=>setPaymentMethod(key)}
                  className={`p-3 rounded-xl border text-sm font-medium transition-colors text-left ${paymentMethod===key?"bg-emerald-100 border-emerald-400 text-emerald-700":"bg-white border-gray-200 text-gray-700 hover:border-emerald-300"}`}>
                  {label}
                </button>
              ))}
            </div>
            <div className="bg-white rounded-xl p-4 border border-gray-200 space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Tiền sân</span><span className="font-medium">{courtPrice.toLocaleString("vi-VN")}đ</span></div>
              {serviceFee>0&&<div className="flex justify-between"><span className="text-gray-500">Dịch vụ</span><span className="font-medium">{serviceFee.toLocaleString("vi-VN")}đ</span></div>}
              <div className="flex justify-between border-t border-gray-100 pt-1.5">
                <span className="font-semibold text-gray-700">Tổng cộng</span>
                <span className="font-bold text-emerald-600 text-base">{total.toLocaleString("vi-VN")}đ</span>
              </div>
            </div>
          </div>

          {error&&<p className="text-red-500 text-sm text-center">{error}</p>}
          <button onClick={handleSubmit} disabled={loading} className={BTN_G+" w-full py-3.5 text-base"}>
            {loading?"Đang xử lý...":"Xác nhận đặt hộ"}
          </button>
        </>
      )}
    </div>
  );
}

// ─── Inventory Tab ────────────────────────────────────────────────────────────
function InventoryTab() {
  const [data, setData] = useState<{ services: Service[]; logs: StockLog[] }>({ services: [], logs: [] });
  const [form, setForm] = useState({ serviceId: "", type: "IMPORT", quantity: "", note: "" });
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [activeView, setActiveView] = useState<"stock" | "logs">("stock");

  const load = useCallback(async () => {
    const res = await fetch("/api/staff/inventory");
    const d = await res.json();
    setData(d);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSubmit() {
    if (!form.serviceId || !form.quantity) return;
    setLoading(true);
    const res = await fetch("/api/staff/inventory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ serviceId: Number(form.serviceId), type: form.type, quantity: Number(form.quantity), note: form.note }),
    });
    setLoading(false);
    if (res.ok) {
      setForm({ serviceId: "", type: "IMPORT", quantity: "", note: "" });
      setShowForm(false);
      load();
    } else {
      const d = await res.json();
      alert(d.error);
    }
  }

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <button onClick={() => setActiveView("stock")} className={activeView === "stock" ? BTN_G : BTN_W}>Tồn kho</button>
        <button onClick={() => setActiveView("logs")} className={activeView === "logs" ? BTN_G : BTN_W}>Lịch sử</button>
        <button onClick={() => setShowForm(!showForm)} className={BTN_G + " ml-auto"}>+ Nhập/Xuất kho</button>
      </div>

      {showForm && (
        <div className={CARD} style={BG}>
          <p className="font-semibold text-black mb-3">Nhập/Xuất kho</p>
          <div className="grid grid-cols-2 gap-2.5">
            <select className={INPUT} value={form.serviceId} onChange={e => setForm(f => ({ ...f, serviceId: e.target.value }))}>
              <option value="">-- Chọn hàng hóa --</option>
              {data.services.map(s => <option key={s.id} value={s.id}>{s.name} (Tồn: {s.stockQuantity})</option>)}
            </select>
            <select className={INPUT} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
              <option value="IMPORT">📥 Nhập kho</option>
              <option value="EXPORT">📤 Xuất kho</option>
              <option value="DAMAGE">Hàng hỏng</option>
            </select>
            <input className={INPUT} type="number" placeholder="Số lượng" value={form.quantity}
              onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} />
            <input className={INPUT} placeholder="Ghi chú (không bắt buộc)" value={form.note}
              onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
          </div>
          <div className="flex justify-end gap-2 mt-3">
            <button onClick={() => setShowForm(false)} className={BTN_W}>Hủy</button>
            <button onClick={handleSubmit} disabled={loading} className={BTN_G}>{loading ? "..." : "Xác nhận"}</button>
          </div>
        </div>
      )}

      {activeView === "stock" ? (
        <div className="overflow-auto rounded-2xl border border-gray-300" style={BG}>
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-200">
              <th className="text-left px-4 py-3 font-semibold text-gray-700">Hàng hóa</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-700">Loại</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-700">Giá</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-700">Tồn kho</th>
            </tr></thead>
            <tbody>
              {data.services.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-8 text-gray-400">Chưa có hàng hóa</td></tr>
              ) : data.services.map(s => (
                <tr key={s.id} className="border-t border-gray-100 hover:bg-white/50">
                  <td className="px-4 py-3 font-medium text-black">{s.name}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2.5 py-1 rounded-full ${s.type === "RENTAL" ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-orange-700"}`}>
                      {s.type === "RENTAL" ? "Cho thuê" : "F&B"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-emerald-600 font-medium">{Number(s.price).toLocaleString("vi-VN")}đ</td>
                  <td className={`px-4 py-3 text-right font-bold ${s.stockQuantity <= 5 ? "text-red-500" : "text-gray-700"}`}>
                    {s.stockQuantity}
                    {s.stockQuantity <= 5 && <span className="ml-1 text-xs font-normal text-red-400">(thấp)</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="space-y-2">
          {data.logs.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <div className="flex justify-center mb-3"><img src="/list.png" alt="" className="w-10 h-10 opacity-40" /></div>
              <p>Chưa có lịch sử kho</p>
            </div>
          ) : data.logs.map(log => (
            <div key={log.id} className={CARD + " flex items-center justify-between"} style={BG}>
              <div>
                <p className="font-medium text-black">{log.service.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">{log.note || "—"}</p>
                <p className="text-xs text-gray-400 mt-0.5">{new Date(log.createdAt).toLocaleString("vi-VN")}</p>
              </div>
              <div className="text-right">
                <span className={`text-sm font-bold ${LOG_COLOR[log.type] || "text-gray-600"}`}>
                  {log.type === "IMPORT" ? "+" : "-"}{log.quantity}
                </span>
                <p className={`text-xs mt-0.5 ${LOG_COLOR[log.type] || "text-gray-500"}`}>{LOG_LABEL[log.type] || log.type}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── POS Tab ─────────────────────────────────────────────────────────────────
function POSTab() {
  const [courts, setCourts] = useState<POSCourt[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [selected, setSelected] = useState<POSCourt | null>(null);
  const [addedServices, setAddedServices] = useState<{ serviceId: number; name: string; quantity: number; price: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/staff/pos");
    const data = await res.json();
    setLoading(false);
    setCourts(data.courts || []);
    setServices(data.services || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Auto refresh mỗi 60s
  useEffect(() => { const t = setInterval(load, 60000); return () => clearInterval(t); }, [load]);

  function openCourt(court: POSCourt) {
    setSelected(court);
    setAddedServices([]);
  }

  function addSvc(svc: Service) {
    setAddedServices(prev => {
      const exists = prev.find(s => s.serviceId === svc.id);
      if (exists) return prev.map(s => s.serviceId === svc.id ? { ...s, quantity: s.quantity + 1 } : s);
      return [...prev, { serviceId: svc.id, name: svc.name, quantity: 1, price: Number(svc.price) }];
    });
  }

  async function saveServices() {
    if (!selected?.activeBooking?.invoice || addedServices.length === 0) return;
    setSaving(true);
    await fetch(`/api/staff/pos/${selected.activeBooking.invoice.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ services: addedServices }),
    });
    setSaving(false);
    setSelected(null);
    load();
  }

  if (loading) return <p className="text-center text-gray-400 py-10">Đang tải...</p>;

  if (selected) {
    const b = selected.activeBooking!;
    const existingTotal = b.invoice ? Number(b.invoice.finalTotal) : 0;
    const addFee = addedServices.reduce((sum, s) => sum + s.quantity * s.price, 0);

    return (
      <div>
        <button onClick={() => setSelected(null)} className={BTN_W + " mb-4"}>← Quay lại</button>
        <div className={CARD} style={BG}>
          <div className="flex justify-between items-start">
            <div>
              <p className="font-bold text-black text-lg">{selected.name} <span className="text-gray-400 font-normal text-sm">({selected.category})</span></p>
              <p className="text-emerald-600 text-sm font-medium mt-0.5">
                {new Date(b.startTime).toISOString().substring(11,16)} – {new Date(b.endTime).toISOString().substring(11,16)}
              </p>
              <p className="text-gray-600 text-sm mt-1">
                {b.isWalkIn ? (b.walkInName || "Khách vãng lai") : (b.customer?.fullName || "—")}
              </p>
            </div>
            <div className="text-right">
              {b.createdByStaff && <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-medium">Đặt hộ</span>}
              {b.invoice && <p className="text-sm text-gray-500 mt-1">HĐ #{b.invoice.id}</p>}
            </div>
          </div>

          {/* Dịch vụ đã có trong hóa đơn */}
          {b.invoice && b.invoice.items.length > 0 && (
            <div className="mt-3 bg-white rounded-xl px-4 py-3 border border-gray-200">
              <p className="text-xs font-semibold text-gray-500 mb-2">Dịch vụ đã dùng:</p>
              {b.invoice.items.map(item => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span className="text-gray-700">{item.service?.name} × {item.quantity}</span>
                  <span className="text-gray-600">{(item.quantity * Number(item.price)).toLocaleString("vi-VN")}đ</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Thêm dịch vụ */}
        {b.invoice ? (
          <div className={CARD} style={BG}>
            <p className="font-semibold text-black mb-3">Thêm dịch vụ</p>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {services.map(svc => (
                <button key={svc.id} onClick={() => addSvc(svc)}
                  className="text-left p-3 bg-white rounded-xl border border-gray-200 hover:border-emerald-300 transition-colors">
                  <p className="text-sm font-medium text-black">{svc.name}</p>
                  <p className="text-xs text-gray-500">{Number(svc.price).toLocaleString("vi-VN")}đ · Còn {svc.stockQuantity}</p>
                </button>
              ))}
            </div>

            {addedServices.length > 0 && (
              <div className="bg-white rounded-xl p-3 border border-gray-200 space-y-1.5 mb-3">
                <p className="text-xs font-semibold text-gray-500 mb-1">Thêm vào hóa đơn:</p>
                {addedServices.map(s => (
                  <div key={s.serviceId} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <button onClick={() => setAddedServices(p => p.filter(x => x.serviceId !== s.serviceId))} className="text-red-400 text-xs">✕</button>
                      <span>{s.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setAddedServices(p => p.map(x => x.serviceId === s.serviceId ? { ...x, quantity: Math.max(1, x.quantity - 1) } : x))}
                        className="w-6 h-6 bg-gray-100 rounded-full text-xs font-bold">-</button>
                      <span className="font-medium w-4 text-center">{s.quantity}</span>
                      <button onClick={() => setAddedServices(p => p.map(x => x.serviceId === s.serviceId ? { ...x, quantity: x.quantity + 1 } : x))}
                        className="w-6 h-6 bg-gray-100 rounded-full text-xs font-bold">+</button>
                      <span className="text-emerald-600 w-20 text-right">{(s.quantity * s.price).toLocaleString("vi-VN")}đ</span>
                    </div>
                  </div>
                ))}
                <div className="border-t border-gray-100 pt-2 flex justify-between font-semibold text-sm">
                  <span>Tổng mới</span>
                  <span className="text-emerald-600">{(existingTotal + addFee).toLocaleString("vi-VN")}đ</span>
                </div>
              </div>
            )}

            <button onClick={saveServices} disabled={saving || addedServices.length === 0} className={BTN_G + " w-full py-3"}>
              {saving ? "Đang lưu..." : "Cập nhật hóa đơn"}
            </button>
          </div>
        ) : (
          <div className="text-center py-6 text-gray-400 text-sm">Booking này chưa có hóa đơn</div>
        )}
      </div>
    );
  }

  const activeCourts = courts.filter(c => c.activeBooking);
  const emptyCourts = courts.filter(c => !c.activeBooking);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">{activeCourts.length}/{courts.length} sân đang có khách</p>
        <button onClick={load} className={BTN_W + " text-xs px-3 py-1.5"}>🔄 Làm mới</button>
      </div>

      {courts.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <div className="text-4xl mb-3">🏟️</div>
          <p>Không có sân nào</p>
        </div>
      ) : (
        <>
          {activeCourts.length > 0 && (
            <div className="mb-5">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Đang có khách</p>
              <div className="grid grid-cols-2 gap-3">
                {activeCourts.map(court => {
                  const b = court.activeBooking!;
                  return (
                    <button key={court.id} onClick={() => openCourt(court)}
                      className="text-left p-4 bg-emerald-50 border-2 border-emerald-300 rounded-2xl hover:border-emerald-500 transition-colors">
                      <div className="flex justify-between items-start">
                        <p className="font-semibold text-black">{court.name}</p>
                        {b.createdByStaff && <span className="text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full">Đặt hộ</span>}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{court.category}</p>
                      <p className="text-sm text-emerald-700 font-medium mt-1.5">
                        {new Date(b.startTime).toISOString().substring(11,16)} – {new Date(b.endTime).toISOString().substring(11,16)}
                      </p>
                      <p className="text-xs text-gray-600 mt-0.5 truncate">
                        {b.isWalkIn ? (b.walkInName || "Khách vãng lai") : (b.customer?.fullName || "—")}
                      </p>
                      <p className="text-xs text-blue-500 mt-1.5 font-medium">Nhấn để thêm dịch vụ →</p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {emptyCourts.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Sân trống</p>
              <div className="grid grid-cols-2 gap-3">
                {emptyCourts.map(court => (
                  <div key={court.id} className="p-4 bg-white border border-gray-200 rounded-2xl opacity-60">
                    <p className="font-medium text-black">{court.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{court.category}</p>
                    {court.upcomingCount > 0 && (
                      <p className="text-xs text-orange-500 mt-2">{court.upcomingCount} lịch sắp tới</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Report Tab ──────────────────────────────────────────────────────────────
const REPORT_TYPES = [
  { value: "FACILITY",         label: "🏟️ Sự cố sân / cơ sở hạ tầng", desc: "Hệ thống điện, nước, mái che, mặt sân..." },
  { value: "EQUIPMENT",        label: "🔧 Thiết bị hỏng hóc",          desc: "Lưới, đèn, máy bơm, thiết bị thể thao..." },
  { value: "INVENTORY_DAMAGE", label: "Hàng hóa hỏng",              desc: "Hàng trong kho bị hỏng, hết hạn, thất thoát..." },
];

const STATUS_STYLE: Record<string, string> = {
  OPEN:     "bg-yellow-100 text-yellow-700 border-yellow-200",
  RESOLVED: "bg-emerald-100 text-emerald-700 border-emerald-200",
};

function ReportTab() {
  const [form, setForm] = useState({ type: "", title: "", description: "" });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<any[]>([]);
  const [view, setView] = useState<"form" | "history">("form");

  const loadHistory = useCallback(async () => {
    const res = await fetch("/api/staff/report");
    if (res.ok) setHistory(await res.json());
  }, []);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  async function handleSubmit() {
    setError("");
    if (!form.type || !form.title || !form.description) {
      setError("Vui lòng điền đầy đủ thông tin."); return;
    }
    setLoading(true);
    const res = await fetch("/api/staff/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setLoading(false);
    if (res.ok) {
      setSuccess(true);
      setForm({ type: "", title: "", description: "" });
      loadHistory();
      setTimeout(() => setSuccess(false), 4000);
    } else {
      const d = await res.json();
      setError(d.error || "Có lỗi xảy ra");
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Toggle */}
      <div className="flex gap-2 mb-4">
        <button onClick={() => setView("form")}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${view === "form" ? "bg-red-500 text-white" : BTN_W}`}>
          Báo cáo mới
        </button>
        <button onClick={() => setView("history")}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${view === "history" ? "bg-emerald-500 text-white" : BTN_W}`}>
          Lịch sử ({history.length})
        </button>
      </div>

      {view === "form" ? (
        <div className={CARD} style={BG}>
          <h3 className="font-bold text-black mb-1">Báo cáo sự cố</h3>
          <p className="text-xs text-gray-500 mb-4">Báo cáo sẽ được gửi ngay đến chủ sân. Nếu là hàng hóa hỏng, quản lý kho cũng sẽ nhận được thông báo.</p>

          {success && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 mb-4 text-sm text-emerald-700 font-medium">
              Báo cáo đã được gửi thành công!
            </div>
          )}

          {/* Chọn loại sự cố */}
          <p className="text-sm font-semibold text-gray-700 mb-2">Loại sự cố *</p>
          <div className="space-y-2 mb-4">
            {REPORT_TYPES.map(rt => (
              <button key={rt.value} onClick={() => setForm(f => ({ ...f, type: rt.value }))}
                className={`w-full text-left p-3 rounded-xl border-2 transition-all ${form.type === rt.value ? "border-red-400 bg-red-50" : "border-gray-200 bg-white hover:border-gray-300"}`}>
                <p className="text-sm font-medium text-black">{rt.label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{rt.desc}</p>
              </button>
            ))}
          </div>

          {/* Tiêu đề */}
          <div className="mb-3">
            <label className="text-sm font-semibold text-gray-700 block mb-1">Tiêu đề *</label>
            <input className={INPUT} placeholder="Mô tả ngắn gọn sự cố..."
              value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          </div>

          {/* Chi tiết */}
          <div className="mb-4">
            <label className="text-sm font-semibold text-gray-700 block mb-1">Chi tiết *</label>
            <textarea className={INPUT + " resize-none"} rows={4}
              placeholder="Mô tả chi tiết: vị trí, mức độ nghiêm trọng, ảnh hưởng đến hoạt động..."
              value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>

          {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

          <button onClick={handleSubmit} disabled={loading}
            className="w-full bg-red-500 hover:bg-red-400 disabled:bg-red-300 text-white py-3 rounded-xl text-sm font-semibold transition-colors">
            {loading ? "Đang gửi..." : "Gửi báo cáo"}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {history.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <div className="flex justify-center mb-3"><img src="/list.png" alt="" className="w-10 h-10 opacity-40" /></div>
              <p>Chưa có báo cáo nào</p>
            </div>
          ) : history.map(r => {
            const rt = REPORT_TYPES.find(x => x.value === r.type);
            return (
              <div key={r.id} className={CARD} style={BG}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-black text-sm">{r.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{rt?.label || r.type}</p>
                    <p className="text-xs text-gray-600 mt-1.5 line-clamp-2">{r.description}</p>
                    <p className="text-xs text-gray-400 mt-1.5">
                      {new Date(r.createdAt).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full border font-medium shrink-0 ${STATUS_STYLE[r.status] || "bg-gray-100 text-gray-600 border-gray-200"}`}>
                    {r.status === "OPEN" ? "Đang xử lý" : "Đã giải quyết"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function StaffDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [info, setInfo] = useState<StaffInfo | null>(null);
  const [activeTab, setActiveTab] = useState("attendance");

  const isWarehouse = (session?.user as any)?.role === "WAREHOUSE_MANAGER";

  const loadInfo = useCallback(async () => {
    const res = await fetch("/api/staff/info");
    if (res.ok) setInfo(await res.json());
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") { router.push("/login"); return; }
    const role = (session?.user as any)?.role;
    if (session && role !== "STAFF" && role !== "WAREHOUSE_MANAGER") { router.push("/"); return; }
  }, [session, status, router]);

  useEffect(() => {
    if (status === "authenticated") loadInfo();
  }, [status, loadInfo]);

  if (status === "loading" || !info) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "linear-gradient(to right, #DDEFBB, #FFEEEE)" }}>
        <p className="text-gray-500">Đang tải...</p>
      </div>
    );
  }

  const facility = info.facilityStaff?.facility;

  const TABS = [
    { id: "attendance", label: "Chấm công",    icon: "" },
    { id: "pos",        label: "Bán hàng",     icon: "" },
    { id: "bookings",   label: "Lịch hôm nay", icon: "" },
    { id: "invoice",    label: "Đặt hộ",       icon: "" },
    ...(isWarehouse ? [{ id: "inventory", label: "Kho hàng", icon: "" }] : []),
    { id: "report",     label: "Báo cáo",      icon: "" },
  ];

  return (
    <div className="min-h-screen text-black" style={{ fontFamily: "Arial, sans-serif", background: "linear-gradient(to right, #DDEFBB, #FFEEEE)" }}>
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-black">
            {isWarehouse ? "Quản lý kho" : "Trang nhân viên"}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Xin chào, {(session?.user as any)?.name}
            {facility && <span className="ml-2 text-emerald-600 font-medium">· {facility.name}</span>}
          </p>
          {!facility && (
            <div className="mt-2 bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-2 text-xs text-yellow-700">
              Bạn chưa được gắn vào cơ sở nào. Liên hệ chủ sân để được thêm vào.
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 flex-wrap mb-6 border-b border-gray-200 pb-2">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? "bg-emerald-500 text-white"
                  : "bg-white text-gray-600 hover:text-black border border-gray-300 hover:border-emerald-300"
              }`}>
              <span>{tab.icon}</span> {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div>
          {activeTab === "attendance" && <AttendanceTab info={info} onRefresh={loadInfo} />}
          {activeTab === "pos"        && facility && <POSTab />}
          {activeTab === "bookings"   && facility && <TodayBookingsTab facilityId={facility.id} />}
          {activeTab === "invoice"    && facility && <CreateInvoiceTab facilityId={facility.id} />}
          {activeTab === "inventory"  && isWarehouse && <InventoryTab />}
          {activeTab === "report"     && <ReportTab />}
          {(activeTab === "pos" || activeTab === "bookings" || activeTab === "invoice") && !facility && (
            <div className="text-center py-16 text-gray-400">
              <div className="text-4xl mb-3">🏟️</div>
              <p>Chưa được gắn vào cơ sở nào</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
