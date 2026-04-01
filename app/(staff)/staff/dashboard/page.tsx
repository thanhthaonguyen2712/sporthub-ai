"use client";
import React, { useEffect, useState, useCallback } from "react";
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
interface InvShiftItem {
  id: number; serviceId: number; openingStock: number; sold: number; returned: number;
  closingStock: number | null; discrepancy: number | null; notes: string | null;
  service: { name: string; type: string };
}
interface InvShift {
  id: number; shiftType: string; status: string; shiftDate: string;
  notes: string | null; createdAt: string; closedAt: string | null;
  items: InvShiftItem[];
}
interface POSBooking {
  id: number; startTime: string; endTime: string; totalPrice: string;
  isWalkIn: boolean; createdByStaff: boolean; walkInName: string | null;
  customer: { fullName: string; phone: string } | null;
  invoice: { id: number; finalTotal: string; paymentMethod: string; items: { id: number; quantity: number; price: string; service: { name: string } | null }[] } | null;
}

const CARD = "border border-gray-300 rounded-2xl p-5 mb-4";
const BG = { background: "#E0EEE0" };
const INPUT = "w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:border-emerald-400";
const BTN_G = "bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-300 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors";
const BTN_W = "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 px-4 py-2 rounded-xl text-sm transition-colors";

const PM_LABEL: Record<string, string> = { CASH: "Tiền mặt", TRANSFER: "Chuyển khoản", QR: "VNPay/QR", WALLET: "Ví SportHub" };
// Chỉ 2 phương thức cho nhân viên đặt hộ
const STAFF_PM: { key: string; label: string }[] = [
  { key: "CASH", label: "Tiền mặt" },
  { key: "QR",   label: "VNPay/QR" },
];
const LOG_COLOR: Record<string, string> = { IMPORT: "text-emerald-600", EXPORT: "text-orange-500", DAMAGE: "text-red-500", SOLD: "text-blue-500" };
const LOG_LABEL: Record<string, string> = { IMPORT: "Nhập kho", EXPORT: "Xuất kho", DAMAGE: "Hàng hỏng", SOLD: "Đã bán" };

function fmtTime(iso: string) { return new Date(iso).toISOString().substring(11, 16); }
function fmtHHMM(date: Date) { return date.toTimeString().substring(0, 5); }

// ─── Attendance Tab ───────────────────────────────────────────────────────────
function AttendanceTab({ info, onRefresh }: { info: StaffInfo; onRefresh: () => Promise<void> }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [faceMode, setFaceMode] = useState<"register" | "verify" | null>(null);
  const [savedDescriptor, setSavedDescriptor] = useState<string | null>(null);
  const [descriptorLoaded, setDescriptorLoaded] = useState(false);
  const [pendingMethod, setPendingMethod] = useState<"POST" | "PUT" | null>(null);
  const [localAtt, setLocalAtt] = useState<StaffInfo["attendance"]>(info.attendance);
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);

  // Đồng bộ khi info prop thay đổi từ bên ngoài
  useEffect(() => { setLocalAtt(info.attendance); }, [info.attendance]);

  // Tải descriptor đã lưu
  useEffect(() => {
    fetch("/api/staff/face")
      .then(r => r.json())
      .then(d => { setSavedDescriptor(d.faceDescriptor ?? null); setDescriptorLoaded(true); });
  }, []);

  // Gọi API check-in / check-out sau khi xác nhận khuôn mặt
  async function doAttendance(method: "POST" | "PUT") {
    setError("");
    setLoading(true);
    const res = await fetch("/api/staff/attendance", { method });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error || "Có lỗi xảy ra."); return; }
    // Cập nhật trạng thái ngay lập tức trong card, không chờ fetch
    const nowISO = new Date().toISOString();
    if (method === "POST") {
      setLocalAtt({ id: data.id, status: "WORKING", checkInTime: nowISO, checkOutTime: null, totalHours: null });
    } else {
      setLocalAtt(prev => prev ? { ...prev, status: "COMPLETED", checkOutTime: nowISO, totalHours: data.totalHours ?? null } : prev);
    }
    onRefresh(); // sync ngầm, không cần await
  }

  // Nhấn nút check-in/out → mở camera nhận diện
  function startFaceVerify(method: "POST" | "PUT") {
    setPendingMethod(method);
    setFaceMode("verify");
  }

  // Sau khi nhận diện thành công
  async function onVerifySuccess() {
    setFaceMode(null);
    if (pendingMethod) await doAttendance(pendingMethod);
    setPendingMethod(null);
  }

  // Sau khi đăng ký khuôn mặt thành công
  async function onRegisterSuccess(descriptor?: number[]) {
    if (!descriptor) return;
    await fetch("/api/staff/face", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ descriptor }),
    });
    setSavedDescriptor(JSON.stringify(descriptor));
    setFaceMode(null);
  }

  // Lazy import FaceCapture chỉ khi cần
  const [FaceCaptureComponent, setFaceCaptureComponent] = useState<React.ComponentType<any> | null>(null);
  useEffect(() => {
    if (faceMode) {
      import("@/components/FaceCapture").then(m => setFaceCaptureComponent(() => m.default));
    }
  }, [faceMode]);

  return (
    <div className="max-w-md mx-auto">
      {/* Face Capture Modal */}
      {faceMode && FaceCaptureComponent && (
        <FaceCaptureComponent
          mode={faceMode}
          savedDescriptor={faceMode === "verify" ? savedDescriptor : undefined}
          onSuccess={faceMode === "register" ? onRegisterSuccess : onVerifySuccess}
          onCancel={() => { setFaceMode(null); setPendingMethod(null); }}
        />
      )}

      {/* Đồng hồ */}
      <div className={CARD + " text-center"} style={BG}>
        <p className="text-4xl font-bold text-black tabular-nums">{fmtHHMM(now)}</p>
        <p className="text-gray-500 text-sm mt-1">
          {now.toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" })}
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Cảnh báo chưa đăng ký khuôn mặt */}
      {descriptorLoaded && !savedDescriptor && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 mb-3 text-sm text-yellow-700 flex items-center justify-between gap-3">
          <span>Chưa đăng ký khuôn mặt. Cần đăng ký để chấm công.</span>
          <button onClick={() => setFaceMode("register")}
            className="shrink-0 bg-yellow-400 hover:bg-yellow-300 text-white px-3 py-1.5 rounded-lg text-xs font-medium">
            Đăng ký
          </button>
        </div>
      )}

      {/* Trạng thái */}
      <div className={CARD} style={BG}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-gray-700">Trạng thái hôm nay</p>
          {descriptorLoaded && savedDescriptor && (
            <button onClick={() => setFaceMode("register")}
              className="text-xs text-gray-400 hover:text-emerald-500 transition-colors">
              Cập nhật khuôn mặt
            </button>
          )}
        </div>

        {!localAtt ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-200">
              <img src="/infor.png" alt="" className="w-8 h-8 opacity-60" />
              <div>
                <p className="font-semibold text-gray-700">Chưa check-in</p>
                <p className="text-xs text-gray-400">Xác nhận khuôn mặt để bắt đầu ca</p>
              </div>
            </div>
            <button
              onClick={() => savedDescriptor ? startFaceVerify("POST") : setFaceMode("register")}
              disabled={loading || !descriptorLoaded}
              className={BTN_G + " w-full py-3 text-base"}>
              {loading ? "Đang xử lý..." : savedDescriptor ? "Check-in bằng khuôn mặt" : "Đăng ký khuôn mặt trước"}
            </button>
          </div>
        ) : localAtt.status === "WORKING" ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-4 bg-emerald-50 rounded-xl border border-emerald-200">
              <div className="w-3 h-3 rounded-full bg-emerald-500 shrink-0" />
              <div>
                <p className="font-semibold text-emerald-700">Đang làm việc</p>
                <p className="text-xs text-emerald-600">
                  Check-in lúc: {localAtt.checkInTime ? new Date(localAtt.checkInTime).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "--"}
                </p>
              </div>
            </div>
            <button
              onClick={() => savedDescriptor ? startFaceVerify("PUT") : setFaceMode("register")}
              disabled={loading || !descriptorLoaded}
              className="w-full bg-orange-500 hover:bg-orange-400 disabled:bg-orange-300 text-white py-3 rounded-xl text-sm font-semibold transition-colors">
              {loading ? "Đang xử lý..." : "Check-out kết thúc ca"}
            </button>
          </div>
        ) : (
          <div className="p-4 bg-blue-50 rounded-xl border border-blue-200 space-y-1">
            <p className="font-semibold text-blue-700">Đã hoàn thành ca hôm nay</p>
            <p className="text-xs text-blue-600">Check-in: {localAtt.checkInTime ? new Date(localAtt.checkInTime).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "--"}</p>
            <p className="text-xs text-blue-600">Check-out: {localAtt.checkOutTime ? new Date(localAtt.checkOutTime).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "--"}</p>
            <p className="text-xs font-semibold text-blue-700">Tổng giờ làm: {localAtt.totalHours ?? 0}h</p>
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
function TodayBookingsTab({ facilityId: _facilityId }: { facilityId: number }) {
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
                        <button onClick={()=>setSelectedServices(p=>p.filter(x=>x.serviceId!==s.serviceId))} className="text-red-400 text-xs">×</button>
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
// ── Helpers cho InventoryTab ──────────────────────────────────────────────────
const SHIFT_LABEL: Record<string, string> = { MORNING: "Ca sáng", AFTERNOON: "Ca chiều", EVENING: "Ca tối" };
const SHIFT_STATUS_LABEL: Record<string, string> = { OPEN: "Đang mở", CLOSED: "Đã đóng", VERIFIED: "Đã duyệt" };
const SHIFT_STATUS_CLS: Record<string, string> = {
  OPEN: "bg-emerald-100 text-emerald-700",
  CLOSED: "bg-blue-100 text-blue-700",
  VERIFIED: "bg-purple-100 text-purple-700",
};

function InventoryTab() {
  // ── dữ liệu chung ──
  const [data, setData] = useState<{ services: Service[]; logs: StockLog[] }>({ services: [], logs: [] });
  // ── nhập/xuất kho ──
  const [form, setForm] = useState({ serviceId: "", type: "IMPORT", quantity: "", note: "" });
  const [formLoading, setFormLoading] = useState(false);
  // ── kiểm kê ca ──
  const [shifts, setShifts] = useState<InvShift[]>([]);
  const [openShift, setOpenShift] = useState<InvShift | null>(null); // ca đang xem
  const [editItems, setEditItems] = useState<Record<number, { sold: number; returned: number; closingStock: string; notes: string }>>({});
  const [shiftLoading, setShiftLoading] = useState(false);
  const [newShiftType, setNewShiftType] = useState("MORNING");
  const [newShiftNotes, setNewShiftNotes] = useState("");
  const [showNewShift, setShowNewShift] = useState(false);
  // ── tab ──
  const [activeView, setActiveView] = useState<"stock" | "import" | "shift" | "logs">("stock");

  const loadData = useCallback(async () => {
    const res = await fetch("/api/staff/inventory");
    if (res.ok) setData(await res.json());
  }, []);

  const loadShifts = useCallback(async () => {
    const res = await fetch("/api/staff/inventory/shift");
    if (res.ok) setShifts(await res.json());
  }, []);

  useEffect(() => { loadData(); loadShifts(); }, [loadData, loadShifts]);

  // Khi chọn xem một ca, khởi tạo editItems
  function selectShift(shift: InvShift) {
    setOpenShift(shift);
    const init: typeof editItems = {};
    shift.items.forEach(item => {
      init[item.id] = {
        sold: item.sold,
        returned: item.returned,
        closingStock: item.closingStock !== null ? String(item.closingStock) : "",
        notes: item.notes || "",
      };
    });
    setEditItems(init);
  }

  // Nhập/Xuất kho
  async function handleImportExport() {
    if (!form.serviceId || !form.quantity) return;
    setFormLoading(true);
    const res = await fetch("/api/staff/inventory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ serviceId: Number(form.serviceId), type: form.type, quantity: Number(form.quantity), note: form.note }),
    });
    setFormLoading(false);
    if (res.ok) {
      setForm({ serviceId: "", type: "IMPORT", quantity: "", note: "" });
      loadData();
    } else {
      const d = await res.json();
      alert(d.error);
    }
  }

  // Mở ca kiểm kê mới
  async function handleOpenShift() {
    setShiftLoading(true);
    const res = await fetch("/api/staff/inventory/shift", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shiftType: newShiftType, notes: newShiftNotes }),
    });
    setShiftLoading(false);
    if (res.ok) {
      const shift: InvShift = await res.json();
      setShowNewShift(false);
      setNewShiftNotes("");
      await loadShifts();
      selectShift(shift);
    } else {
      const d = await res.json();
      alert(d.error);
    }
  }

  // Lưu / Đóng ca
  async function handleSaveShift(action: "save" | "close") {
    if (!openShift) return;
    setShiftLoading(true);
    const items = openShift.items.map(item => {
      const e = editItems[item.id];
      return {
        id: item.id,
        sold: e ? e.sold : item.sold,
        returned: e ? e.returned : item.returned,
        closingStock: e && e.closingStock !== "" ? Number(e.closingStock) : null,
        notes: e ? e.notes : "",
      };
    });
    const res = await fetch(`/api/staff/inventory/shift/${openShift.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, items }),
    });
    setShiftLoading(false);
    if (res.ok) {
      const updated: InvShift = await res.json();
      setOpenShift(updated);
      selectShift(updated);
      await loadShifts();
    } else {
      const d = await res.json();
      alert(d.error);
    }
  }

  const TABS = [
    { id: "stock",  label: "Tồn kho" },
    { id: "import", label: "Nhập/Xuất" },
    { id: "shift",  label: "Kiểm kê ca" },
    { id: "logs",   label: "Lịch sử" },
  ] as const;

  return (
    <div>
      {/* Tab bar */}
      <div className="flex gap-1.5 flex-wrap mb-4">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveView(t.id)}
            className={t.id === activeView ? BTN_G : BTN_W}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tồn kho ── */}
      {activeView === "stock" && (
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
      )}

      {/* ── Nhập/Xuất kho ── */}
      {activeView === "import" && (
        <div className={CARD} style={BG}>
          <p className="font-semibold text-black mb-3">Nhập / Xuất kho</p>
          <div className="grid grid-cols-2 gap-2.5">
            <select className={INPUT} value={form.serviceId} onChange={e => setForm(f => ({ ...f, serviceId: e.target.value }))}>
              <option value="">-- Chọn hàng hóa --</option>
              {data.services.map(s => <option key={s.id} value={s.id}>{s.name} (Tồn: {s.stockQuantity})</option>)}
            </select>
            <select className={INPUT} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
              <option value="IMPORT">Nhập kho</option>
              <option value="EXPORT">Xuất kho</option>
              <option value="DAMAGE">Hàng hỏng</option>
            </select>
            <input className={INPUT} type="number" min="1" placeholder="Số lượng" value={form.quantity}
              onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} />
            <input className={INPUT} placeholder="Ghi chú (không bắt buộc)" value={form.note}
              onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
          </div>
          <div className="flex justify-end mt-3">
            <button onClick={handleImportExport} disabled={formLoading || !form.serviceId || !form.quantity} className={BTN_G}>
              {formLoading ? "Đang xử lý..." : "Xác nhận"}
            </button>
          </div>
          {/* Hiển thị 5 log gần nhất ngay dưới */}
          {data.logs.length > 0 && (
            <div className="mt-4 border-t border-gray-200 pt-3 space-y-1.5">
              <p className="text-xs text-gray-500 font-medium mb-2">Giao dịch gần nhất</p>
              {data.logs.slice(0, 5).map(log => (
                <div key={log.id} className="flex items-center justify-between text-xs text-gray-600 bg-white/60 rounded-xl px-3 py-2">
                  <span>{log.service.name}{log.note ? ` · ${log.note}` : ""}</span>
                  <span className={`font-bold ${LOG_COLOR[log.type]}`}>
                    {log.type === "IMPORT" ? "+" : "-"}{log.quantity} {LOG_LABEL[log.type]}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Kiểm kê ca ── */}
      {activeView === "shift" && (
        <div>
          {/* Panel chọn ca đang xem hoặc danh sách ca hôm nay */}
          {!openShift ? (
            <div>
              {/* Nút mở ca mới */}
              <div className="flex justify-end mb-3">
                <button onClick={() => setShowNewShift(v => !v)} className={BTN_G}>
                  + Mở ca kiểm kê
                </button>
              </div>

              {showNewShift && (
                <div className={CARD} style={BG}>
                  <p className="font-semibold text-black mb-3">Mở ca kiểm kê mới</p>
                  <div className="grid grid-cols-2 gap-2.5 mb-3">
                    <select className={INPUT} value={newShiftType} onChange={e => setNewShiftType(e.target.value)}>
                      <option value="MORNING">Ca sáng</option>
                      <option value="AFTERNOON">Ca chiều</option>
                      <option value="EVENING">Ca tối</option>
                    </select>
                    <input className={INPUT} placeholder="Ghi chú (không bắt buộc)" value={newShiftNotes}
                      onChange={e => setNewShiftNotes(e.target.value)} />
                  </div>
                  <p className="text-xs text-gray-500 mb-3">
                    Hệ thống sẽ tự ghi nhận tồn kho hiện tại làm tồn kho đầu ca cho tất cả hàng hóa.
                  </p>
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setShowNewShift(false)} className={BTN_W}>Hủy</button>
                    <button onClick={handleOpenShift} disabled={shiftLoading} className={BTN_G}>
                      {shiftLoading ? "Đang mở..." : "Mở ca"}
                    </button>
                  </div>
                </div>
              )}

              {/* Danh sách ca hôm nay */}
              {shifts.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <p className="text-sm">Chưa có ca kiểm kê nào hôm nay</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-gray-500 font-medium mb-2">Ca kiểm kê hôm nay</p>
                  {shifts.map(shift => (
                    <button key={shift.id} onClick={() => selectShift(shift)}
                      className="w-full text-left border border-gray-200 rounded-2xl p-4 bg-white/70 hover:bg-white transition-colors">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-black">{SHIFT_LABEL[shift.shiftType] || shift.shiftType}</p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            Mở lúc {new Date(shift.createdAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
                            {shift.closedAt && ` · Đóng lúc ${new Date(shift.closedAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}`}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">{shift.items.length} mặt hàng</p>
                        </div>
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${SHIFT_STATUS_CLS[shift.status]}`}>
                          {SHIFT_STATUS_LABEL[shift.status]}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Chi tiết ca kiểm kê */
            <div>
              <div className="flex items-center gap-3 mb-4">
                <button onClick={() => setOpenShift(null)} className={BTN_W + " text-xs"}>← Quay lại</button>
                <div className="flex-1">
                  <p className="font-semibold text-black">{SHIFT_LABEL[openShift.shiftType]}</p>
                  <p className="text-xs text-gray-500">
                    Mở: {new Date(openShift.createdAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
                    {openShift.closedAt && ` · Đóng: ${new Date(openShift.closedAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}`}
                  </p>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${SHIFT_STATUS_CLS[openShift.status]}`}>
                  {SHIFT_STATUS_LABEL[openShift.status]}
                </span>
              </div>

              {/* Bảng hàng hóa */}
              <div className="overflow-auto rounded-2xl border border-gray-300 mb-4" style={BG}>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-gray-600 text-xs">
                      <th className="text-left px-3 py-2.5 font-semibold">Hàng hóa</th>
                      <th className="text-right px-3 py-2.5 font-semibold">Đầu ca</th>
                      <th className="text-right px-3 py-2.5 font-semibold">Đã bán/cho thuê</th>
                      <th className="text-right px-3 py-2.5 font-semibold">Trả về</th>
                      <th className="text-right px-3 py-2.5 font-semibold">Tồn thực tế</th>
                      {openShift.status !== "OPEN" && <th className="text-right px-3 py-2.5 font-semibold">Lệch</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {openShift.items.map(item => {
                      const e = editItems[item.id];
                      const disc = item.discrepancy;
                      return (
                        <tr key={item.id} className="border-t border-gray-100">
                          <td className="px-3 py-2.5">
                            <p className="font-medium text-black text-xs">{item.service.name}</p>
                            <span className={`text-xs px-1.5 py-0.5 rounded-full ${item.service.type === "RENTAL" ? "bg-blue-100 text-blue-600" : "bg-orange-100 text-orange-600"}`}>
                              {item.service.type === "RENTAL" ? "Cho thuê" : "F&B"}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-right font-medium text-gray-700">{item.openingStock}</td>
                          <td className="px-3 py-2.5 text-right">
                            {openShift.status === "OPEN" ? (
                              <input type="number" min="0"
                                className="w-16 border border-gray-300 rounded-lg px-2 py-1 text-xs text-right bg-white focus:outline-none focus:border-emerald-400"
                                value={e?.sold ?? item.sold}
                                onChange={ev => setEditItems(prev => ({ ...prev, [item.id]: { ...prev[item.id], sold: Number(ev.target.value) } }))}
                              />
                            ) : <span className="text-orange-600 font-medium">{item.sold}</span>}
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            {openShift.status === "OPEN" ? (
                              <input type="number" min="0"
                                className="w-16 border border-gray-300 rounded-lg px-2 py-1 text-xs text-right bg-white focus:outline-none focus:border-emerald-400"
                                value={e?.returned ?? item.returned}
                                onChange={ev => setEditItems(prev => ({ ...prev, [item.id]: { ...prev[item.id], returned: Number(ev.target.value) } }))}
                              />
                            ) : <span className="text-emerald-600 font-medium">{item.returned}</span>}
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            {openShift.status === "OPEN" ? (
                              <input type="number" min="0"
                                className="w-16 border border-gray-300 rounded-lg px-2 py-1 text-xs text-right bg-white focus:outline-none focus:border-emerald-400"
                                placeholder="Đếm"
                                value={e?.closingStock ?? ""}
                                onChange={ev => setEditItems(prev => ({ ...prev, [item.id]: { ...prev[item.id], closingStock: ev.target.value } }))}
                              />
                            ) : <span className="font-medium text-gray-700">{item.closingStock ?? "—"}</span>}
                          </td>
                          {openShift.status !== "OPEN" && (
                            <td className={`px-3 py-2.5 text-right font-bold ${disc === null ? "text-gray-400" : disc === 0 ? "text-emerald-600" : "text-red-500"}`}>
                              {disc === null ? "—" : disc === 0 ? "Khớp" : `${disc > 0 ? "+" : ""}${disc}`}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Tóm tắt lệch (khi đã đóng) */}
              {openShift.status !== "OPEN" && (
                <div className={CARD + " mb-3"} style={BG}>
                  <p className="font-semibold text-black mb-2 text-sm">Tổng kết ca</p>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="bg-white/70 rounded-xl p-3">
                      <p className="text-xs text-gray-500">Tổng đã bán</p>
                      <p className="text-lg font-bold text-orange-500">
                        {openShift.items.reduce((s, i) => s + i.sold, 0)}
                      </p>
                    </div>
                    <div className="bg-white/70 rounded-xl p-3">
                      <p className="text-xs text-gray-500">Hàng trả về</p>
                      <p className="text-lg font-bold text-emerald-600">
                        {openShift.items.reduce((s, i) => s + i.returned, 0)}
                      </p>
                    </div>
                    <div className="bg-white/70 rounded-xl p-3">
                      <p className="text-xs text-gray-500">Hàng lệch</p>
                      <p className={`text-lg font-bold ${openShift.items.some(i => i.discrepancy !== null && i.discrepancy !== 0) ? "text-red-500" : "text-emerald-600"}`}>
                        {openShift.items.filter(i => i.discrepancy !== null && i.discrepancy !== 0).length} mặt hàng
                      </p>
                    </div>
                  </div>
                  {openShift.notes && (
                    <p className="text-xs text-gray-500 mt-3 bg-white/50 rounded-xl px-3 py-2">{openShift.notes}</p>
                  )}
                </div>
              )}

              {/* Nút hành động */}
              {openShift.status === "OPEN" && (
                <div className="flex gap-2 justify-end">
                  <button onClick={() => handleSaveShift("save")} disabled={shiftLoading} className={BTN_W}>
                    {shiftLoading ? "Đang lưu..." : "Lưu tạm"}
                  </button>
                  <button onClick={() => handleSaveShift("close")} disabled={shiftLoading}
                    className="bg-blue-500 hover:bg-blue-400 disabled:bg-blue-300 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors">
                    {shiftLoading ? "Đang xử lý..." : "Đóng ca & Lưu kết quả"}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Lịch sử ── */}
      {activeView === "logs" && (
        <div className="space-y-2">
          {data.logs.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
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
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/staff/pos");
    const data = await res.json();
    setLoading(false);
    setServices(data.services || []);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { const t = setInterval(load, 60000); return () => clearInterval(t); }, [load]);

  const rentalServices = services.filter(s => s.type === "RENTAL");
  const fnbServices    = services.filter(s => s.type === "PRODUCT");

  // Ẩn tab nếu không có hạng mục tương ứng
  const hasBothModes = rentalServices.length > 0 && fnbServices.length > 0;
  const defaultMode  = rentalServices.length > 0 ? "rental" : "fnb";
  const [posMode, setPosMode] = useState<"rental" | "fnb">(defaultMode);

  if (loading && services.length === 0) return <p className="text-center text-gray-400 py-10">Đang tải...</p>;

  return (
    <div>
      {hasBothModes && (
        <div className="flex gap-2 mb-5">
          <button onClick={() => setPosMode("rental")}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors border ${posMode === "rental" ? "bg-emerald-500 text-white border-emerald-500" : "bg-white text-gray-600 border-gray-300 hover:border-emerald-300"}`}>
            Cho thuê đồ
          </button>
          <button onClick={() => setPosMode("fnb")}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors border ${posMode === "fnb" ? "bg-emerald-500 text-white border-emerald-500" : "bg-white text-gray-600 border-gray-300 hover:border-emerald-300"}`}>
            Bán F&amp;B
          </button>
        </div>
      )}

      {posMode === "rental"
        ? <EquipmentRentalMode services={rentalServices} onRefresh={load} />
        : <FnbMode services={fnbServices} onRefresh={load} />}
    </div>
  );
}

// ─── Equipment Rental Mode ────────────────────────────────────────────────────
function EquipmentRentalMode({ services, onRefresh }: { services: Service[]; onRefresh: () => void }) {
  const [cart, setCart] = useState<{ serviceId: number; name: string; quantity: number; price: number }[]>([]);
  const [phone, setPhone] = useState("");
  const [pm, setPm] = useState("CASH");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successId, setSuccessId] = useState<number | null>(null);

  const available = services.filter(s => s.stockQuantity > 0);

  function addToCart(svc: Service) {
    setCart(prev => {
      const ex = prev.find(s => s.serviceId === svc.id);
      if (ex) return prev.map(s => s.serviceId === svc.id ? { ...s, quantity: s.quantity + 1 } : s);
      return [...prev, { serviceId: svc.id, name: svc.name, quantity: 1, price: Number(svc.price) }];
    });
  }

  const total = cart.reduce((sum, s) => sum + s.quantity * s.price, 0);

  async function checkout() {
    if (cart.length === 0) return;
    if (!phone.trim()) { setError("Nhập số điện thoại người thuê."); return; }
    setError(""); setLoading(true);
    const res = await fetch("/api/staff/pos/direct-sale", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: cart.map(s => ({ serviceId: s.serviceId, quantity: s.quantity, price: s.price })),
        paymentMethod: pm,
        note: `Cho thuê - Khách: ${phone.trim()}`,
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (res.ok) {
      setSuccessId(data.saleId);
      setCart([]); setPhone("");
      onRefresh();
    } else {
      setError(data.error || "Có lỗi xảy ra.");
    }
  }

  if (successId) return (
    <div className="text-center py-12">
      <h2 className="text-xl font-bold text-black mb-2">Cho thuê thành công!</h2>
      <p className="text-gray-500 mb-6">Mã phiếu: <span className="font-semibold text-emerald-600">#{successId}</span></p>
      <button onClick={() => setSuccessId(null)} className={BTN_G + " px-8 py-3"}>Cho thuê tiếp</button>
    </div>
  );

  return (
    <div>
      {available.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p>Không có dụng cụ cho thuê nào còn hàng</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 mb-4">
            {available.map(svc => {
              const inCart = cart.find(s => s.serviceId === svc.id);
              return (
                <button key={svc.id} onClick={() => addToCart(svc)}
                  className={`text-left p-4 rounded-2xl border-2 transition-colors relative ${inCart ? "bg-emerald-50 border-emerald-400" : "bg-white border-gray-200 hover:border-emerald-300"}`}>
                  {inCart && (
                    <span className="absolute top-2 right-2 bg-emerald-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                      {inCart.quantity}
                    </span>
                  )}
                  <p className="font-semibold text-black text-sm pr-6">{svc.name}</p>
                  <p className="text-emerald-600 font-bold text-sm mt-2">{Number(svc.price).toLocaleString("vi-VN")}đ</p>
                  <p className="text-xs text-gray-400">Còn {svc.stockQuantity}</p>
                </button>
              );
            })}
          </div>

          {cart.length > 0 && (
            <div className={CARD} style={BG}>
              <p className="font-semibold text-black mb-3">Thông tin thuê</p>

              {/* SDT bắt buộc */}
              <div className="mb-4">
                <label className="text-xs font-semibold text-gray-600 block mb-1">
                  SDT người thuê <span className="text-red-500">*</span>
                </label>
                <input className={INPUT} placeholder="Số điện thoại" value={phone}
                  onChange={e => setPhone(e.target.value)} />
              </div>

              {/* Danh sách giỏ */}
              <div className="space-y-2 mb-4">
                {cart.map(s => (
                  <div key={s.serviceId} className="flex items-center justify-between bg-white rounded-xl px-3 py-2 border border-gray-200">
                    <div className="flex items-center gap-2 min-w-0">
                      <button onClick={() => setCart(p => p.filter(x => x.serviceId !== s.serviceId))} className="text-red-400 text-xs shrink-0">×</button>
                      <span className="text-sm text-gray-700 truncate">{s.name}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => setCart(p => p.map(x => x.serviceId === s.serviceId ? { ...x, quantity: Math.max(1, x.quantity - 1) } : x))}
                        className="w-6 h-6 bg-gray-100 rounded-full text-xs font-bold">-</button>
                      <span className="font-medium w-5 text-center text-sm">{s.quantity}</span>
                      <button onClick={() => setCart(p => p.map(x => x.serviceId === s.serviceId ? { ...x, quantity: x.quantity + 1 } : x))}
                        className="w-6 h-6 bg-gray-100 rounded-full text-xs font-bold">+</button>
                      <span className="text-emerald-600 w-20 text-right text-sm font-medium">{(s.quantity * s.price).toLocaleString("vi-VN")}đ</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Thanh toán */}
              <div className="grid grid-cols-2 gap-2 mb-4">
                {STAFF_PM.map(({ key, label }) => (
                  <button key={key} onClick={() => setPm(key)}
                    className={`p-3 rounded-xl border text-sm font-medium transition-colors text-left ${pm === key ? "bg-emerald-100 border-emerald-400 text-emerald-700" : "bg-white border-gray-200 text-gray-700 hover:border-emerald-300"}`}>
                    {label}
                  </button>
                ))}
              </div>

              <div className="flex justify-between items-center mb-3 px-1">
                <span className="font-semibold text-gray-700">Tổng cộng</span>
                <span className="font-bold text-emerald-600 text-xl">{total.toLocaleString("vi-VN")}đ</span>
              </div>

              {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
              <button onClick={checkout} disabled={loading}
                className={BTN_G + " w-full py-3.5 text-base"}>
                {loading ? "Đang xử lý..." : `Xác nhận cho thuê · ${total.toLocaleString("vi-VN")}đ`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── F&B Direct Sale Mode ─────────────────────────────────────────────────────
function FnbMode({ services, onRefresh }: { services: Service[]; onRefresh: () => void }) {
  const [cart, setCart] = useState<{ serviceId: number; name: string; quantity: number; price: number }[]>([]);
  const [pm, setPm] = useState("CASH");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successId, setSuccessId] = useState<number | null>(null);

  const fnbServices = services.filter(s => s.stockQuantity > 0);

  function addToCart(svc: Service) {
    setCart(prev => {
      const ex = prev.find(s => s.serviceId === svc.id);
      if (ex) return prev.map(s => s.serviceId === svc.id ? { ...s, quantity: s.quantity + 1 } : s);
      return [...prev, { serviceId: svc.id, name: svc.name, quantity: 1, price: Number(svc.price) }];
    });
  }

  const total = cart.reduce((sum, s) => sum + s.quantity * s.price, 0);

  async function checkout() {
    if (cart.length === 0) return;
    setError(""); setLoading(true);
    const res = await fetch("/api/staff/pos/direct-sale", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: cart.map(s => ({ serviceId: s.serviceId, quantity: s.quantity, price: s.price })),
        paymentMethod: pm,
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (res.ok) {
      setSuccessId(data.saleId);
      setCart([]);
      onRefresh();
    } else {
      setError(data.error || "Có lỗi xảy ra.");
    }
  }

  if (successId) return (
    <div className="text-center py-12">
      <h2 className="text-xl font-bold text-black mb-2">Thanh toán thành công!</h2>
      <p className="text-gray-500 mb-6">Mã bán hàng: <span className="font-semibold text-emerald-600">#{successId}</span></p>
      <button onClick={() => setSuccessId(null)} className={BTN_G + " px-8 py-3"}>Bán tiếp</button>
    </div>
  );

  return (
    <div>
      {fnbServices.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p>Không có sản phẩm nào còn hàng</p>
        </div>
      ) : (
        <>
          {/* Sản phẩm */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            {fnbServices.map(svc => {
              const inCart = cart.find(s => s.serviceId === svc.id);
              return (
                <button key={svc.id} onClick={() => addToCart(svc)}
                  className={`text-left p-4 rounded-2xl border-2 transition-colors relative ${inCart ? "bg-emerald-50 border-emerald-400" : "bg-white border-gray-200 hover:border-emerald-300"}`}>
                  {inCart && (
                    <span className="absolute top-2 right-2 bg-emerald-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                      {inCart.quantity}
                    </span>
                  )}
                  <p className="font-semibold text-black text-sm pr-6">{svc.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5 capitalize">{svc.type === "PRODUCT" ? "F&B" : "Đồ thuê"}</p>
                  <p className="text-emerald-600 font-bold text-sm mt-2">{Number(svc.price).toLocaleString("vi-VN")}đ</p>
                  <p className="text-xs text-gray-400">Còn {svc.stockQuantity}</p>
                </button>
              );
            })}
          </div>

          {/* Giỏ hàng */}
          {cart.length > 0 && (
            <div className={CARD} style={BG}>
              <p className="font-semibold text-black mb-3">Giỏ hàng</p>
              <div className="space-y-2 mb-4">
                {cart.map(s => (
                  <div key={s.serviceId} className="flex items-center justify-between bg-white rounded-xl px-3 py-2 border border-gray-200">
                    <div className="flex items-center gap-2 min-w-0">
                      <button onClick={() => setCart(p => p.filter(x => x.serviceId !== s.serviceId))} className="text-red-400 text-xs shrink-0">×</button>
                      <span className="text-sm text-gray-700 truncate">{s.name}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => setCart(p => p.map(x => x.serviceId === s.serviceId ? { ...x, quantity: Math.max(1, x.quantity - 1) } : x))}
                        className="w-6 h-6 bg-gray-100 rounded-full text-xs font-bold">-</button>
                      <span className="font-medium w-5 text-center text-sm">{s.quantity}</span>
                      <button onClick={() => setCart(p => p.map(x => x.serviceId === s.serviceId ? { ...x, quantity: x.quantity + 1 } : x))}
                        className="w-6 h-6 bg-gray-100 rounded-full text-xs font-bold">+</button>
                      <span className="text-emerald-600 w-20 text-right text-sm font-medium">{(s.quantity * s.price).toLocaleString("vi-VN")}đ</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Thanh toán */}
              <div className="grid grid-cols-2 gap-2 mb-4">
                {STAFF_PM.map(({ key, label }) => (
                  <button key={key} onClick={() => setPm(key)}
                    className={`p-3 rounded-xl border text-sm font-medium transition-colors text-left ${pm === key ? "bg-emerald-100 border-emerald-400 text-emerald-700" : "bg-white border-gray-200 text-gray-700 hover:border-emerald-300"}`}>
                    {label}
                  </button>
                ))}
              </div>

              <div className="flex justify-between items-center mb-3 px-1">
                <span className="font-semibold text-gray-700">Tổng cộng</span>
                <span className="font-bold text-emerald-600 text-xl">{total.toLocaleString("vi-VN")}đ</span>
              </div>

              {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

              <button onClick={checkout} disabled={loading}
                className={BTN_G + " w-full py-3.5 text-base"}>
                {loading ? "Đang xử lý..." : `Thanh toán ${total.toLocaleString("vi-VN")}đ`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Report Tab ──────────────────────────────────────────────────────────────
const REPORT_TYPES = [
  { value: "FACILITY",         label: "Sự cố sân / cơ sở hạ tầng", desc: "Hệ thống điện, nước, mái che, mặt sân..." },
  { value: "EQUIPMENT",        label: "Thiết bị hỏng hóc",          desc: "Lưới, đèn, máy bơm, thiết bị thể thao..." },
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

  // Check-out nhanh từ thanh trạng thái cố định
  const [quickFaceMode, setQuickFaceMode] = useState(false);
  const [quickLoading, setQuickLoading] = useState(false);
  const [QuickFaceCapture, setQuickFaceCapture] = useState<React.ComponentType<any> | null>(null);
  const [quickSavedDescriptor, setQuickSavedDescriptor] = useState<string | null>(null);

  useEffect(() => {
    if (quickFaceMode && !QuickFaceCapture) {
      import("@/components/FaceCapture").then(m => setQuickFaceCapture(() => m.default));
    }
  }, [quickFaceMode, QuickFaceCapture]);

  // Tải descriptor cho thanh quick checkout
  useEffect(() => {
    fetch("/api/staff/face").then(r => r.json()).then(d => setQuickSavedDescriptor(d.faceDescriptor ?? null));
  }, []);

  const loadInfo = useCallback(async () => {
    const res = await fetch("/api/staff/info", { cache: "no-store" });
    if (res.ok) setInfo(await res.json());
  }, []);

  async function handleQuickCheckout() {
    setQuickFaceMode(false);
    setQuickLoading(true);
    const res = await fetch("/api/staff/attendance", { method: "PUT" });
    const data = await res.json();
    setQuickLoading(false);
    if (res.ok) {
      await loadInfo();
    } else {
      alert(data.error || "Có lỗi xảy ra khi check-out.");
    }
  }

  const isWarehouse = (session?.user as any)?.role === "WAREHOUSE_MANAGER";

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

  const workingAtt = info?.attendance?.status === "WORKING" ? info.attendance : null;

  return (
    <div className="min-h-screen text-black" style={{ fontFamily: "Arial, sans-serif", background: "linear-gradient(to right, #DDEFBB, #FFEEEE)" }}>
      <Navbar />

      {/* Face Capture modal cho quick checkout */}
      {quickFaceMode && QuickFaceCapture && (
        <QuickFaceCapture
          mode="verify"
          savedDescriptor={quickSavedDescriptor}
          onSuccess={handleQuickCheckout}
          onCancel={() => setQuickFaceMode(false)}
        />
      )}

      {/* Thanh trạng thái cố định khi đang làm việc */}
      {workingAtt && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-emerald-600 text-white shadow-2xl">
          <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-2.5 h-2.5 rounded-full bg-white animate-pulse shrink-0" />
              <div className="min-w-0">
                <p className="font-semibold text-sm leading-tight">Đang trong ca làm việc</p>
                <p className="text-emerald-100 text-xs leading-tight">
                  Check-in lúc {workingAtt.checkInTime
                    ? new Date(workingAtt.checkInTime).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
                    : "--"}
                </p>
              </div>
            </div>
            <button
              onClick={() => quickSavedDescriptor ? setQuickFaceMode(true) : setActiveTab("attendance")}
              disabled={quickLoading}
              className="shrink-0 bg-white text-emerald-700 hover:bg-emerald-50 disabled:opacity-60 font-semibold text-sm px-4 py-2 rounded-xl transition-colors">
              {quickLoading ? "Đang xử lý..." : "Check-out"}
            </button>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 py-8" style={workingAtt ? { paddingBottom: "5rem" } : {}}>
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
              <p>Chưa được gắn vào cơ sở nào</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
