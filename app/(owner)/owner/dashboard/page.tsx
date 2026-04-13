"use client";
import React, { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import VietnamAddressInput from "@/components/VietnamAddressInput";
import { useTranslations } from "next-intl";

// ─── Types ──────────────────────────────────────────────────────────────────
interface Facility { id: number; name: string; address: string; description: string; isActive: boolean; courtCount: number; staffCount: number; imageUrl?: string | null; sports: { id: number; name: string }[] }
interface StaffRecord { staffRecordId: number; facilityId: number; facilityName: string; role: string; joinedAt: string; user: { id: number; fullName: string; email: string; phone: string; role: string; isLocked: boolean }; wageConfig: { wageType: string; wageRate: number } | null }
interface AttendanceRecord { id: number; date: string; checkIn: string | null; checkOut: string | null; totalHours: string | null; status: string; isLate: boolean; forgotCheckIn: boolean; forgotCheckOut: boolean; overtimeMinutes: number; shift: { id: number; name: string; startTime: string; endTime: string } | null }
interface AttendanceStaff { userId: number; fullName: string; role: string; wageType: string | null; totalHours: number | null; presentDays: number; lateDays: number; forgotCheckInCount: number; forgotCheckOutCount: number; overtimeTotalMinutes: number; records: AttendanceRecord[] }
interface SalaryStaffRow { userId: number; fullName: string; role: string; wageConfig: { wageType: string; wageRate: number } | null; attendance: { totalHours: number | null; presentDays: number; lateDays: number; forgotCheckOutCount: number; overtimeHours: number }; salaryRecord: { id: number; baseSalary: number; bonus: number; overtimeHours: number; overtimePay: number; penaltyAmount: number; finalSalary: number; wageRate: number; wageType: string; isPaid: boolean; paidAt: string | null } | null }
interface WageConfig { id: number; staffId: number; wageType: string; wageRate: number; staff: { id: number; fullName: string } }
interface Service { id: number; name: string; type: string; price: string; stockQuantity: number; monthlyThreshold: number; isActive: boolean; imageUrl?: string | null; soldThisMonth?: number }
interface Invoice { id: number; createdAt: string; finalTotal: string; paymentMethod: string; staffName: string; customerName: string; courtName: string; items: { name: string; quantity: number; price: string }[] }
interface PricingRule { id?: number; startTime: string; endTime: string; pricePerHour: number; dayType: "WEEKDAY" | "WEEKEND" | "HOLIDAY"; isPeak: boolean; priority: number }
interface WorkShift { id: number; name: string; shiftDate: string; startTime: string; endTime: string; maxStaff: number; status: string; note: string | null; registrations: { id: number; staffId: number; status: string; staff: { id: number; fullName: string; phone: string } }[] }
interface CourtLock { id: number; reason: string; note: string | null; startDate: string; endDate: string; isActive: boolean; locker: { fullName: string } }

const TAB_IDS = [
  { id: "overview",   labelKey: "tabOverview"   },
  { id: "facilities", labelKey: "tabFacilities" },
  { id: "staff",      labelKey: "tabStaff"      },
  { id: "shifts",     labelKey: "tabShifts"     },
  { id: "attendance", labelKey: "tabAttendance" },
  { id: "salary",     labelKey: "tabSalary"     },
  { id: "invoices",   labelKey: "tabInvoices"   },
  { id: "services",   labelKey: "tabServices"   },
  { id: "revenue",    labelKey: "tabRevenue"    },
];

const CARD = "border border-gray-300 rounded-2xl p-5 mb-4";
const BG   = { background: "#E0EEE0" };
const INPUT = "w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:border-emerald-400";
const BTN_G = "bg-emerald-500 hover:bg-emerald-400 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors";
const BTN_R = "bg-red-500 hover:bg-red-400 text-white px-3 py-1.5 rounded-lg text-xs transition-colors";
const BTN_W = "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 px-4 py-2 rounded-xl text-sm transition-colors";

// ─── Overview Tab ────────────────────────────────────────────────────────────
function OverviewTab() {
  const t = useTranslations("owner");
  const [stats, setStats] = useState<any>(null);
  useEffect(() => { fetch("/api/owner/stats").then(r => r.json()).then(setStats); }, []);
  if (!stats) return <div className="text-gray-400 text-sm py-10 text-center">{t("loading")}</div>;
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {[
        { label: t("statFacilities"), value: stats.facilityCount, color: "text-emerald-600" },
        { label: t("statStaff"), value: stats.staffCount, color: "text-blue-600" },
        { label: t("statMonthlyBookings"), value: stats.monthlyBookings, color: "text-purple-600" },
        { label: t("statMonthlyRevenue"), value: Number(stats.monthlyRevenue).toLocaleString("vi-VN") + "đ", color: "text-orange-600" },
      ].map(s => (
        <div key={s.label} className={`${CARD} text-center`} style={BG}>
          <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
          <div className="text-xs text-gray-500 mt-1">{s.label}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Facilities Tab ──────────────────────────────────────────────────────────
function FacilitiesTab() {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [sports, setSports] = useState<{ id: number; name: string }[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: "", address: "", description: "", sportIds: [] as number[], latitude: "", longitude: "", imageUrl: "" });
  const [geocoding, setGeocoding] = useState(false);
  const [facilityImgUploading, setFacilityImgUploading] = useState(false);
  const [courtForm, setCourtForm] = useState({ name: "", categoryId: "", weekdayPrice: "", weekendPrice: "", peakPrice: "" });
  const [facilityId, setFacilityId] = useState<number | null>(null);
  const [courts, setCourts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  // Court detail management
  const [managingCourtId, setManagingCourtId] = useState<number | null>(null);
  const [managingTab, setManagingTab] = useState<"pricing" | "schedule" | "lock">("pricing");
  const [pricingRules, setPricingRules] = useState<PricingRule[]>([]);
  const [savingPricing, setSavingPricing] = useState(false);
  const [scheduleData, setScheduleData] = useState<any>(null);
  const [scheduleDate, setScheduleDate] = useState(() => { const d = new Date(); return d.toISOString().substring(0,10); });
  const [courtLocks, setCourtLocks] = useState<CourtLock[]>([]);
  const [lockForm, setLockForm] = useState({ reason: "INCIDENT", note: "", startDate: "", endDate: "", notifyCustomers: true });

  useEffect(() => {
    fetch("/api/owner/facilities").then(r => r.json()).then(setFacilities);
    fetch("/api/sports").then(r => r.json()).then(setSports);
  }, []);

  const loadCourts = useCallback(async (fid: number) => {
    const data = await fetch(`/api/facilities/${fid}`).then(r => r.json());
    setCourts(data.courts || []);
    setFacilityId(fid);
    setExpandedId(fid);
  }, []);

  async function openCourtManage(courtId: number, tab: "pricing" | "schedule" | "lock") {
    setManagingCourtId(courtId);
    setManagingTab(tab);
    if (tab === "pricing") {
      const court = courts.find((c: any) => c.id === courtId);
      if (court?.pricingRules) {
        setPricingRules(court.pricingRules.map((r: any) => ({
          id: r.id,
          startTime: new Date(r.startTime).toISOString().substring(11,16),
          endTime: new Date(r.endTime).toISOString().substring(11,16),
          pricePerHour: Number(r.pricePerHour),
          dayType: r.dayType,
          isPeak: r.isPeak || false,
          priority: r.priority || 0,
        })));
      } else {
        setPricingRules([]);
      }
    } else if (tab === "schedule") {
      await loadSchedule(courtId);
    } else if (tab === "lock") {
      await loadLocks(courtId);
    }
  }

  async function loadSchedule(courtId: number) {
    const endDate = new Date(); endDate.setDate(endDate.getDate() + 30);
    const res = await fetch(`/api/owner/courts/${courtId}/schedule?startDate=${scheduleDate}&endDate=${endDate.toISOString().substring(0,10)}`);
    const data = await res.json();
    setScheduleData(data);
  }

  async function loadLocks(courtId: number) {
    const res = await fetch(`/api/owner/courts/${courtId}/lock`);
    const data = await res.json();
    setCourtLocks(Array.isArray(data) ? data : []);
  }

  async function savePricingRules() {
    if (!managingCourtId) return;
    setSavingPricing(true);
    await fetch(`/api/owner/courts/${managingCourtId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pricingRules }),
    });
    setSavingPricing(false);
    alert("Đã lưu khung giờ & giá!");
    if (facilityId) loadCourts(facilityId);
  }

  function addPricingRule() {
    setPricingRules(prev => [...prev, { startTime: "06:00", endTime: "17:00", pricePerHour: 0, dayType: "WEEKDAY", isPeak: false, priority: 0 }]);
  }

  function removePricingRule(idx: number) {
    setPricingRules(prev => prev.filter((_, i) => i !== idx));
  }

  async function addLock() {
    if (!managingCourtId || !lockForm.startDate || !lockForm.endDate) { alert("Vui lòng điền đầy đủ thông tin"); return; }
    const res = await fetch(`/api/owner/courts/${managingCourtId}/lock`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(lockForm),
    });
    if (res.ok) {
      setLockForm({ reason: "INCIDENT", note: "", startDate: "", endDate: "", notifyCustomers: true });
      await loadLocks(managingCourtId);
    } else { const d = await res.json(); alert(d.error); }
  }

  async function removeLock(lockId: number) {
    if (!managingCourtId) return;
    if (!confirm("Mở khóa sân này?")) return;
    await fetch(`/api/owner/courts/${managingCourtId}/lock?lockId=${lockId}`, { method: "DELETE" });
    await loadLocks(managingCourtId);
  }

  async function createFacility() {
    setLoading(true);
    const res = await fetch("/api/owner/facilities", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    setLoading(false);
    if (res.ok) {
      setShowForm(false);
      setForm({ name: "", address: "", description: "", sportIds: [], latitude: "", longitude: "", imageUrl: "" });
      fetch("/api/owner/facilities").then(r => r.json()).then(setFacilities);
    } else { const d = await res.json(); alert(d.error); }
  }

  async function addCourt() {
    if (!facilityId) return;
    setLoading(true);
    const res = await fetch("/api/owner/courts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      ...courtForm,
      facilityId,
      weekdayPrice: Number(courtForm.weekdayPrice) * 1000,
      weekendPrice: Number(courtForm.weekendPrice) * 1000,
      peakPrice:    Number(courtForm.peakPrice)    * 1000,
    }) });
    setLoading(false);
    if (res.ok) {
      setCourtForm({ name: "", categoryId: "", weekdayPrice: "", weekendPrice: "", peakPrice: "" });
      loadCourts(facilityId);
    } else { const d = await res.json(); alert(d.error); }
  }

  async function deleteCourt(courtId: number) {
    if (!confirm("Xóa sân này?")) return;
    await fetch(`/api/owner/courts/${courtId}`, { method: "DELETE" });
    if (facilityId) loadCourts(facilityId);
  }

  const toggleSport = (id: number) => setForm(f => ({
    ...f, sportIds: f.sportIds.includes(id) ? f.sportIds.filter(x => x !== id) : [...f.sportIds, id]
  }));

  async function geocodeAddress() {
    if (!form.address) { alert("Vui lòng nhập địa chỉ trước!"); return; }
    setGeocoding(true);
    try {
      const q = encodeURIComponent(form.address + ", Việt Nam");
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`, {
        headers: { "Accept-Language": "vi" }
      });
      const data = await res.json();
      if (data && data.length > 0) {
        setForm(f => ({ ...f, latitude: data[0].lat, longitude: data[0].lon }));
      } else {
        alert("Không tìm thấy tọa độ cho địa chỉ này. Vui lòng nhập thủ công.");
      }
    } catch {
      alert("Lỗi khi lấy tọa độ. Vui lòng nhập thủ công.");
    }
    setGeocoding(false);
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="font-semibold text-black">Danh sách cơ sở ({facilities.length})</h2>
        <button onClick={() => setShowForm(!showForm)} className={BTN_G}>+ Thêm cơ sở</button>
      </div>

      {showForm && (
        <div className={CARD} style={BG}>
          <h3 className="font-semibold text-black mb-3">Đăng ký cơ sở mới</h3>
          <div className="space-y-2.5">
            <input className={INPUT} placeholder="Tên cơ sở *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            <div>
              <p className="text-xs text-gray-500 mb-1.5">Địa chỉ *</p>
              <VietnamAddressInput
                key={showForm ? "open" : "closed"}
                onChange={address => setForm(f => ({ ...f, address }))}
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs text-gray-500">Tọa độ GPS (để tính "Gần đây")</p>
                <button type="button" onClick={geocodeAddress} disabled={geocoding || !form.address}
                  className="text-xs text-emerald-600 hover:text-emerald-500 disabled:opacity-40 font-medium">
                  {geocoding ? "Đang lấy..." : "Tự động lấy tọa độ"}
                </button>
              </div>
              <div className="flex gap-2">
                <input className={INPUT} placeholder="Vĩ độ (latitude)" type="number" step="any"
                  value={form.latitude} onChange={e => setForm(f => ({ ...f, latitude: e.target.value }))} />
                <input className={INPUT} placeholder="Kinh độ (longitude)" type="number" step="any"
                  value={form.longitude} onChange={e => setForm(f => ({ ...f, longitude: e.target.value }))} />
              </div>
              {form.latitude && form.longitude && (
                <a href={`https://www.openstreetmap.org/?mlat=${form.latitude}&mlon=${form.longitude}&zoom=16`}
                  target="_blank" rel="noopener noreferrer"
                  className="text-xs text-blue-500 hover:underline mt-1 inline-block">
                  Kiểm tra trên bản đồ ↗
                </a>
              )}
            </div>
            <textarea className={INPUT} rows={2} placeholder="Mô tả" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            <div className="border border-gray-200 rounded-xl p-3 bg-white/50">
              <p className="text-xs text-gray-500 font-medium mb-2">Ảnh cơ sở</p>
              <ImageUpload
                value={form.imageUrl}
                onChange={url => setForm(f => ({ ...f, imageUrl: url }))}
                uploading={facilityImgUploading}
                setUploading={setFacilityImgUploading}
              />
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1.5">Môn thể thao:</p>
              <div className="flex flex-wrap gap-2">
                {sports.map(s => (
                  <button key={s.id} onClick={() => toggleSport(s.id)}
                    className={`px-3 py-1 rounded-full text-xs border transition-colors ${form.sportIds.includes(s.id) ? "bg-emerald-500 text-white border-emerald-500" : "bg-white text-gray-600 border-gray-300"}`}>
                    {s.name}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowForm(false)} className={BTN_W}>Hủy</button>
              <button onClick={createFacility} disabled={loading} className={BTN_G}>{loading ? "Đang lưu..." : "Tạo cơ sở"}</button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {facilities.map(f => (
          <div key={f.id} className={CARD} style={BG}>
            <div className="flex justify-between items-start gap-3">
              {f.imageUrl && (
                <div className="w-16 h-16 rounded-xl overflow-hidden border border-gray-200 shrink-0">
                  <img src={f.imageUrl} alt={f.name} className="w-full h-full object-cover" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-black">{f.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">{f.address}</p>
                <div className="flex gap-2 mt-1.5 flex-wrap">
                  <span className="text-xs bg-white border border-gray-200 rounded-full px-2 py-0.5">{f.courtCount} sân</span>
                  <span className="text-xs bg-white border border-gray-200 rounded-full px-2 py-0.5">{f.staffCount} NV</span>
                  {f.sports.map(s => <span key={s.id} className="text-xs bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-full px-2 py-0.5">{s.name}</span>)}
                </div>
              </div>
              <button onClick={() => expandedId === f.id ? setExpandedId(null) : loadCourts(f.id)}
                className={BTN_W + " text-xs"}>
                {expandedId === f.id ? "Đóng" : "Quản lý sân ▸"}
              </button>
            </div>

            {expandedId === f.id && (
              <div className="mt-4 border-t border-gray-200 pt-4">
                <h4 className="text-sm font-semibold text-black mb-3">Danh sách sân con</h4>
                {courts.length === 0 ? <p className="text-xs text-gray-400">Chưa có sân nào</p> : (
                  <div className="space-y-2 mb-4">
                    {courts.map((c: any) => (
                      <div key={c.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-2.5">
                          <div>
                            <p className="text-sm font-medium text-black">{c.name}</p>
                            <p className="text-xs text-gray-500">{c.category?.name}</p>
                          </div>
                          <div className="flex gap-1.5">
                            <button onClick={() => openCourtManage(c.id, "pricing")}
                              className="bg-blue-500 hover:bg-blue-400 text-white px-2.5 py-1 rounded-lg text-xs transition-colors">
                              Khung giờ & giá
                            </button>
                            <button onClick={() => openCourtManage(c.id, "schedule")}
                              className="bg-purple-500 hover:bg-purple-400 text-white px-2.5 py-1 rounded-lg text-xs transition-colors">
                              Lịch sân
                            </button>
                            <button onClick={() => openCourtManage(c.id, "lock")}
                              className="bg-orange-500 hover:bg-orange-400 text-white px-2.5 py-1 rounded-lg text-xs transition-colors">
                              Khóa sân
                            </button>
                            <button onClick={() => deleteCourt(c.id)} className={BTN_R}>Xóa</button>
                          </div>
                        </div>

                        {/* Court management panel */}
                        {managingCourtId === c.id && (
                          <div className="border-t border-gray-100 bg-gray-50 p-4">
                            <div className="flex gap-1 mb-3">
                              {(["pricing", "schedule", "lock"] as const).map(t => (
                                <button key={t} onClick={() => { setManagingTab(t); if(t==="schedule") loadSchedule(c.id); if(t==="lock") loadLocks(c.id); }}
                                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors border ${managingTab === t ? "bg-emerald-500 text-white border-emerald-500" : "bg-white text-gray-600 border-gray-300"}`}>
                                  {t === "pricing" ? "Khung giờ & Giá" : t === "schedule" ? "Lịch hiện tại" : "Khóa sân"}
                                </button>
                              ))}
                              <button onClick={() => setManagingCourtId(null)} className="ml-auto text-gray-400 hover:text-gray-600 text-xs">✕ Đóng</button>
                            </div>

                            {/* Pricing tab */}
                            {managingTab === "pricing" && (
                              <div>
                                <div className="space-y-2 mb-3">
                                  {pricingRules.map((rule, idx) => (
                                    <div key={idx} className="grid grid-cols-6 gap-1.5 items-center bg-white p-2 rounded-lg border border-gray-200">
                                      <select className={INPUT + " text-xs py-1"} value={rule.dayType}
                                        onChange={e => setPricingRules(prev => prev.map((r,i) => i===idx ? {...r, dayType: e.target.value as any} : r))}>
                                        <option value="WEEKDAY">Ngày thường</option>
                                        <option value="WEEKEND">Cuối tuần</option>
                                        <option value="HOLIDAY">Ngày lễ</option>
                                      </select>
                                      <input type="time" className={INPUT + " text-xs py-1"} value={rule.startTime}
                                        onChange={e => setPricingRules(prev => prev.map((r,i) => i===idx ? {...r, startTime: e.target.value} : r))} />
                                      <input type="time" className={INPUT + " text-xs py-1"} value={rule.endTime}
                                        onChange={e => setPricingRules(prev => prev.map((r,i) => i===idx ? {...r, endTime: e.target.value} : r))} />
                                      <input type="number" placeholder="Giá/giờ (đ)" className={INPUT + " text-xs py-1"} value={rule.pricePerHour}
                                        onChange={e => setPricingRules(prev => prev.map((r,i) => i===idx ? {...r, pricePerHour: Number(e.target.value)} : r))} />
                                      <label className="flex items-center gap-1 text-xs cursor-pointer">
                                        <input type="checkbox" checked={rule.isPeak}
                                          onChange={e => setPricingRules(prev => prev.map((r,i) => i===idx ? {...r, isPeak: e.target.checked, priority: e.target.checked ? 1 : 0} : r))} />
                                        <span className={rule.isPeak ? "text-amber-600 font-semibold" : "text-gray-500"}>Cao điểm</span>
                                      </label>
                                      <button onClick={() => removePricingRule(idx)} className="text-red-400 hover:text-red-600 text-xs">✕ Xóa</button>
                                    </div>
                                  ))}
                                </div>
                                <div className="flex gap-2">
                                  <button onClick={addPricingRule} className={BTN_W + " text-xs py-1.5"}>+ Thêm khung giờ</button>
                                  <button onClick={savePricingRules} disabled={savingPricing} className={BTN_G + " text-xs py-1.5"}>{savingPricing ? "Đang lưu..." : "Lưu tất cả"}</button>
                                </div>
                              </div>
                            )}

                            {/* Schedule tab */}
                            {managingTab === "schedule" && (
                              <div>
                                <div className="flex gap-2 mb-3 items-center">
                                  <input type="date" className={INPUT + " w-44 text-xs py-1"} value={scheduleDate}
                                    onChange={e => setScheduleDate(e.target.value)} />
                                  <button onClick={() => loadSchedule(c.id)} className={BTN_G + " text-xs py-1.5"}>Xem</button>
                                </div>
                                {scheduleData && (
                                  <div className="space-y-1 max-h-60 overflow-y-auto">
                                    {scheduleData.locks?.length > 0 && (
                                      <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-xs text-red-700 mb-2">
                                        🔒 Sân đang bị khóa ({scheduleData.locks.map((l: any) => `${new Date(l.startDate).toLocaleDateString("vi-VN")} - ${new Date(l.endDate).toLocaleDateString("vi-VN")}`).join(", ")})
                                      </div>
                                    )}
                                    {[...scheduleData.bookings || [], ...scheduleData.guestBookings || []].length === 0 ? (
                                      <p className="text-xs text-gray-400 py-2">Không có lịch đặt</p>
                                    ) : [...scheduleData.bookings || [], ...scheduleData.guestBookings || []].sort((a: any, b: any) => new Date(a.bookingDate).getTime() - new Date(b.bookingDate).getTime()).map((b: any, idx: number) => (
                                      <div key={idx} className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs flex justify-between">
                                        <div>
                                          <span className="font-medium">{new Date(b.bookingDate).toLocaleDateString("vi-VN")}</span>
                                          <span className="ml-2 text-gray-500">{new Date(b.startTime).toISOString().substring(11,16)} – {new Date(b.endTime).toISOString().substring(11,16)}</span>
                                        </div>
                                        <div className="text-right">
                                          <p className="font-medium">{b.customer?.fullName || b.guestName || b.walkInName || "Khách vãng lai"}</p>
                                          <p className="text-gray-400">{b.customer?.phone || b.guestPhone || ""}</p>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Lock tab */}
                            {managingTab === "lock" && (
                              <div>
                                {/* Existing locks */}
                                {courtLocks.length > 0 && (
                                  <div className="mb-3 space-y-1">
                                    <p className="text-xs font-semibold text-gray-600 mb-1">Đang khóa:</p>
                                    {courtLocks.map(lock => (
                                      <div key={lock.id} className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex justify-between items-center text-xs">
                                        <div>
                                          <span className="font-medium text-red-700">{lock.reason === "INCIDENT" ? "Sự cố" : lock.reason === "MONTHLY_RENTAL" ? "Thuê tháng" : lock.reason === "ANNUAL_RENTAL" ? "Thuê năm" : "Bảo trì"}</span>
                                          <span className="ml-2 text-gray-500">{new Date(lock.startDate).toLocaleDateString("vi-VN")} – {new Date(lock.endDate).toLocaleDateString("vi-VN")}</span>
                                          {lock.note && <p className="text-gray-400 mt-0.5">{lock.note}</p>}
                                        </div>
                                        <button onClick={() => removeLock(lock.id)} className="text-gray-400 hover:text-red-500 transition-colors">Mở khóa</button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {/* Add lock form */}
                                <div className="bg-white border border-gray-200 rounded-lg p-3 space-y-2">
                                  <p className="text-xs font-semibold text-gray-600">Thêm lịch khóa sân:</p>
                                  <select className={INPUT + " text-xs py-1"} value={lockForm.reason}
                                    onChange={e => setLockForm(f => ({ ...f, reason: e.target.value }))}>
                                    <option value="INCIDENT">Sự cố / Hỏng hóc</option>
                                    <option value="MAINTENANCE">Bảo trì</option>
                                    <option value="MONTHLY_RENTAL">Cho thuê bao tháng</option>
                                    <option value="ANNUAL_RENTAL">Cho thuê bao năm</option>
                                  </select>
                                  <div className="grid grid-cols-2 gap-2">
                                    <div>
                                      <p className="text-xs text-gray-500 mb-1">Từ ngày</p>
                                      <input type="date" className={INPUT + " text-xs py-1"} value={lockForm.startDate}
                                        onChange={e => setLockForm(f => ({ ...f, startDate: e.target.value }))} />
                                    </div>
                                    <div>
                                      <p className="text-xs text-gray-500 mb-1">Đến ngày</p>
                                      <input type="date" className={INPUT + " text-xs py-1"} value={lockForm.endDate}
                                        onChange={e => setLockForm(f => ({ ...f, endDate: e.target.value }))} />
                                    </div>
                                  </div>
                                  <input className={INPUT + " text-xs py-1"} placeholder="Ghi chú (tùy chọn)" value={lockForm.note}
                                    onChange={e => setLockForm(f => ({ ...f, note: e.target.value }))} />
                                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                                    <input type="checkbox" checked={lockForm.notifyCustomers}
                                      onChange={e => setLockForm(f => ({ ...f, notifyCustomers: e.target.checked }))} />
                                    Gửi thông báo đến khách hàng có lịch đặt
                                  </label>
                                  <button onClick={addLock} className={BTN_G + " text-xs py-1.5 w-full"}>Khóa sân</button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className="bg-white rounded-xl p-4 border border-gray-200">
                  <p className="text-sm font-semibold text-black mb-3">+ Thêm sân mới</p>
                  <div className="grid grid-cols-2 gap-2">
                    <input className={INPUT} placeholder="Tên sân *" value={courtForm.name} onChange={e => setCourtForm(f => ({ ...f, name: e.target.value }))} />
                    <select className={INPUT} value={courtForm.categoryId} onChange={e => setCourtForm(f => ({ ...f, categoryId: e.target.value }))}>
                      <option value="">-- Môn thể thao --</option>
                      {sports.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    <input className={INPUT} placeholder="Giá ngày thường (nghìn đ/giờ)" type="number" value={courtForm.weekdayPrice} onChange={e => setCourtForm(f => ({ ...f, weekdayPrice: e.target.value }))} />
                    <input className={INPUT} placeholder="Giá cuối tuần (nghìn đ/giờ)" type="number" value={courtForm.weekendPrice} onChange={e => setCourtForm(f => ({ ...f, weekendPrice: e.target.value }))} />
                    <input className={INPUT} placeholder="Giá cao điểm 17-21h (nghìn đ/giờ)" type="number" value={courtForm.peakPrice} onChange={e => setCourtForm(f => ({ ...f, peakPrice: e.target.value }))} />
                    <button onClick={addCourt} disabled={loading} className={BTN_G + " h-full"}>{loading ? "..." : "Thêm sân"}</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Staff Tab ───────────────────────────────────────────────────────────────
function StaffTab({ facilities }: { facilities: Facility[] }) {
  const [staff, setStaff] = useState<StaffRecord[]>([]);
  const [selectedFacility, setSelectedFacility] = useState<string>("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    facilityId: "", fullName: "", email: "", phone: "", password: "", role: "STAFF",
    employmentType: "PARTTIME", wageRate: "",
  });
  const [editingStaff, setEditingStaff] = useState<StaffRecord | null>(null);
  const [editForm, setEditForm] = useState({ fullName: "", phone: "", role: "STAFF", employmentType: "PARTTIME", wageRate: "" });
  const [loading, setLoading] = useState(false);

  const loadStaff = useCallback((fid?: string) => {
    const q = fid ? `?facilityId=${fid}` : "";
    fetch(`/api/owner/staff${q}`).then(r => r.json()).then(d => setStaff(Array.isArray(d) ? d : []));
  }, []);

  useEffect(() => { loadStaff(); }, [loadStaff]);

  async function createStaff() {
    setLoading(true);
    const wageType = form.employmentType === "PARTTIME" ? "HOURLY" : "DAILY";
    const res = await fetch("/api/owner/staff", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, wageType, wageRate: form.wageRate ? Number(form.wageRate) * 1000 : 0 }),
    });
    setLoading(false);
    if (res.ok) {
      setShowForm(false);
      setForm({ facilityId: "", fullName: "", email: "", phone: "", password: "", role: "STAFF", employmentType: "PARTTIME", wageRate: "" });
      loadStaff(selectedFacility);
    } else { const d = await res.json(); alert(d.error); }
  }

  async function saveEditStaff() {
    if (!editingStaff) return;
    setLoading(true);
    const wageType = editForm.employmentType === "PARTTIME" ? "HOURLY" : "DAILY";
    const res = await fetch(`/api/owner/staff/${editingStaff.staffRecordId}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName: editForm.fullName, phone: editForm.phone, role: editForm.role, wageType, wageRate: editForm.wageRate ? Number(editForm.wageRate) * 1000 : 0 }),
    });
    setLoading(false);
    if (res.ok) { setEditingStaff(null); loadStaff(selectedFacility); }
    else { const d = await res.json(); alert(d.error); }
  }

  async function toggleLockStaff(recordId: number, isLocked: boolean) {
    if (!confirm(`${isLocked ? "Mở khóa" : "Khóa"} tài khoản nhân viên này?`)) return;
    await fetch(`/api/owner/staff/${recordId}`, { method: "PATCH" });
    loadStaff(selectedFacility);
  }

  function openEdit(s: StaffRecord) {
    const cfg = s.wageConfig;
    setEditForm({
      fullName: s.user.fullName,
      phone: s.user.phone,
      role: s.role,
      employmentType: cfg?.wageType === "DAILY" ? "FULLTIME" : "PARTTIME",
      wageRate: cfg ? String(cfg.wageRate / 1000) : "",
    });
    setEditingStaff(s);
  }

  const filtered = selectedFacility ? staff.filter(s => s.facilityId === Number(selectedFacility)) : staff;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <select className={INPUT + " w-48"} value={selectedFacility}
          onChange={e => { setSelectedFacility(e.target.value); loadStaff(e.target.value); }}>
          <option value="">Tất cả cơ sở</option>
          {facilities.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
        <button onClick={() => setShowForm(!showForm)} className={BTN_G}>+ Thêm nhân viên</button>
      </div>

      {showForm && (
        <div className={CARD} style={BG}>
          <h3 className="font-semibold text-black mb-3">Tạo tài khoản nhân viên</h3>
          <div className="grid grid-cols-2 gap-2.5">
            <select className={INPUT} value={form.facilityId} onChange={e => setForm(f => ({ ...f, facilityId: e.target.value }))}>
              <option value="">-- Chọn cơ sở * --</option>
              {facilities.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
            <select className={INPUT} value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
              <option value="STAFF">Nhân viên</option>
              <option value="WAREHOUSE_MANAGER">Quản lý kho</option>
            </select>
            <input className={INPUT} placeholder="Họ và tên *" value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} />
            <input className={INPUT} placeholder="Email *" type="email" autoComplete="off" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            <input className={INPUT} placeholder="Số điện thoại *" type="tel" autoComplete="off" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            <input className={INPUT} placeholder="Mật khẩu *" type="password" autoComplete="new-password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
            <select className={INPUT} value={form.employmentType} onChange={e => setForm(f => ({ ...f, employmentType: e.target.value }))}>
              <option value="PARTTIME">Theo giờ (Hourly)</option>
              <option value="FULLTIME">Theo ngày (Daily)</option>
            </select>
            <input className={INPUT} type="number" min="0"
              placeholder={form.employmentType === "PARTTIME" ? "Mức lương (nghìn đ/giờ)" : "Mức lương (nghìn đ/ngày)"}
              value={form.wageRate} onChange={e => setForm(f => ({ ...f, wageRate: e.target.value }))} />
          </div>
          <div className="flex gap-2 justify-end mt-3">
            <button onClick={() => setShowForm(false)} className={BTN_W}>Hủy</button>
            <button onClick={createStaff} disabled={loading} className={BTN_G}>{loading ? "Đang tạo..." : "Tạo tài khoản"}</button>
          </div>
        </div>
      )}

      {/* Edit form */}
      {editingStaff && (
        <div className={CARD} style={BG}>
          <h3 className="font-semibold text-black mb-3">Sửa thông tin: {editingStaff.user.fullName}</h3>
          <div className="grid grid-cols-2 gap-2.5">
            <input className={INPUT} placeholder="Họ và tên" value={editForm.fullName} onChange={e => setEditForm(f => ({ ...f, fullName: e.target.value }))} />
            <input className={INPUT} placeholder="Số điện thoại" value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} />
            <select className={INPUT} value={editForm.role} onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))}>
              <option value="STAFF">Nhân viên</option>
              <option value="WAREHOUSE_MANAGER">Quản lý kho</option>
            </select>
            <select className={INPUT} value={editForm.employmentType} onChange={e => setEditForm(f => ({ ...f, employmentType: e.target.value }))}>
              <option value="PARTTIME">Theo giờ (Hourly)</option>
              <option value="FULLTIME">Theo ngày (Daily)</option>
            </select>
            <input className={INPUT} type="number" min="0"
              placeholder={editForm.employmentType === "PARTTIME" ? "Mức lương (nghìn đ/giờ)" : "Mức lương (nghìn đ/ngày)"}
              value={editForm.wageRate} onChange={e => setEditForm(f => ({ ...f, wageRate: e.target.value }))} />
            <div className="flex items-center text-xs text-gray-500 px-1">
              Ngày bắt đầu: {new Date(editingStaff.joinedAt).toLocaleDateString("vi-VN")}
            </div>
          </div>
          <div className="flex gap-2 justify-end mt-3">
            <button onClick={() => setEditingStaff(null)} className={BTN_W}>Hủy</button>
            <button onClick={saveEditStaff} disabled={loading} className={BTN_G}>{loading ? "Đang lưu..." : "Lưu thay đổi"}</button>
          </div>
        </div>
      )}

      <div className="overflow-auto rounded-2xl border border-gray-300" style={BG}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left px-4 py-3 font-semibold text-gray-700">Họ tên</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-700">Email / SĐT</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-700">Vai trò</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-700">Loại hợp đồng</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-700">Cơ sở</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-8 text-gray-400">Chưa có nhân viên</td></tr>
            ) : filtered.map(s => (
              <tr key={s.staffRecordId} className={`border-t border-gray-100 hover:bg-white/50 ${s.user.isLocked ? "opacity-60" : ""}`}>
                <td className="px-4 py-3 font-medium text-black">
                  {s.user.fullName}
                  {s.user.isLocked && <span className="ml-2 text-xs text-red-500 font-normal">(Đã khóa)</span>}
                </td>
                <td className="px-4 py-3 text-gray-600">
                  <p>{s.user.email}</p>
                  <p className="text-xs">{s.user.phone}</p>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${s.role === "WAREHOUSE_MANAGER" ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"}`}>
                    {s.role === "WAREHOUSE_MANAGER" ? "Quản lý kho" : "Nhân viên"}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-gray-600">
                  {s.wageConfig ? (
                    <div>
                      <span className={`px-2 py-0.5 rounded-full ${s.wageConfig.wageType === "DAILY" ? "bg-purple-100 text-purple-700" : "bg-sky-100 text-sky-700"}`}>
                        {s.wageConfig.wageType === "DAILY" ? "Theo ngày" : "Theo giờ"}
                      </span>
                      <p className="text-gray-500 mt-0.5">{Number(s.wageConfig.wageRate).toLocaleString("vi-VN")}đ/{s.wageConfig.wageType === "DAILY" ? "ngày" : "giờ"}</p>
                    </div>
                  ) : <span className="text-gray-400">Chưa cấu hình</span>}
                </td>
                <td className="px-4 py-3 text-gray-600 text-xs">{s.facilityName}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => openEdit(s)}
                      className="bg-blue-500 hover:bg-blue-400 text-white px-3 py-1.5 rounded-lg text-xs transition-colors">
                      Sửa
                    </button>
                    <button onClick={() => toggleLockStaff(s.staffRecordId, s.user.isLocked)}
                      className={s.user.isLocked ? BTN_G : BTN_R}>
                      {s.user.isLocked ? "Mở khóa" : "Khóa"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Attendance Tab ──────────────────────────────────────────────────────────
function AttendanceTab({ facilities }: { facilities: Facility[] }) {
  const now = new Date();
  const [facilityId, setFacilityId] = useState<string>("");
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [data, setData] = useState<AttendanceStaff[]>([]);
  const [expandedStaff, setExpandedStaff] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [viewMode, setViewMode] = useState<"month" | "day">("month");
  const [selectedDate, setSelectedDate] = useState(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`);

  async function load() {
    if (!facilityId) { alert("Vui lòng chọn cơ sở"); return; }
    const params = viewMode === "day"
      ? `facilityId=${facilityId}&viewMode=day&date=${selectedDate}`
      : `facilityId=${facilityId}&viewMode=month&month=${month}&year=${year}`;
    const res = await fetch(`/api/owner/attendance?${params}`);
    const d = await res.json();
    setData(d);
    setLoaded(true);
  }

  const STATUS_LABEL: Record<string, string> = { WORKING: "Đang làm", COMPLETED: "Hoàn thành", ABSENT: "Vắng" };

  return (
    <div>
      <div className={CARD} style={BG}>
        <div className="flex gap-1 mb-3">
          {(["month", "day"] as const).map(v => (
            <button key={v} onClick={() => setViewMode(v)}
              className={`px-4 py-1.5 rounded-xl text-sm font-medium transition-colors border ${viewMode === v ? "bg-emerald-500 text-white border-emerald-500" : "bg-white text-gray-600 border-gray-300 hover:border-emerald-300"}`}>
              {v === "month" ? "Theo tháng" : "Theo ngày"}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <p className="text-xs text-gray-500 mb-1">Cơ sở</p>
            <select className={INPUT + " w-48"} value={facilityId} onChange={e => setFacilityId(e.target.value)}>
              <option value="">-- Chọn cơ sở --</option>
              {facilities.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>
          {viewMode === "month" ? (
            <>
              <div>
                <p className="text-xs text-gray-500 mb-1">Tháng</p>
                <select className={INPUT + " w-28"} value={month} onChange={e => setMonth(Number(e.target.value))}>
                  {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>Tháng {i + 1}</option>)}
                </select>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Năm</p>
                <select className={INPUT + " w-28"} value={year} onChange={e => setYear(Number(e.target.value))}>
                  {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </>
          ) : (
            <div>
              <p className="text-xs text-gray-500 mb-1">Ngày</p>
              <input type="date" className={INPUT + " w-44"} value={selectedDate}
                onChange={e => { setSelectedDate(e.target.value); }} />
            </div>
          )}
          <button onClick={load} className={BTN_G}>Xem</button>
        </div>
      </div>

      {loaded && data.map(staff => (
        <div key={staff.userId} className={CARD} style={BG}>
          <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpandedStaff(expandedStaff === staff.userId ? null : staff.userId)}>
            <div>
              <p className="font-semibold text-black">{staff.fullName}</p>
              <p className="text-xs text-gray-500">{staff.role === "WAREHOUSE_MANAGER" ? "Quản lý kho" : "Nhân viên"}{staff.wageType === "DAILY" ? " · Toàn thời gian" : ""}</p>
            </div>
            <div className="flex gap-3 text-right text-sm flex-wrap justify-end">
              <div><p className="font-bold text-emerald-600">{staff.presentDays}</p><p className="text-xs text-gray-500">ngày</p></div>
              {staff.totalHours !== null && (
                <div><p className="font-bold text-blue-600">{staff.totalHours}h</p><p className="text-xs text-gray-500">giờ</p></div>
              )}
              {staff.lateDays > 0 && (
                <div><p className="font-bold text-orange-500">{staff.lateDays}</p><p className="text-xs text-gray-500">trễ</p></div>
              )}
              {staff.forgotCheckInCount > 0 && (
                <div><p className="font-bold text-red-500">{staff.forgotCheckInCount}</p><p className="text-xs text-gray-500">quên vào</p></div>
              )}
              {staff.forgotCheckOutCount > 0 && (
                <div><p className="font-bold text-red-500">{staff.forgotCheckOutCount}</p><p className="text-xs text-gray-500">quên ra</p></div>
              )}
              {staff.overtimeTotalMinutes > 0 && (
                <div><p className="font-bold text-purple-600">{Math.round(staff.overtimeTotalMinutes / 60 * 10) / 10}h</p><p className="text-xs text-gray-500">tăng ca</p></div>
              )}
              <span className="text-gray-400">{expandedStaff === staff.userId ? "▲" : "▼"}</span>
            </div>
          </div>

          {expandedStaff === staff.userId && (
            <div className="mt-3 overflow-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-3 font-semibold text-gray-600">Ngày</th>
                    {viewMode === "day" && <th className="text-left py-2 px-3 font-semibold text-gray-600">Ca làm</th>}
                    {viewMode === "day" && <th className="text-left py-2 px-3 font-semibold text-gray-600">Bắt đầu ca</th>}
                    <th className="text-left py-2 px-3 font-semibold text-gray-600">Check-in</th>
                    <th className="text-left py-2 px-3 font-semibold text-gray-600">Check-out</th>
                    {viewMode === "day" && <th className="text-left py-2 px-3 font-semibold text-gray-600">Kết thúc ca</th>}
                    {staff.totalHours !== null && <th className="text-left py-2 px-3 font-semibold text-gray-600">Giờ</th>}
                    <th className="text-left py-2 px-3 font-semibold text-gray-600">Nhãn</th>
                    <th className="text-left py-2 px-3 font-semibold text-gray-600">Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {staff.records.length === 0 ? (
                    <tr><td colSpan={8} className="py-4 text-center text-gray-400">Không có dữ liệu</td></tr>
                  ) : staff.records.map(r => (
                    <tr key={r.id} className="border-t border-gray-100">
                      <td className="py-2 px-3">{new Date(r.date).toLocaleDateString("vi-VN")}</td>
                      {viewMode === "day" && (
                        <td className="py-2 px-3 text-blue-600 font-medium">{r.shift?.name ?? "—"}</td>
                      )}
                      {viewMode === "day" && (
                        <td className="py-2 px-3 text-gray-500">{r.shift ? new Date(r.shift.startTime).toISOString().substring(11,16) : "—"}</td>
                      )}
                      <td className={`py-2 px-3 ${r.isLate ? "text-red-500 font-semibold" : ""}`}>
                        {r.checkIn ? new Date(r.checkIn).toISOString().substring(11,16) : (r.forgotCheckIn ? <span className="text-red-400 italic">Quên</span> : "—")}
                      </td>
                      <td className={`py-2 px-3 ${r.forgotCheckOut ? "text-orange-500" : ""}`}>
                        {r.checkOut ? new Date(r.checkOut).toISOString().substring(11,16) : (r.forgotCheckOut ? <span className="text-orange-400 italic">Quên</span> : "—")}
                      </td>
                      {viewMode === "day" && (
                        <td className="py-2 px-3 text-gray-500">{r.shift ? new Date(r.shift.endTime).toISOString().substring(11,16) : "—"}</td>
                      )}
                      {staff.totalHours !== null && (
                        <td className="py-2 px-3 font-medium">{r.totalHours ?? "—"}</td>
                      )}
                      <td className="py-2 px-3">
                        <div className="flex flex-wrap gap-1">
                          {r.isLate && <span className="px-1.5 py-0.5 rounded bg-orange-100 text-orange-600">Trễ</span>}
                          {r.forgotCheckIn && <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-600">Quên check-in</span>}
                          {r.forgotCheckOut && <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-600">Quên check-out</span>}
                          {r.overtimeMinutes > 0 && <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-600">+{Math.round(r.overtimeMinutes/60*10)/10}h TC</span>}
                        </div>
                      </td>
                      <td className="py-2 px-3">
                        <span className={`px-2 py-0.5 rounded-full ${r.status === "ABSENT" ? "bg-red-100 text-red-600" : r.status === "WORKING" ? "bg-yellow-100 text-yellow-700" : "bg-emerald-100 text-emerald-700"}`}>
                          {STATUS_LABEL[r.status] || r.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Salary Tab ──────────────────────────────────────────────────────────────
function SalaryTab({ facilities }: { facilities: Facility[] }) {
  const now = new Date();
  const [facilityId, setFacilityId] = useState<string>("");
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [staffData, setStaffData] = useState<SalaryStaffRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [bonusInputs, setBonusInputs] = useState<Record<number, string>>({});
  const [overtimeInputs, setOvertimeInputs] = useState<Record<number, string>>({});
  const [penaltyInputs, setPenaltyInputs] = useState<Record<number, string>>({});
  const [savingId, setSavingId] = useState<number | null>(null);

  async function load() {
    if (!facilityId) return;
    const res = await fetch(`/api/owner/salary?facilityId=${facilityId}&month=${month}&year=${year}`);
    if (res.ok) {
      const d = await res.json();
      setStaffData(d.staffData || []);
      const initBonus: Record<number, string> = {};
      const initOvertime: Record<number, string> = {};
      const initPenalty: Record<number, string> = {};
      (d.staffData || []).forEach((s: SalaryStaffRow) => {
        initBonus[s.userId] = s.salaryRecord ? String(s.salaryRecord.bonus / 1000) : "0";
        initOvertime[s.userId] = s.salaryRecord ? String(s.salaryRecord.overtimePay / 1000) : "0";
        initPenalty[s.userId] = s.salaryRecord ? String(s.salaryRecord.penaltyAmount / 1000) : "0";
      });
      setBonusInputs(initBonus);
      setOvertimeInputs(initOvertime);
      setPenaltyInputs(initPenalty);
      setLoaded(true);
    }
  }

  async function saveSalary(row: SalaryStaffRow) {
    if (!row.wageConfig) { alert("Nhân viên chưa có cấu hình lương. Vào tab Nhân viên để cài đặt."); return; }
    setSavingId(row.userId);
    const bonus = Number(bonusInputs[row.userId] || 0) * 1000;
    const overtimePay = Number(overtimeInputs[row.userId] || 0) * 1000;
    const penaltyAmount = Number(penaltyInputs[row.userId] || 0) * 1000;
    const res = await fetch("/api/owner/salary", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        facilityId: Number(facilityId), staffId: row.userId, month, year,
        wageType: row.wageConfig.wageType, wageRate: row.wageConfig.wageRate,
        bonus, overtimePay, penaltyAmount,
      }),
    });
    setSavingId(null);
    if (res.ok) load();
    else { const d = await res.json(); alert(d.error); }
  }

  async function paySalary(recordId: number) {
    if (!confirm("Xác nhận thanh toán lương?")) return;
    const res = await fetch("/api/owner/salary/pay", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ salaryRecordId: recordId }),
    });
    if (res.ok) load();
    else { const d = await res.json(); alert(d.error); }
  }

  function calcSalary(row: SalaryStaffRow) {
    if (!row.wageConfig) return null;
    const { wageType, wageRate } = row.wageConfig;
    const base = wageType === "HOURLY"
      ? (row.attendance.totalHours ?? 0) * wageRate
      : row.attendance.presentDays * wageRate;
    const bonus = Number(bonusInputs[row.userId] || 0) * 1000;
    const overtime = Number(overtimeInputs[row.userId] || 0) * 1000;
    const penalty = Number(penaltyInputs[row.userId] || 0) * 1000;
    return { base, bonus, overtime, penalty, total: base + bonus + overtime - penalty };
  }

  const savedRows   = staffData.filter(s => s.salaryRecord);
  const totalPaid   = savedRows.filter(s => s.salaryRecord?.isPaid).reduce((a, s) => a + (s.salaryRecord?.finalSalary ?? 0), 0);
  const totalUnpaid = savedRows.filter(s => !s.salaryRecord?.isPaid).reduce((a, s) => a + (s.salaryRecord?.finalSalary ?? 0), 0);

  function exportSalaryExcel() {
    const cell = (v: string | number, type: "String" | "Number" = "String") =>
      `<Cell><Data ss:Type="${type}">${String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;")}</Data></Cell>`;
    const xmlRow = (...cells: string[]) => `<Row>${cells.join("")}</Row>`;
    const sheet = `<Worksheet ss:Name="Bảng lương T${month}-${year}"><Table>
      ${xmlRow(cell("Họ tên"), cell("Chức danh"), cell("Ngày làm"), cell("Giờ làm"), cell("Lương cơ bản (đ)"), cell("Thưởng (đ)"), cell("Tăng ca (h)"), cell("Lương tăng ca (đ)"), cell("Tiền phạt (đ)"), cell("Trễ (ngày)"), cell("Quên check-out"), cell("Tổng lương (đ)"), cell("Trạng thái"))}
      ${staffData.map(r => {
        const calc = calcSalary(r);
        const sal = r.salaryRecord;
        return xmlRow(
          cell(r.fullName),
          cell(r.role === "WAREHOUSE_MANAGER" ? "Quản lý kho" : "Nhân viên"),
          cell(r.attendance.presentDays, "Number"),
          cell(r.attendance.totalHours ?? 0, "Number"),
          cell(calc ? Number(calc.base) : sal ? Number(sal.baseSalary) : 0, "Number"),
          cell(sal ? Number(sal.bonus) : Number(bonusInputs[r.userId] || 0) * 1000, "Number"),
          cell(r.attendance.overtimeHours, "Number"),
          cell(sal ? Number(sal.overtimePay) : Number(overtimeInputs[r.userId] || 0) * 1000, "Number"),
          cell(sal ? Number(sal.penaltyAmount) : Number(penaltyInputs[r.userId] || 0) * 1000, "Number"),
          cell(r.attendance.lateDays ?? 0, "Number"),
          cell(r.attendance.forgotCheckOutCount ?? 0, "Number"),
          cell(calc ? Number(calc.total) : sal ? Number(sal.finalSalary) : 0, "Number"),
          cell(sal?.isPaid ? "Đã trả" : "Chưa trả"),
        );
      }).join("\n")}
    </Table></Worksheet>`;
    const xml = `<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">${sheet}</Workbook>`;
    const blob = new Blob([xml], { type: "application/vnd.ms-excel" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `bang-luong-T${month}-${year}.xls`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      {/* Header + bộ lọc */}
      <div className={CARD} style={BG}>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <p className="text-xs text-gray-500 mb-1">Cơ sở</p>
            <select className={INPUT + " w-48"} value={facilityId} onChange={e => setFacilityId(e.target.value)}>
              <option value="">-- Chọn cơ sở --</option>
              {facilities.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Tháng</p>
            <select className={INPUT + " w-24"} value={month} onChange={e => setMonth(Number(e.target.value))}>
              {Array.from({ length: 12 }, (_, i) => <option key={i+1} value={i+1}>T{i+1}</option>)}
            </select>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Năm</p>
            <select className={INPUT + " w-24"} value={year} onChange={e => setYear(Number(e.target.value))}>
              {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <button onClick={load} className={BTN_G}>Xem</button>
          {loaded && staffData.length > 0 && (
            <button onClick={exportSalaryExcel} className={BTN_W + " flex items-center gap-1.5"}>
              ⬇ Xuất Excel
            </button>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-2">Ngày trả lương mặc định: <span className="font-semibold text-gray-600">mùng 10 hằng tháng</span></p>
      </div>

      {loaded && (
        <>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-black">Bảng lương tháng {month}/{year}</h3>
            <span className="text-xs text-gray-500">{staffData.length} nhân viên</span>
          </div>

          <div className="overflow-auto rounded-2xl border border-gray-300 mb-4" style={BG}>
            <table className="w-full text-sm min-w-max">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">Họ tên</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">Chức danh</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-700">Ngày làm</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-700">Giờ làm</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-700">Lương CB</th>
                  <th className="text-center px-4 py-3 font-semibold text-amber-600">Thưởng (nghìn)</th>
                  <th className="text-center px-4 py-3 font-semibold text-purple-600">Tăng ca (h)</th>
                  <th className="text-center px-4 py-3 font-semibold text-purple-600">Lương TC (nghìn)</th>
                  <th className="text-center px-4 py-3 font-semibold text-red-500">Tiền phạt (nghìn)</th>
                  <th className="text-right px-4 py-3 font-semibold text-orange-500">Trễ / Q.CO</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-700">Tổng lương</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {staffData.length === 0 && (
                  <tr><td colSpan={12} className="text-center py-8 text-gray-400">Chưa có nhân viên trong cơ sở này</td></tr>
                )}
                {staffData.map(row => {
                  const calc = calcSalary(row);
                  const sal = row.salaryRecord;
                  return (
                    <tr key={row.userId} className="border-t border-gray-100 hover:bg-white/50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-black">{row.fullName}</p>
                        {row.wageConfig ? (
                          <p className="text-xs text-gray-400">{Number(row.wageConfig.wageRate).toLocaleString("vi-VN")}đ/{row.wageConfig.wageType === "DAILY" ? "ngày" : "giờ"}</p>
                        ) : (
                          <p className="text-xs text-amber-500">Chưa cấu hình lương</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">{row.role === "WAREHOUSE_MANAGER" ? "Quản lý kho" : "Nhân viên"}</td>
                      <td className="px-4 py-3 text-right font-medium">{row.attendance.presentDays}</td>
                      <td className="px-4 py-3 text-right font-medium">{row.attendance.totalHours !== null ? `${row.attendance.totalHours}h` : "—"}</td>
                      <td className="px-4 py-3 text-right font-medium text-blue-600">
                        {calc ? Number(calc.base).toLocaleString("vi-VN") + "đ" : "—"}
                      </td>
                      {/* Thưởng */}
                      <td className="px-4 py-3 text-center">
                        {sal?.isPaid ? (
                          <span className="text-gray-600">{Number(sal.bonus).toLocaleString("vi-VN")}đ</span>
                        ) : (
                          <input type="number" min="0" placeholder="0"
                            className={INPUT + " max-w-[80px] py-1 text-xs text-center"}
                            value={bonusInputs[row.userId] ?? "0"}
                            onChange={e => setBonusInputs(prev => ({ ...prev, [row.userId]: e.target.value }))}
                          />
                        )}
                      </td>
                      {/* Tăng ca */}
                      <td className="px-4 py-3 text-center text-purple-600 font-medium">
                        {row.attendance.overtimeHours > 0 ? `${row.attendance.overtimeHours}h` : "—"}
                      </td>
                      {/* Lương tăng ca */}
                      <td className="px-4 py-3 text-center">
                        {sal?.isPaid ? (
                          <span className="text-purple-600">{Number(sal.overtimePay).toLocaleString("vi-VN")}đ</span>
                        ) : (
                          <input type="number" min="0" placeholder="0"
                            className={INPUT + " max-w-[80px] py-1 text-xs text-center"}
                            value={overtimeInputs[row.userId] ?? "0"}
                            onChange={e => setOvertimeInputs(prev => ({ ...prev, [row.userId]: e.target.value }))}
                          />
                        )}
                      </td>
                      {/* Tiền phạt */}
                      <td className="px-4 py-3 text-center">
                        {sal?.isPaid ? (
                          <span className="text-red-500">{Number(sal.penaltyAmount) > 0 ? `-${Number(sal.penaltyAmount).toLocaleString("vi-VN")}đ` : "—"}</span>
                        ) : (
                          <input type="number" min="0" placeholder="0"
                            className={INPUT + " max-w-[80px] py-1 text-xs text-center"}
                            value={penaltyInputs[row.userId] ?? "0"}
                            onChange={e => setPenaltyInputs(prev => ({ ...prev, [row.userId]: e.target.value }))}
                          />
                        )}
                      </td>
                      {/* Trễ / Quên check-out */}
                      <td className="px-4 py-3 text-right text-xs">
                        {(row.attendance.lateDays ?? 0) > 0 && (
                          <span className="text-orange-500 font-semibold block">{row.attendance.lateDays} trễ</span>
                        )}
                        {(row.attendance.forgotCheckOutCount ?? 0) > 0 && (
                          <span className="text-red-500 font-semibold block">{row.attendance.forgotCheckOutCount} Q.CO</span>
                        )}
                        {!(row.attendance.lateDays ?? 0) && !(row.attendance.forgotCheckOutCount ?? 0) && (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-600">
                        {calc ? Number(calc.total).toLocaleString("vi-VN") + "đ" : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {sal?.isPaid ? (
                          <div>
                            <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full">Đã trả</span>
                            <p className="text-xs text-gray-400 mt-0.5">{sal.paidAt ? new Date(sal.paidAt).toLocaleDateString("vi-VN") : ""}</p>
                          </div>
                        ) : (
                          <div className="flex gap-1 justify-end">
                            <button onClick={() => saveSalary(row)} disabled={savingId === row.userId || !row.wageConfig}
                              className={BTN_G + " text-xs py-1 px-2"}>
                              {savingId === row.userId ? "..." : sal ? "Cập nhật" : "Lưu"}
                            </button>
                            {sal && !sal.isPaid && (
                              <button onClick={() => paySalary(sal.id)}
                                className="bg-amber-500 hover:bg-amber-400 text-white px-2 py-1 rounded-lg text-xs">
                                Trả
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Tổng kết */}
          {savedRows.length > 0 && (
            <div className="flex gap-3 flex-wrap">
              <div className="bg-white rounded-xl px-4 py-2.5 border border-red-200 flex-1 text-center">
                <p className="text-xs text-gray-500">Chưa thanh toán</p>
                <p className="font-bold text-red-500">{totalUnpaid.toLocaleString("vi-VN")}đ</p>
                <p className="text-xs text-gray-400">{savedRows.filter(s => !s.salaryRecord?.isPaid).length} nhân viên</p>
              </div>
              <div className="bg-white rounded-xl px-4 py-2.5 border border-emerald-200 flex-1 text-center">
                <p className="text-xs text-gray-500">Đã thanh toán</p>
                <p className="font-bold text-emerald-600">{totalPaid.toLocaleString("vi-VN")}đ</p>
                <p className="text-xs text-gray-400">{savedRows.filter(s => s.salaryRecord?.isPaid).length} nhân viên</p>
              </div>
              <div className="bg-white rounded-xl px-4 py-2.5 border border-blue-200 flex-1 text-center">
                <p className="text-xs text-gray-500">Tổng bảng lương</p>
                <p className="font-bold text-blue-600">{(totalPaid + totalUnpaid).toLocaleString("vi-VN")}đ</p>
                <p className="text-xs text-gray-400">{savedRows.length} nhân viên đã lưu</p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}


// ─── Work Shifts Tab ─────────────────────────────────────────────────────────
const DOW_LABELS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

function WorkShiftsTab({ facilities }: { facilities: Facility[] }) {
  const now = new Date();
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay() + 1);
  const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6);
  const fmt = (d: Date) => d.toISOString().substring(0, 10);

  const [facilityId, setFacilityId] = useState<string>("");
  const [viewStart, setViewStart] = useState(fmt(weekStart));
  const [viewEnd, setViewEnd] = useState(fmt(weekEnd));
  const [shifts, setShifts] = useState<WorkShift[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [expandedShift, setExpandedShift] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "Ca sáng",
    fromDate: fmt(weekStart),
    toDate: fmt(weekEnd),
    daysOfWeek: [1, 2, 3, 4, 5] as number[], // T2-T6 mặc định
    startTime: "06:00",
    endTime: "14:00",
    maxStaff: "5",
    note: "",
  });
  const [saving, setSaving] = useState(false);
  const [facilityStaff, setFacilityStaff] = useState<{ userId: number; fullName: string }[]>([]);

  async function load() {
    if (!facilityId) { alert("Vui lòng chọn cơ sở"); return; }
    try {
      const res = await fetch(`/api/owner/work-shifts?facilityId=${facilityId}&startDate=${viewStart}&endDate=${viewEnd}`);
      const data = await res.json();
      if (!res.ok) { alert(data.error || "Lỗi tải ca làm"); return; }
      setShifts(Array.isArray(data) ? data : []);
      setLoaded(true);
      const staffRes = await fetch(`/api/owner/staff?facilityId=${facilityId}`);
      const staffData = await staffRes.json();
      setFacilityStaff(Array.isArray(staffData) ? staffData.map((s: any) => ({ userId: s.user.id, fullName: s.user.fullName })) : []);
    } catch {
      alert("Lỗi kết nối máy chủ. Vui lòng thử lại.");
    }
  }

  function toggleDow(d: number) {
    setForm(f => ({
      ...f,
      daysOfWeek: f.daysOfWeek.includes(d) ? f.daysOfWeek.filter(x => x !== d) : [...f.daysOfWeek, d],
    }));
  }

  // Tính preview số ca sẽ tạo
  function previewCount() {
    if (!form.fromDate || !form.toDate || form.daysOfWeek.length === 0) return 0;
    const from = new Date(form.fromDate);
    const to = new Date(form.toDate);
    let count = 0;
    const cur = new Date(from);
    while (cur <= to) {
      if (form.daysOfWeek.includes(cur.getDay())) count++;
      cur.setDate(cur.getDate() + 1);
    }
    return count;
  }

  async function createShifts() {
    if (!facilityId) return;
    if (form.daysOfWeek.length === 0) { alert("Vui lòng chọn ít nhất một ngày trong tuần"); return; }
    const count = previewCount();
    if (!confirm(`Sẽ tạo ${count} ca làm cho "${form.name}" từ ${form.fromDate} đến ${form.toDate}. Xác nhận?`)) return;
    setSaving(true);
    const res = await fetch("/api/owner/work-shifts", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, facilityId: Number(facilityId), maxStaff: Number(form.maxStaff) }),
    });
    setSaving(false);
    const d = await res.json();
    if (res.ok) {
      alert(`Đã tạo ${d.created} ca làm thành công!`);
      setShowForm(false);
      // Cập nhật view range sang khoảng vừa tạo
      setViewStart(form.fromDate);
      setViewEnd(form.toDate);
      setTimeout(load, 100);
    } else {
      alert(d.error || "Lỗi tạo ca");
    }
  }

  async function deleteBulkShifts(name: string) {
    if (!facilityId) return;
    if (!confirm(`Xóa tất cả ca "${name}" trong khoảng ${viewStart} – ${viewEnd}?`)) return;
    await fetch(`/api/owner/work-shifts?facilityId=${facilityId}&fromDate=${viewStart}&toDate=${viewEnd}&name=${encodeURIComponent(name)}`, { method: "DELETE" });
    load();
  }

  async function deleteShift(shiftId: number) {
    if (!confirm("Xóa ca này?")) return;
    await fetch(`/api/owner/work-shifts/${shiftId}`, { method: "DELETE" });
    load();
  }

  async function approveReg(shiftId: number, registrationId: number, action: "approve" | "reject") {
    await fetch(`/api/owner/work-shifts/${shiftId}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, registrationId }),
    });
    load();
  }

  async function assignStaff(shiftId: number, staffId: number) {
    await fetch(`/api/owner/work-shifts/${shiftId}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "assign", staffId }),
    });
    load();
  }

  async function closeShift(shiftId: number) {
    await fetch(`/api/owner/work-shifts/${shiftId}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "CLOSED" }),
    });
    load();
  }

  const REG_STATUS: Record<string, { label: string; color: string }> = {
    PENDING:  { label: "Chờ duyệt", color: "bg-yellow-100 text-yellow-700" },
    APPROVED: { label: "Đã duyệt",  color: "bg-emerald-100 text-emerald-700" },
    REJECTED: { label: "Từ chối",   color: "bg-red-100 text-red-600" },
  };

  // Group shifts by name for bulk actions
  const shiftGroups = shifts.reduce<Record<string, WorkShift[]>>((acc, s) => {
    if (!acc[s.name]) acc[s.name] = [];
    acc[s.name].push(s);
    return acc;
  }, {});

  return (
    <div>
      {/* Filter / view header */}
      <div className={CARD} style={BG}>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <p className="text-xs text-gray-500 mb-1">Cơ sở</p>
            <select className={INPUT + " w-48"} value={facilityId} onChange={e => setFacilityId(e.target.value)}>
              <option value="">-- Chọn cơ sở --</option>
              {facilities.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Xem từ ngày</p>
            <input type="date" className={INPUT + " w-40"} value={viewStart} onChange={e => setViewStart(e.target.value)} />
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Đến ngày</p>
            <input type="date" className={INPUT + " w-40"} value={viewEnd} onChange={e => setViewEnd(e.target.value)} />
          </div>
          <button onClick={load} className={BTN_G}>Xem</button>
          {facilityId && (
            <button onClick={() => setShowForm(!showForm)} className={BTN_W}>
              {showForm ? "Đóng" : "+ Tạo lịch ca"}
            </button>
          )}
        </div>
      </div>

      {/* Create shifts form */}
      {showForm && (
        <div className={CARD} style={BG}>
          <h3 className="font-semibold text-black mb-4">Tạo lịch ca theo khoảng ngày</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {/* Tên ca */}
            <div>
              <p className="text-xs text-gray-500 mb-1">Tên ca *</p>
              <input className={INPUT} placeholder="Ca sáng / Ca chiều / Ca tối..." value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            {/* Số NV tối đa */}
            <div>
              <p className="text-xs text-gray-500 mb-1">Số nhân viên tối đa</p>
              <input type="number" min="1" className={INPUT} value={form.maxStaff}
                onChange={e => setForm(f => ({ ...f, maxStaff: e.target.value }))} />
            </div>
            {/* Áp dụng từ ngày */}
            <div>
              <p className="text-xs text-gray-500 mb-1">Áp dụng từ ngày *</p>
              <input type="date" className={INPUT} value={form.fromDate}
                onChange={e => setForm(f => ({ ...f, fromDate: e.target.value }))} />
            </div>
            {/* Đến ngày */}
            <div>
              <p className="text-xs text-gray-500 mb-1">Đến ngày *</p>
              <input type="date" className={INPUT} value={form.toDate}
                onChange={e => setForm(f => ({ ...f, toDate: e.target.value }))} />
            </div>
            {/* Giờ bắt đầu */}
            <div>
              <p className="text-xs text-gray-500 mb-1">Giờ bắt đầu ca *</p>
              <input type="time" className={INPUT} value={form.startTime}
                onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} />
            </div>
            {/* Giờ kết thúc */}
            <div>
              <p className="text-xs text-gray-500 mb-1">Giờ kết thúc ca *</p>
              <input type="time" className={INPUT} value={form.endTime}
                onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} />
            </div>
          </div>

          {/* Chọn ngày trong tuần */}
          <div className="mt-3">
            <p className="text-xs text-gray-500 mb-2">Áp dụng vào các ngày trong tuần *</p>
            <div className="flex gap-2 flex-wrap">
              {DOW_LABELS.map((label, idx) => (
                <button key={idx} type="button" onClick={() => toggleDow(idx)}
                  className={`w-10 h-10 rounded-xl text-sm font-semibold border transition-colors ${
                    form.daysOfWeek.includes(idx)
                      ? "bg-emerald-500 text-white border-emerald-500"
                      : "bg-white text-gray-600 border-gray-300 hover:border-emerald-300"
                  }`}>
                  {label}
                </button>
              ))}
              <button type="button" onClick={() => setForm(f => ({ ...f, daysOfWeek: [1,2,3,4,5] }))}
                className="px-3 h-10 rounded-xl text-xs border border-gray-300 bg-white text-gray-600 hover:border-emerald-300 transition-colors">
                T2–T6
              </button>
              <button type="button" onClick={() => setForm(f => ({ ...f, daysOfWeek: [0,1,2,3,4,5,6] }))}
                className="px-3 h-10 rounded-xl text-xs border border-gray-300 bg-white text-gray-600 hover:border-emerald-300 transition-colors">
                Tất cả
              </button>
              <button type="button" onClick={() => setForm(f => ({ ...f, daysOfWeek: [0, 6] }))}
                className="px-3 h-10 rounded-xl text-xs border border-gray-300 bg-white text-gray-600 hover:border-emerald-300 transition-colors">
                Cuối tuần
              </button>
            </div>
          </div>

          {/* Ghi chú */}
          <div className="mt-3">
            <p className="text-xs text-gray-500 mb-1">Ghi chú</p>
            <input className={INPUT} placeholder="Ghi chú (tùy chọn)" value={form.note}
              onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
          </div>

          {/* Preview */}
          {form.fromDate && form.toDate && form.daysOfWeek.length > 0 && (
            <div className="mt-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5 text-sm text-emerald-700">
              Sẽ tạo <strong>{previewCount()} ca làm</strong> "{form.name}" từ{" "}
              {new Date(form.fromDate).toLocaleDateString("vi-VN")} đến{" "}
              {new Date(form.toDate).toLocaleDateString("vi-VN")},
              vào các ngày: {form.daysOfWeek.sort().map(d => DOW_LABELS[d]).join(", ")}
            </div>
          )}

          <div className="flex gap-2 mt-4 justify-end">
            <button onClick={() => setShowForm(false)} className={BTN_W}>Hủy</button>
            <button onClick={createShifts} disabled={saving || previewCount() === 0} className={BTN_G}>
              {saving ? "Đang tạo..." : `Tạo ${previewCount()} ca`}
            </button>
          </div>
        </div>
      )}

      {/* Shift list — grouped by name */}
      {loaded && shifts.length === 0 && (
        <div className={CARD + " text-center text-gray-400"} style={BG}>Chưa có ca làm trong khoảng thời gian này</div>
      )}

      {loaded && Object.entries(shiftGroups).map(([groupName, groupShifts]) => {
        const totalPending = groupShifts.reduce((s, sh) => s + sh.registrations.filter(r => r.status === "PENDING").length, 0);
        return (
          <div key={groupName} className={CARD} style={BG}>
            {/* Group header */}
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="font-bold text-black text-base">{groupName}</p>
                <p className="text-xs text-gray-500">
                  {groupShifts.length} ngày ·{" "}
                  {new Date(groupShifts[0].startTime).toISOString().substring(11,16)} – {new Date(groupShifts[0].endTime).toISOString().substring(11,16)}
                  {totalPending > 0 && <span className="ml-2 text-yellow-600 font-medium">{totalPending} chờ duyệt</span>}
                </p>
              </div>
              <button onClick={() => deleteBulkShifts(groupName)}
                className="text-xs text-red-400 hover:text-red-600 border border-red-200 hover:border-red-400 px-3 py-1.5 rounded-lg transition-colors">
                Xóa cả nhóm
              </button>
            </div>

            {/* Days in group */}
            <div className="space-y-1.5">
              {groupShifts.map(shift => {
                const approvedCount = shift.registrations.filter(r => r.status === "APPROVED").length;
                const pendingCount = shift.registrations.filter(r => r.status === "PENDING").length;
                const isExpanded = expandedShift === shift.id;
                return (
                  <div key={shift.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2.5 cursor-pointer"
                      onClick={() => setExpandedShift(isExpanded ? null : shift.id)}>
                      <div className="flex items-center gap-3">
                        <div>
                          <p className="text-sm font-medium text-gray-800">
                            {new Date(shift.shiftDate).toLocaleDateString("vi-VN", { weekday: "short", day: "2-digit", month: "2-digit" })}
                          </p>
                          <div className="flex gap-1.5 mt-0.5">
                            <span className={`text-xs px-1.5 py-0.5 rounded ${shift.status === "OPEN" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                              {shift.status === "OPEN" ? "Mở" : "Đóng"}
                            </span>
                            {pendingCount > 0 && (
                              <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">{pendingCount} chờ</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-sm font-bold ${approvedCount >= shift.maxStaff ? "text-emerald-600" : "text-gray-500"}`}>
                          {approvedCount}/{shift.maxStaff} NV
                        </span>
                        <span className="text-gray-400 text-xs">{isExpanded ? "▲" : "▼"}</span>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">
                        <div className="flex gap-2 mb-3 flex-wrap">
                          {shift.status === "OPEN" && (
                            <button onClick={() => closeShift(shift.id)}
                              className="bg-gray-500 hover:bg-gray-400 text-white px-3 py-1 rounded-lg text-xs">Đóng đăng ký</button>
                          )}
                          <button onClick={() => deleteShift(shift.id)} className={BTN_R}>Xóa ngày này</button>
                        </div>

                        {/* Registrations */}
                        <p className="text-xs font-semibold text-gray-600 mb-1.5">Nhân viên đăng ký:</p>
                        {shift.registrations.length === 0 ? (
                          <p className="text-xs text-gray-400 mb-3">Chưa có ai đăng ký</p>
                        ) : (
                          <div className="space-y-1 mb-3">
                            {shift.registrations.map(reg => (
                              <div key={reg.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-1.5 border border-gray-200">
                                <p className="text-xs font-medium">{reg.staff.fullName}</p>
                                <div className="flex items-center gap-1.5">
                                  <span className={`text-xs px-2 py-0.5 rounded-full ${REG_STATUS[reg.status]?.color}`}>
                                    {REG_STATUS[reg.status]?.label}
                                  </span>
                                  {reg.status === "PENDING" && (
                                    <>
                                      <button onClick={() => approveReg(shift.id, reg.id, "approve")}
                                        className="bg-emerald-500 text-white px-2 py-0.5 rounded text-xs">✓</button>
                                      <button onClick={() => approveReg(shift.id, reg.id, "reject")}
                                        className="bg-red-500 text-white px-2 py-0.5 rounded text-xs">✕</button>
                                    </>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Direct assign */}
                        <p className="text-xs font-semibold text-gray-600 mb-1.5">Giao ca trực tiếp:</p>
                        <div className="flex gap-1.5 flex-wrap">
                          {facilityStaff
                            .filter(s => !shift.registrations.some(r => r.staffId === s.userId && r.status === "APPROVED"))
                            .map(s => (
                              <button key={s.userId} onClick={() => assignStaff(shift.id, s.userId)}
                                className="bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-lg text-xs transition-colors">
                                + {s.fullName}
                              </button>
                            ))
                          }
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Bar Chart ───────────────────────────────────────────────────────────────
function BarChart({ items, labelKey, valueKey, color = "#10b981" }: {
  items: any[];
  labelKey: string;
  valueKey: string;
  color?: string;
}) {
  const max = Math.max(...items.map(i => i[valueKey]), 1);
  return (
    <div className="w-full overflow-x-auto">
      <div className="flex items-end gap-1.5 min-w-0" style={{ minHeight: 140 }}>
        {items.map((item, idx) => {
          const pct = Math.round((item[valueKey] / max) * 100);
          const barColor = item.highlight ? "#f59e0b" : color;
          return (
            <div key={idx} className="flex flex-col items-center flex-1 min-w-[28px]">
              <span className="text-xs font-semibold mb-1" style={{ color: barColor }}>
                {item[valueKey]}
              </span>
              <div className="w-full rounded-t-md transition-all" style={{
                height: `${Math.max(pct, 2)}px`,
                background: barColor,
                minHeight: 4,
                maxHeight: 100,
                opacity: pct === 0 ? 0.2 : 1,
              }} />
              <span className="text-xs text-gray-500 mt-1 truncate w-full text-center" style={{ fontSize: 10 }}>
                {item[labelKey]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Line Chart ───────────────────────────────────────────────────────────────
function LineChart({ items, labelKey, valueKey, color = "#10b981", formatValue }: {
  items: any[]; labelKey: string; valueKey: string; color?: string; formatValue?: (v: number) => string;
}) {
  if (items.length < 2) return <div className="text-center text-gray-400 py-6 text-sm">Không đủ dữ liệu</div>;
  const W = 600, H = 150, PX = 36, PY = 28;
  const values = items.map(i => Number(i[valueKey]));
  const max = Math.max(...values, 1), min = Math.min(...values, 0), range = max - min || 1;
  const pts = items.map((item, idx) => ({
    x: PX + (idx / (items.length - 1)) * (W - PX * 2),
    y: PY + (1 - (Number(item[valueKey]) - min) / range) * (H - PY * 2),
    item,
  }));
  const fmtV = formatValue || ((v: number) => v >= 1000000 ? (v / 1000000).toFixed(1) + "M" : v >= 1000 ? (v / 1000).toFixed(0) + "K" : String(v));
  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 300, height: H }}>
        {[0, 0.5, 1].map((t, i) => <line key={i} x1={PX} y1={PY + t * (H - PY * 2)} x2={W - PX} y2={PY + t * (H - PY * 2)} stroke="#e5e7eb" strokeWidth="1" />)}
        <path d={`M${pts[0].x},${H - PY} ` + pts.map(p => `L${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ") + ` L${pts[pts.length - 1].x},${H - PY} Z`} fill={color} opacity={0.08} />
        <polyline points={pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {pts.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={4} fill="white" stroke={color} strokeWidth="2" />
            <text x={p.x} y={H - 5} textAnchor="middle" fontSize={9} fill="#9ca3af">{p.item[labelKey]}</text>
            <text x={p.x} y={p.y - 8} textAnchor="middle" fontSize={9} fill={color} fontWeight="600">{fmtV(Number(p.item[valueKey]))}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

// ─── Invoices Tab ────────────────────────────────────────────────────────────
function InvoicesTab({ facilities }: { facilities: Facility[] }) {
  const now = new Date();
  const [facilityId, setFacilityId] = useState<string>("");
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [exporting, setExporting] = useState(false);

  const PM_LABEL: Record<string, string> = { CASH: "Tiền mặt", TRANSFER: "Chuyển khoản", QR: "VNPay", WALLET: "Ví SportHub" };

  async function load() {
    if (!facilityId) return;
    const invRes = await fetch(`/api/owner/invoices?facilityId=${facilityId}&month=${month}&year=${year}`);
    const invData = await invRes.json();
    setInvoices(Array.isArray(invData) ? invData : []);
    setLoaded(true);
  }

  const total = invoices.reduce((s, i) => s + Number(i.finalTotal), 0);

  function exportToExcel() {
    if (!facilityId) return;
    setExporting(true);

    const cell = (v: string | number, type: "String" | "Number" = "String") =>
      `<Cell><Data ss:Type="${type}">${String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;")}</Data></Cell>`;
    const xmlRow = (...cells: string[]) => `<Row>${cells.join("")}</Row>`;

    // Sort invoices by date ascending
    const sorted = [...invoices].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    const itemRows: string[] = [];
    for (const inv of sorted) {
      const dt = new Date(inv.createdAt);
      const dateStr = `${dt.getDate().toString().padStart(2,"0")}/${(dt.getMonth()+1).toString().padStart(2,"0")}/${dt.getFullYear()} ${dt.getHours().toString().padStart(2,"0")}:${dt.getMinutes().toString().padStart(2,"0")}`;
      for (const item of inv.items) {
        itemRows.push(xmlRow(
          cell(dateStr),
          cell(inv.staffName),
          cell(item.name),
          cell(item.quantity, "Number"),
          cell(Number(item.price), "Number"),
          cell(Number(item.price) * item.quantity, "Number"),
        ));
      }
    }

    const sheet = `<Worksheet ss:Name="Hóa đơn T${month}-${year}"><Table>
      ${xmlRow(cell("Ngày giờ"), cell("Nhân viên"), cell("Dịch vụ"), cell("Số lượng"), cell("Đơn giá (đ)"), cell("Thành tiền (đ)"))}
      ${itemRows.join("\n") || xmlRow(cell("Không có dữ liệu"))}
    </Table></Worksheet>`;

    const xml = `<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">${sheet}</Workbook>`;
    const blob = new Blob([xml], { type: "application/vnd.ms-excel" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `hoa-don-T${month}-${year}.xls`; a.click();
    URL.revokeObjectURL(url);
    setExporting(false);
  }

  return (
    <div>
      <div className={CARD} style={BG}>
        <div className="flex flex-wrap gap-3 items-end">
          <div><p className="text-xs text-gray-500 mb-1">Cơ sở</p>
            <select className={INPUT + " w-48"} value={facilityId} onChange={e => setFacilityId(e.target.value)}>
              <option value="">-- Chọn cơ sở --</option>
              {facilities.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>
          <div><p className="text-xs text-gray-500 mb-1">Tháng</p>
            <select className={INPUT + " w-28"} value={month} onChange={e => setMonth(Number(e.target.value))}>
              {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>T{i + 1}</option>)}
            </select>
          </div>
          <div><p className="text-xs text-gray-500 mb-1">Năm</p>
            <select className={INPUT + " w-24"} value={year} onChange={e => setYear(Number(e.target.value))}>
              {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <button onClick={load} className={BTN_G}>Xem</button>
          {loaded && facilityId && (
            <button onClick={exportToExcel} disabled={exporting} className={BTN_W + " flex items-center gap-1.5"}>
              {exporting ? "..." : "⬇ Xuất Excel"}
            </button>
          )}
        </div>
      </div>

      {loaded && (
        <>
          {/* Invoice list */}
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-gray-600">{invoices.length} hóa đơn</p>
            <p className="font-bold text-emerald-600">Tổng: {total.toLocaleString("vi-VN")}đ</p>
          </div>
          <div className="space-y-2 mb-6">
            {invoices.length === 0 ? <p className="text-center py-10 text-gray-400">Không có hóa đơn</p> : invoices.map(inv => (
              <div key={inv.id} className={CARD + " cursor-pointer"} style={BG} onClick={() => setExpanded(expanded === inv.id ? null : inv.id)}>
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold text-black">#{inv.id} · {inv.courtName}</p>
                    <p className="text-xs text-gray-500">{inv.customerName} · NV: {inv.staffName}</p>
                    <p className="text-xs text-gray-400">{new Date(inv.createdAt).toLocaleString("vi-VN")}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-emerald-600">{Number(inv.finalTotal).toLocaleString("vi-VN")}đ</p>
                    <span className="text-xs bg-white border border-gray-200 rounded-full px-2 py-0.5">{PM_LABEL[inv.paymentMethod] || inv.paymentMethod}</span>
                  </div>
                </div>
                {expanded === inv.id && (
                  <div className="mt-3 border-t border-gray-200 pt-3">
                    <table className="w-full text-xs">
                      <thead><tr className="text-gray-500"><th className="text-left py-1">Dịch vụ</th><th className="text-right py-1">SL</th><th className="text-right py-1">Giá</th></tr></thead>
                      <tbody>
                        {inv.items.map((it, i) => (
                          <tr key={i} className="border-t border-gray-100">
                            <td className="py-1">{it.name}</td>
                            <td className="py-1 text-right">{it.quantity}</td>
                            <td className="py-1 text-right font-medium">{Number(it.price).toLocaleString("vi-VN")}đ</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>

        </>
      )}
    </div>
  );
}

// ─── Revenue Tab ─────────────────────────────────────────────────────────────
interface RevData {
  byDay:     { date: string; total: number }[];
  byMonth:   { month: string; total: number }[];
  byCourt:   { name: string; total: number }[];
  byService: { name: string; total: number; quantity: number }[];
  slowSelling: { id: number; name: string; stockQuantity: number; soldLast7Days: number }[];
}

function RevLineChart({ data, labelFn }: { data: { label: string; value: number }[]; labelFn?: (v: number) => string }) {
  const [hovered, setHovered] = useState<number | null>(null);

  if (data.length === 0)
    return <div className="h-48 flex items-center justify-center text-gray-400 text-sm">Chưa có dữ liệu</div>;

  const max  = Math.max(...data.map(d => d.value), 1);
  const fmt  = labelFn ?? ((v: number) => v >= 1_000_000 ? (v / 1_000_000).toFixed(1) + "M" : (v / 1_000).toFixed(0) + "K");

  // SVG canvas
  const W = 520; const H = 170;
  const PAD = { top: 22, right: 12, bottom: 30, left: 48 };
  const cW = W - PAD.left - PAD.right;
  const cH = H - PAD.top  - PAD.bottom;
  const n  = data.length;

  const px = (i: number) => PAD.left + (n > 1 ? (i / (n - 1)) * cW : cW / 2);
  const py = (v: number) => PAD.top  + cH - (v / max) * cH;

  const linePath = data.map((d, i) => `${i === 0 ? "M" : "L"}${px(i).toFixed(1)},${py(d.value).toFixed(1)}`).join(" ");
  const areaPath = [
    ...data.map((d, i) => `${i === 0 ? "M" : "L"}${px(i).toFixed(1)},${py(d.value).toFixed(1)}`),
    `L${px(n - 1).toFixed(1)},${(PAD.top + cH).toFixed(1)}`,
    `L${px(0).toFixed(1)},${(PAD.top + cH).toFixed(1)}`,
    "Z",
  ].join(" ");

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(r => ({ v: r * max, y: PAD.top + cH - r * cH }));
  const xStep  = n > 24 ? 5 : n > 16 ? 4 : n > 10 ? 3 : n > 6 ? 2 : 1;

  return (
    <div className="w-full select-none">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 190 }} aria-hidden>
        <defs>
          <linearGradient id="lgRev" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#10b981" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0.01" />
          </linearGradient>
          <clipPath id="cpRev">
            <rect x={PAD.left} y={PAD.top} width={cW} height={cH} />
          </clipPath>
        </defs>

        {/* Y-axis grid + labels */}
        {yTicks.map((tk, i) => (
          <g key={i}>
            <line x1={PAD.left} y1={tk.y} x2={W - PAD.right} y2={tk.y}
              stroke="#e5e7eb" strokeWidth={i === 0 ? 1 : 0.7}
              strokeDasharray={i === 0 ? "" : "4 3"} />
            {i > 0 && (
              <text x={PAD.left - 5} y={tk.y + 3.5} textAnchor="end" fontSize={9} fill="#9ca3af">
                {fmt(tk.v)}
              </text>
            )}
          </g>
        ))}

        {/* Area fill */}
        <path d={areaPath} fill="url(#lgRev)" clipPath="url(#cpRev)" />

        {/* Line */}
        <path d={linePath} fill="none" stroke="#10b981" strokeWidth={2}
          strokeLinejoin="round" strokeLinecap="round" clipPath="url(#cpRev)" />

        {/* Hover vertical guide */}
        {hovered !== null && (
          <line x1={px(hovered)} y1={PAD.top} x2={px(hovered)} y2={PAD.top + cH}
            stroke="#10b981" strokeWidth={1} strokeDasharray="4 3" opacity={0.4} />
        )}

        {/* Dots */}
        {data.map((d, i) => {
          const cx = px(i); const cy = py(d.value);
          const active = hovered === i;
          return (
            <g key={i}>
              {active && <circle cx={cx} cy={cy} r={10} fill="#10b981" opacity={0.1} />}
              <circle cx={cx} cy={cy} r={active ? 5 : 3}
                fill={d.value > 0 ? "#10b981" : "#d1fae5"}
                stroke="white" strokeWidth={1.5}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
                style={{ cursor: "crosshair" }}
              />
              {/* Tooltip */}
              {active && d.value > 0 && (() => {
                const ttW = 64; const ttH = 20;
                const ttX = Math.min(Math.max(cx - ttW / 2, PAD.left), W - PAD.right - ttW);
                const ttY = cy - ttH - 8;
                return (
                  <g>
                    <rect x={ttX} y={ttY} width={ttW} height={ttH} rx={5} fill="#064e3b" opacity={0.92} />
                    <text x={ttX + ttW / 2} y={ttY + 13} textAnchor="middle" fontSize={9.5} fill="white" fontWeight="bold">
                      {fmt(d.value)}
                    </text>
                  </g>
                );
              })()}
            </g>
          );
        })}

        {/* X-axis labels */}
        {data.map((d, i) =>
          i % xStep === 0 ? (
            <text key={i} x={px(i)} y={H - 5} textAnchor="middle" fontSize={9} fill="#9ca3af">
              {d.label}
            </text>
          ) : null
        )}
      </svg>
    </div>
  );
}

function HBarList({ data, total }: { data: { name: string; total: number }[]; total: number }) {
  if (data.length === 0) return <p className="text-center py-6 text-gray-400 text-sm">Chưa có dữ liệu</p>;
  return (
    <div className="space-y-2">
      {data.map((d, i) => {
        const pct = total > 0 ? (d.total / total) * 100 : 0;
        return (
          <div key={i}>
            <div className="flex justify-between text-xs mb-0.5">
              <span className="text-gray-700 font-medium truncate max-w-[60%]">{d.name}</span>
              <span className="text-emerald-600 font-semibold">{Number(d.total).toLocaleString("vi-VN")}đ</span>
            </div>
            <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
              <div className="h-full rounded-full bg-emerald-400" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RevenueTab({ facilities }: { facilities: Facility[] }) {
  const [facilityId, setFacilityId] = useState("");
  const now = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [timeMode,  setTimeMode]  = useState<"day" | "month">("day");
  const [groupMode, setGroupMode] = useState<"court" | "service">("court");
  const [data, setData] = useState<RevData | null>(null);
  const [loading, setLoading] = useState(false);
  const [occupancy, setOccupancy] = useState<any>(null);
  const [monthlyStats, setMonthlyStats] = useState<any[]>([]);
  const [chartView, setChartView] = useState<"day" | "hour" | "court" | "sport" | "month">("day");

  async function load(fid: string) {
    if (!fid) return;
    setLoading(true);
    const [revRes, occRes, mRes] = await Promise.all([
      fetch(`/api/owner/revenue?facilityId=${fid}&year=${year}&month=${month}`),
      fetch(`/api/owner/occupancy?facilityId=${fid}&month=${month}&year=${year}`),
      fetch(`/api/owner/occupancy?facilityId=${fid}&year=${year}&period=year`),
    ]);
    if (revRes.ok) setData(await revRes.json());
    const occData = await occRes.json();
    const mData = await mRes.json();
    setOccupancy(occData.dailyStats ? occData : null);
    setMonthlyStats(mData.monthlyStats || []);
    setLoading(false);
  }

  const CHART_VIEWS = [
    { key: "day",   label: "Ngày" },
    { key: "hour",  label: "Giờ" },
    { key: "court", label: "Sân" },
    { key: "sport", label: "Môn" },
    { key: "month", label: "Tháng" },
  ] as const;

  function getChartItems() {
    if (!occupancy && chartView !== "month") return [];
    switch (chartView) {
      case "day":   return (occupancy?.dailyStats || []).map((d: any) => ({ label: `${d.day}`, value: d.count }));
      case "hour":  return (occupancy?.hourlyStats || []).map((h: any) => ({ label: h.hour.replace(":00", "h"), value: h.count, highlight: parseInt(h.hour) >= 7 && parseInt(h.hour) < 9 }));
      case "court": return (occupancy?.courtStats || []).map((c: any) => ({ label: c.courtName, value: c.count }));
      case "sport": return (occupancy?.sportStats || []).map((s: any) => ({ label: s.name, value: s.count }));
      case "month": return monthlyStats.map((m: any) => ({ label: `T${m.month}`, value: m.count }));
    }
  }

  function getUserHabitsInsights() {
    if (!occupancy) return null;
    const hourly = (occupancy.hourlyStats || []) as any[];
    const courts = (occupancy.courtStats || []) as any[];
    const sports = (occupancy.sportStats || []) as any[];
    const peakHour = hourly.reduce((b: any, h: any) => (!b || h.count > b.count) ? h : b, null);
    const slowHour = hourly.filter((h: any) => h.count > 0).reduce((b: any, h: any) => (!b || h.count < b.count) ? h : b, null);
    const topCourt = courts.reduce((b: any, c: any) => (!b || c.count > b.count) ? c : b, null);
    const topSport = sports.reduce((b: any, s: any) => (!b || s.count > b.count) ? s : b, null);
    const lowCourt = courts.reduce((b: any, c: any) => (!b || c.count < b.count) ? c : b, null);
    return { peakHour, slowHour, topCourt, topSport, lowCourt };
  }

  useEffect(() => { if (facilityId) load(facilityId); }, [facilityId, year, month]);

  const dayChartData = data?.byDay.map(d => ({
    label: String(Number(d.date.split("-")[2])),
    value: d.total,
  })) ?? [];

  const monthChartData = data?.byMonth.map(d => ({
    label: `T${Number(d.month.split("-")[1])}`,
    value: d.total,
  })) ?? [];

  const totalMonth  = data?.byDay.reduce((s, d) => s + d.total, 0) ?? 0;
  const totalYear   = data?.byMonth.reduce((s, d) => s + d.total, 0) ?? 0;
  const totalCourt  = data?.byCourt.reduce((s, d) => s + d.total, 0) ?? 0;
  const totalSvc    = data?.byService.reduce((s, d) => s + d.total, 0) ?? 0;

  const MONTHS = ["1","2","3","4","5","6","7","8","9","10","11","12"];
  const YEARS  = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];

  return (
    <div>
      {/* Bộ lọc */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <select className={INPUT + " w-52"} value={facilityId}
          onChange={e => { setFacilityId(e.target.value); }}>
          <option value="">-- Chọn cơ sở --</option>
          {facilities.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
        <select className={INPUT + " w-24"} value={month} onChange={e => setMonth(Number(e.target.value))}>
          {MONTHS.map(m => <option key={m} value={m}>Tháng {m}</option>)}
        </select>
        <select className={INPUT + " w-24"} value={year} onChange={e => setYear(Number(e.target.value))}>
          {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {!facilityId && (
        <p className="text-center py-12 text-gray-400 text-sm">Chọn cơ sở để xem doanh thu</p>
      )}

      {facilityId && loading && (
        <p className="text-center py-12 text-gray-400 text-sm">Đang tải...</p>
      )}

      {facilityId && !loading && data && (
        <div className="space-y-4">
          {/* Tổng quan */}
          <div className="grid grid-cols-2 gap-3">
            <div className={CARD + " !mb-0 text-center"} style={BG}>
              <p className="text-xs text-gray-500">Tháng {month}/{year}</p>
              <p className="text-xl font-bold text-emerald-600 mt-1">{totalMonth.toLocaleString("vi-VN")}đ</p>
            </div>
            <div className={CARD + " !mb-0 text-center"} style={BG}>
              <p className="text-xs text-gray-500">Cả năm {year}</p>
              <p className="text-xl font-bold text-emerald-600 mt-1">{totalYear.toLocaleString("vi-VN")}đ</p>
            </div>
          </div>

          {/* Biểu đồ theo thời gian */}
          <div className={CARD + " !mb-0"} style={BG}>
            <div className="flex items-center justify-between mb-3">
              <p className="font-semibold text-black text-sm">
                {timeMode === "day" ? `Theo ngày — Tháng ${month}/${year}` : `Theo tháng — Năm ${year}`}
              </p>
              <div className="flex gap-1">
                <button onClick={() => setTimeMode("day")}
                  className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${timeMode === "day" ? "bg-emerald-500 text-white" : "bg-white border border-gray-300 text-gray-600"}`}>
                  Theo ngày
                </button>
                <button onClick={() => setTimeMode("month")}
                  className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${timeMode === "month" ? "bg-emerald-500 text-white" : "bg-white border border-gray-300 text-gray-600"}`}>
                  Theo tháng
                </button>
              </div>
            </div>
            <RevLineChart data={timeMode === "day" ? dayChartData : monthChartData} />
          </div>

          {/* Phân tích theo sân / dịch vụ */}
          <div className={CARD + " !mb-0"} style={BG}>
            <div className="flex items-center justify-between mb-3">
              <p className="font-semibold text-black text-sm">
                {groupMode === "court" ? "Doanh thu theo sân" : "Doanh thu theo dịch vụ"}
              </p>
              <div className="flex gap-1">
                <button onClick={() => setGroupMode("court")}
                  className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${groupMode === "court" ? "bg-emerald-500 text-white" : "bg-white border border-gray-300 text-gray-600"}`}>
                  Theo sân
                </button>
                <button onClick={() => setGroupMode("service")}
                  className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${groupMode === "service" ? "bg-emerald-500 text-white" : "bg-white border border-gray-300 text-gray-600"}`}>
                  Theo dịch vụ
                </button>
              </div>
            </div>
            {groupMode === "court"
              ? <HBarList data={data.byCourt} total={totalCourt} />
              : (
                <div className="space-y-2">
                  {data.byService.length === 0
                    ? <p className="text-center py-6 text-gray-400 text-sm">Chưa có dữ liệu</p>
                    : data.byService.map((d, i) => {
                        const pct = totalSvc > 0 ? (d.total / totalSvc) * 100 : 0;
                        return (
                          <div key={i}>
                            <div className="flex justify-between text-xs mb-0.5">
                              <span className="text-gray-700 font-medium truncate max-w-[55%]">{d.name}</span>
                              <div className="flex items-center gap-3">
                                <span className="text-gray-400">x{d.quantity} sp</span>
                                <span className="text-emerald-600 font-semibold">{Number(d.total).toLocaleString("vi-VN")}đ</span>
                              </div>
                            </div>
                            <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
                              <div className="h-full rounded-full bg-emerald-400" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })
                  }
                </div>
              )
            }
          </div>

          {/* Tỉ lệ lấp đầy */}
          {occupancy && (
            <div className={CARD + " !mb-0"} style={BG}>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <h3 className="font-semibold text-black">Tỉ lệ lấp đầy</h3>
                <div className="flex gap-1 flex-wrap">
                  {CHART_VIEWS.map(v => (
                    <button key={v.key} onClick={() => setChartView(v.key)}
                      className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors border ${chartView === v.key ? "bg-emerald-500 text-white border-emerald-500" : "bg-white text-gray-600 border-gray-300 hover:border-emerald-300"}`}>
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>
              {occupancy && chartView !== "month" && (
                <div className="flex gap-3 mb-4 flex-wrap">
                  <div className="bg-white rounded-xl px-4 py-2 border border-gray-200 text-center">
                    <p className="text-xs text-gray-500">Tổng lượt đặt</p>
                    <p className="font-bold text-emerald-600 text-lg">{(occupancy.dailyStats || []).reduce((s: number, d: any) => s + d.count, 0)}</p>
                  </div>
                  <div className="bg-white rounded-xl px-4 py-2 border border-gray-200 text-center">
                    <p className="text-xs text-gray-500">Ngày cao nhất</p>
                    <p className="font-bold text-blue-600 text-lg">{Math.max(...(occupancy.dailyStats || [{ count: 0 }]).map((d: any) => d.count))} lượt</p>
                  </div>
                  <div className="bg-white rounded-xl px-4 py-2 border border-gray-200 text-center">
                    <p className="text-xs text-gray-500">Lấp đầy TB/ngày</p>
                    <p className="font-bold text-orange-600 text-lg">
                      {(() => { const days = occupancy.dailyStats || []; return days.length ? Math.round(days.reduce((s: number, d: any) => s + d.rate, 0) / days.length) + "%" : "0%"; })()}
                    </p>
                  </div>
                </div>
              )}
              <BarChart items={getChartItems()} labelKey="label" valueKey="value" color="#10b981" />
              {chartView === "hour" && <p className="text-xs text-gray-400 mt-2">Màu vàng = khung giờ cao điểm (7h–9h)</p>}
              {chartView === "month" && <p className="text-xs text-gray-400 mt-2">Tổng lượt đặt theo từng tháng — năm {year}</p>}
            </div>
          )}

          {/* Thói quen người dùng & Gợi ý kinh doanh */}
          {(() => {
            const h = getUserHabitsInsights();
            if (!h) return null;
            const insights: { icon: string; text: string; tip: string; color: string }[] = [];
            if (h.peakHour) insights.push({ icon: "🔥", text: `Khung giờ đông nhất: ${h.peakHour.hour}`, tip: "Tăng giá khung giờ cao điểm hoặc chạy ưu đãi combo để tối ưu doanh thu", color: "border-orange-200 bg-orange-50" });
            if (h.slowHour && h.slowHour.hour !== h.peakHour?.hour) insights.push({ icon: "📉", text: `Khung giờ vắng nhất: ${h.slowHour.hour}`, tip: "Tung voucher giảm giá cho khung giờ thấp điểm để tăng tỉ lệ lấp đầy", color: "border-blue-200 bg-blue-50" });
            if (h.topSport) insights.push({ icon: "🏆", text: `Môn thể thao phổ biến nhất: ${h.topSport.name}`, tip: "Nhập thêm thiết bị/phụ kiện cho môn này, tạo giải đấu để thu hút thêm khách", color: "border-emerald-200 bg-emerald-50" });
            if (h.topCourt) insights.push({ icon: "🎯", text: `Sân được đặt nhiều nhất: ${h.topCourt.courtName}`, tip: "Bảo trì định kỳ và nâng cấp dịch vụ tại sân này để duy trì chất lượng", color: "border-purple-200 bg-purple-50" });
            if (h.lowCourt && h.lowCourt.courtName !== h.topCourt?.courtName) insights.push({ icon: "💡", text: `Sân ít được đặt nhất: ${h.lowCourt.courtName}`, tip: "Tạo ưu đãi đặc biệt hoặc gói combo cho sân này để cân bằng tỉ lệ sử dụng", color: "border-yellow-200 bg-yellow-50" });
            if (insights.length === 0) return null;
            return (
              <div className={CARD + " !mb-0"} style={BG}>
                <h3 className="font-semibold text-black mb-3">Thói quen người dùng &amp; Gợi ý kinh doanh</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {insights.map((ins, i) => (
                    <div key={i} className={`rounded-xl border p-3.5 ${ins.color}`}>
                      <p className="font-semibold text-sm text-gray-800">{ins.icon} {ins.text}</p>
                      <p className="text-xs text-gray-500 mt-1">💬 {ins.tip}</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Cảnh báo hàng bán chậm */}
          {data.slowSelling.length > 0 && (
            <div className="border border-amber-300 bg-amber-50 rounded-2xl p-4">
              <p className="font-semibold text-amber-700 text-sm mb-2">
                Cảnh báo tồn kho — Hàng bán chậm (tháng {month}/{year})
              </p>
              <p className="text-xs text-amber-600 mb-3">
                Các mặt hàng bán chưa đạt ngưỡng trong tháng {month}/{year} — cân nhắc giảm nhập hoặc chạy khuyến mãi.
              </p>
              <div className="space-y-2">
                {data.slowSelling.map(item => {
                  const isOwnerSet = (item as any).monthlyThreshold > 0;
                  const displayThreshold = (item as any).threshold as number
                    ?? (isOwnerSet ? (item as any).monthlyThreshold : Math.max(Math.round(item.stockQuantity * 0.05), 3));
                  const ratio = item.stockQuantity > 0
                    ? Math.round((item.soldLast7Days / item.stockQuantity) * 100)
                    : 0;
                  return (
                    <div key={item.id} className="flex items-center justify-between bg-white/70 rounded-xl px-3 py-2">
                      <div>
                        <span className="text-sm font-medium text-gray-800">{item.name}</span>
                        <p className="text-xs text-gray-400 mt-0.5">
                          Tồn kho: {item.stockQuantity} · Ngưỡng:{" "}
                          <span className={isOwnerSet ? "text-emerald-600 font-medium" : ""}>{displayThreshold} sp/tháng{isOwnerSet ? " (bạn đặt)" : " (tự động)"}</span>
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-amber-600 font-semibold">
                          Đã bán: <span className="font-bold">{item.soldLast7Days}</span> / {displayThreshold} sp
                        </p>
                        <p className="text-xs text-gray-400">Tiêu thụ: {ratio}% tồn kho</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {data.slowSelling.length === 0 && (
            <div className="border border-emerald-200 bg-emerald-50 rounded-2xl px-4 py-3 text-xs text-emerald-700">
              Tất cả hàng hóa đang bán tốt trong tháng {month}/{year}.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Services Tab ────────────────────────────────────────────────────────────

/** Resize ảnh về tối đa maxDim px rồi convert sang WebP trước khi upload */
async function resizeImage(file: File, maxDim = 400): Promise<Blob> {
  return new Promise(resolve => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
      canvas.toBlob(blob => resolve(blob!), "image/webp", 0.85);
    };
    img.src = objectUrl;
  });
}

function ImageUpload({
  value, onChange, uploading, setUploading,
}: {
  value: string; onChange: (url: string) => void;
  uploading: boolean; setUploading: (v: boolean) => void;
}) {
  const [preview, setPreview] = useState(value);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // preview ngay lập tức
    setPreview(URL.createObjectURL(file));
    setUploading(true);
    try {
      const resized = await resizeImage(file, 400);
      const fd = new FormData();
      fd.append("file", new File([resized], file.name, { type: "image/webp" }));
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      if (res.ok) {
        const { url } = await res.json();
        setPreview(url);
        onChange(url);
      } else {
        const d = await res.json();
        alert(d.error || "Upload thất bại");
        setPreview(value);
      }
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  return (
    <div className="flex items-center gap-3">
      {/* Thumbnail preview */}
      <div className="w-14 h-14 rounded-xl border-2 border-dashed border-gray-300 bg-white flex items-center justify-center overflow-hidden shrink-0">
        {preview ? (
          <img src={preview} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="text-gray-400 text-xs text-center leading-tight px-1">Chưa có ảnh</span>
        )}
      </div>
      <div className="flex-1">
        <label className={`${uploading ? "opacity-50 pointer-events-none" : "cursor-pointer"} inline-flex items-center gap-1.5 text-xs bg-white border border-gray-300 hover:border-emerald-400 text-gray-600 px-3 py-2 rounded-xl transition-colors`}>
          {uploading ? "Đang tải..." : preview ? "Đổi ảnh" : "Tải ảnh lên"}
          <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFile} disabled={uploading} />
        </label>
        {preview && (
          <button type="button" onClick={() => { setPreview(""); onChange(""); }}
            className="text-xs text-red-400 hover:text-red-600 mt-0.5">Xóa ảnh</button>
        )}
      </div>
    </div>
  );
}

function ServicesTab({ facilities }: { facilities: Facility[] }) {
  const [facilityId, setFacilityId] = useState<string>("");
  const [services, setServices] = useState<Service[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [form, setForm] = useState({ name: "", type: "PRODUCT", price: "", stockQuantity: "", monthlyThreshold: "", imageUrl: "" });
  const [editForm, setEditForm] = useState<Partial<Omit<Service, "stockQuantity"|"monthlyThreshold"> & { stockQuantity: string; monthlyThreshold: string }>>({});
  const [loaded, setLoaded] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editUploading, setEditUploading] = useState(false);

  const loadServices = useCallback((fid: string) => {
    if (!fid) return;
    fetch(`/api/owner/services?facilityId=${fid}`).then(r => r.json()).then(d => { setServices(Array.isArray(d) ? d : []); setLoaded(true); });
  }, []);

  async function createService() {
    const res = await fetch("/api/owner/services", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, facilityId, price: Number(form.price) * 1000, monthlyThreshold: Number(form.monthlyThreshold || 0) }),
    });
    if (res.ok) {
      setShowForm(false);
      setForm({ name: "", type: "PRODUCT", price: "", stockQuantity: "", monthlyThreshold: "", imageUrl: "" });
      loadServices(facilityId);
    } else { const d = await res.json(); alert(d.error); }
  }

  async function updateService() {
    if (!editing) return;
    const res = await fetch(`/api/owner/services/${editing.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...editForm,
        ...(editForm.price !== undefined && { price: Number(editForm.price) * 1000 }),
      }),
    });
    if (res.ok) { setEditing(null); loadServices(facilityId); }
    else { const d = await res.json(); alert(d.error); }
  }

  async function deleteService(id: number) {
    if (!confirm("Ẩn dịch vụ này?")) return;
    await fetch(`/api/owner/services/${id}`, { method: "DELETE" });
    loadServices(facilityId);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <select className={INPUT + " w-56"} value={facilityId} onChange={e => { setFacilityId(e.target.value); loadServices(e.target.value); }}>
          <option value="">-- Chọn cơ sở --</option>
          {facilities.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
        {facilityId && <button onClick={() => setShowForm(!showForm)} className={BTN_G}>+ Thêm dịch vụ</button>}
      </div>

      {showForm && facilityId && (
        <div className={CARD} style={BG}>
          <h3 className="font-semibold text-black mb-3">Thêm dịch vụ mới</h3>
          <div className="grid grid-cols-2 gap-2.5 mb-3">
            <input className={INPUT} placeholder="Tên dịch vụ *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            <select className={INPUT} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
              <option value="PRODUCT">Sản phẩm (F&B)</option>
              <option value="RENTAL">Cho thuê</option>
            </select>
            <input className={INPUT} placeholder="Giá (nghìn đ) *" type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} />
            <input className={INPUT} placeholder="Tồn kho ban đầu" type="number" value={form.stockQuantity} onChange={e => setForm(f => ({ ...f, stockQuantity: e.target.value }))} />
            <input className={INPUT} placeholder="Ngưỡng tối thiểu/tháng (sp)" type="number" min={0} value={form.monthlyThreshold} onChange={e => setForm(f => ({ ...f, monthlyThreshold: e.target.value }))} />
            <p className="text-xs text-gray-400 self-center">Cảnh báo khi bán &lt; ngưỡng này trong tháng (để 0 = tự động)</p>
          </div>
          {/* Upload ảnh */}
          <div className="border border-gray-200 rounded-xl p-3 bg-white/50 mb-3">
            <p className="text-xs text-gray-500 font-medium mb-2">Hình ảnh hàng hóa</p>
            <ImageUpload
              value={form.imageUrl}
              onChange={url => setForm(f => ({ ...f, imageUrl: url }))}
              uploading={uploading}
              setUploading={setUploading}
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className={BTN_W}>Hủy</button>
            <button onClick={createService} disabled={uploading} className={BTN_G}>Thêm</button>
          </div>
        </div>
      )}

      {loaded && (
        <>
          {/* Stock alert summary */}
          {(() => {
            const products = services.filter(s => s.type === "PRODUCT");
            const outOfStock  = products.filter(s => s.stockQuantity === 0);
            // "Sắp hết": tồn kho <= ngưỡng chủ sân đặt (nếu có) hoặc <= 10
            const lowStockThreshold = (s: Service) => s.monthlyThreshold > 0 ? s.monthlyThreshold : 10;
            const lowStock = products.filter(s => s.stockQuantity > 0 && s.stockQuantity <= lowStockThreshold(s));
            // "Bán chậm": đã bán tháng này < ngưỡng chủ sân đặt (chỉ hiển thị nếu ngưỡng > 0)
            const slowSales = products.filter(s => s.monthlyThreshold > 0 && (s.soldThisMonth ?? 0) < s.monthlyThreshold && s.stockQuantity > 0);
            if (outOfStock.length === 0 && lowStock.length === 0 && slowSales.length === 0) return null;
            return (
              <div className="flex flex-col gap-2 mb-4">
                {outOfStock.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 flex items-center gap-2">
                    <span className="text-red-500 font-bold text-lg">🚫</span>
                    <div>
                      <p className="text-xs text-red-600 font-semibold">Hết hàng ({outOfStock.length} mặt hàng)</p>
                      <p className="text-xs text-red-400">{outOfStock.map(s => s.name).join(", ")}</p>
                    </div>
                  </div>
                )}
                {lowStock.length > 0 && (
                  <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-2.5 flex items-center gap-2">
                    <span className="text-orange-500 font-bold text-lg">⚠️</span>
                    <div>
                      <p className="text-xs text-orange-600 font-semibold">Sắp hết tồn kho ({lowStock.length} mặt hàng)</p>
                      <p className="text-xs text-orange-400">{lowStock.map(s => `${s.name} (còn ${s.stockQuantity})`).join(", ")}</p>
                    </div>
                  </div>
                )}
                {slowSales.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 flex items-center gap-2">
                    <span className="text-amber-500 font-bold text-lg">📉</span>
                    <div>
                      <p className="text-xs text-amber-700 font-semibold">Bán chậm tháng này ({slowSales.length} mặt hàng)</p>
                      <p className="text-xs text-amber-500">{slowSales.map(s => `${s.name} (${s.soldThisMonth ?? 0}/${s.monthlyThreshold}sp)`).join(", ")}</p>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

        <div className="overflow-auto rounded-2xl border border-gray-300" style={BG}>
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-200">
              <th className="w-14 px-3 py-3"></th>
              <th className="text-left px-3 py-3 font-semibold text-gray-700">Tên dịch vụ</th>
              <th className="text-left px-3 py-3 font-semibold text-gray-700">Loại</th>
              <th className="text-right px-3 py-3 font-semibold text-gray-700">Giá</th>
              <th className="text-right px-3 py-3 font-semibold text-gray-700">Tồn kho</th>
              <th className="text-right px-3 py-3 font-semibold text-gray-700">Đã bán / Ngưỡng</th>
              <th className="text-center px-3 py-3 font-semibold text-gray-700">Trạng thái</th>
              <th className="px-3 py-3"></th>
            </tr></thead>
            <tbody>
              {services.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-8 text-gray-400">Chưa có dịch vụ</td></tr>
              ) : services.map(svc => (
                <React.Fragment key={svc.id}>
                  <tr className="border-t border-gray-100">
                    {/* Thumbnail */}
                    <td className="px-3 py-2.5">
                      <div className="w-10 h-10 rounded-lg overflow-hidden border border-gray-200 bg-gray-50 flex items-center justify-center">
                        {svc.imageUrl
                          ? <img src={svc.imageUrl} alt={svc.name} className="w-full h-full object-cover" />
                          : <span className="text-gray-300 text-lg">📦</span>
                        }
                      </div>
                    </td>
                    <td className="px-3 py-2.5 font-medium text-black">{svc.name}</td>
                    <td className="px-3 py-2.5">
                      <span className={`text-xs px-2.5 py-1 rounded-full ${svc.type === "RENTAL" ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-orange-700"}`}>
                        {svc.type === "RENTAL" ? "Cho thuê" : "F&B"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right font-medium text-emerald-600">{Number(svc.price).toLocaleString("vi-VN")}đ</td>
                    <td className="px-3 py-2.5 text-right">
                      <span className="mr-1.5 font-medium">{svc.stockQuantity}</span>
                      {svc.type === "PRODUCT" && svc.stockQuantity === 0 && <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">Hết hàng</span>}
                      {svc.type === "PRODUCT" && svc.stockQuantity > 0 && svc.stockQuantity <= (svc.monthlyThreshold > 0 ? svc.monthlyThreshold : 10) && <span className="text-xs bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full">Sắp hết</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right text-xs">
                      {svc.type === "PRODUCT" ? (
                        <span className={`font-semibold ${svc.monthlyThreshold > 0 && (svc.soldThisMonth ?? 0) < svc.monthlyThreshold ? "text-amber-600" : "text-emerald-600"}`}>
                          {svc.soldThisMonth ?? 0}
                          {svc.monthlyThreshold > 0 && <span className="text-gray-400 font-normal"> / {svc.monthlyThreshold}</span>}
                        </span>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${svc.isActive ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                        {svc.isActive ? "Hoạt động" : "Ẩn"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => {
                          setEditing(svc);
                          setEditForm({ name: svc.name, type: svc.type, price: svc.price, stockQuantity: String(svc.stockQuantity), monthlyThreshold: String(svc.monthlyThreshold ?? 0), isActive: svc.isActive, imageUrl: svc.imageUrl ?? "" });
                        }} className="bg-blue-500 hover:bg-blue-400 text-white px-3 py-1.5 rounded-lg text-xs transition-colors">Sửa</button>
                        <button onClick={() => deleteService(svc.id)} className={BTN_R}>Ẩn</button>
                      </div>
                    </td>
                  </tr>
                  {editing?.id === svc.id && (
                    <tr className="bg-blue-50">
                      <td colSpan={8} className="px-4 py-3">
                        <div className="grid grid-cols-2 gap-2 mb-2 sm:grid-cols-4">
                          <input className={INPUT} placeholder="Tên" value={editForm.name || ""} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
                          <select className={INPUT} value={editForm.type || ""} onChange={e => setEditForm(f => ({ ...f, type: e.target.value }))}>
                            <option value="PRODUCT">F&B</option><option value="RENTAL">Cho thuê</option>
                          </select>
                          <input className={INPUT} placeholder="Giá (nghìn đ)" type="number" value={editForm.price || ""} onChange={e => setEditForm(f => ({ ...f, price: e.target.value }))} />
                          <input className={INPUT} placeholder="Tồn kho" type="number" value={editForm.stockQuantity || ""} onChange={e => setEditForm(f => ({ ...f, stockQuantity: e.target.value }))} />
                          <div className="col-span-2 sm:col-span-4">
                            <label className="block text-xs text-gray-500 mb-1">Ngưỡng bán tối thiểu/tháng (sản phẩm) — để 0 để dùng tự động</label>
                            <input className={INPUT + " w-48"} placeholder="Ngưỡng/tháng" type="number" min={0} value={editForm.monthlyThreshold || ""} onChange={e => setEditForm(f => ({ ...f, monthlyThreshold: e.target.value }))} />
                          </div>
                        </div>
                        {/* Upload ảnh trong edit */}
                        <div className="border border-blue-200 rounded-xl p-3 bg-white/60 mb-2">
                          <p className="text-xs text-gray-500 font-medium mb-2">Hình ảnh</p>
                          <ImageUpload
                            value={editForm.imageUrl as string || ""}
                            onChange={url => setEditForm(f => ({ ...f, imageUrl: url }))}
                            uploading={editUploading}
                            setUploading={setEditUploading}
                          />
                        </div>
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => setEditing(null)} className={BTN_W + " text-xs py-1.5"}>Hủy</button>
                          <button onClick={updateService} disabled={editUploading} className={BTN_G + " text-xs py-1.5"}>Lưu</button>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function OwnerDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const t = useTranslations("owner");
  const [activeTab, setActiveTab] = useState("overview");
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const TABS = TAB_IDS.map(tab => ({ ...tab, label: t(tab.labelKey as any) }));

  useEffect(() => {
    if (status === "unauthenticated") { router.push("/login"); return; }
    if (session && (session.user as any).role !== "OWNER") { router.push("/"); return; }
  }, [session, status, router]);

  useEffect(() => {
    if (status === "authenticated") {
      fetch("/api/owner/facilities").then(r => r.json()).then(d => setFacilities(Array.isArray(d) ? d : []));
    }
  }, [status]);

  if (status === "loading") return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "linear-gradient(to right, #DDEFBB, #FFEEEE)" }}>
      <p className="text-gray-500">{t("loading")}</p>
    </div>
  );

  return (
    <div className="min-h-screen text-black" style={{ fontFamily: "Arial, sans-serif", background: "linear-gradient(to right, #DDEFBB, #FFEEEE)" }}>
      <Navbar />
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-black">{t("dashboard")}</h1>
          <p className="text-gray-500 text-sm mt-1">{t("greeting", { name: (session?.user as any)?.name })}</p>
        </div>

        {/* Tab navigation */}
        <div className="flex gap-1 flex-wrap mb-6 border-b border-gray-200 pb-2">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? "bg-emerald-500 text-white"
                  : "bg-white text-gray-600 hover:text-black border border-gray-300 hover:border-emerald-300"
              }`}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div>
          {activeTab === "overview"   && <OverviewTab />}
          {activeTab === "facilities" && <FacilitiesTab />}
          {activeTab === "staff"      && <StaffTab facilities={facilities} />}
          {activeTab === "shifts"     && <WorkShiftsTab facilities={facilities} />}
          {activeTab === "attendance" && <AttendanceTab facilities={facilities} />}
          {activeTab === "salary"     && <SalaryTab facilities={facilities} />}
          {activeTab === "invoices"   && <InvoicesTab facilities={facilities} />}
          {activeTab === "services"   && <ServicesTab facilities={facilities} />}
          {activeTab === "revenue"    && <RevenueTab facilities={facilities} />}
        </div>
      </div>
    </div>
  );
}
