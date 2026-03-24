"use client";
import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import VietnamAddressInput from "@/components/VietnamAddressInput";
import { useTranslations } from "next-intl";

// ─── Types ──────────────────────────────────────────────────────────────────
interface Facility { id: number; name: string; address: string; description: string; isActive: boolean; courtCount: number; staffCount: number; sports: { id: number; name: string }[] }
interface StaffRecord { staffRecordId: number; facilityId: number; facilityName: string; role: string; joinedAt: string; user: { id: number; fullName: string; email: string; phone: string; role: string; isLocked: boolean } }
interface AttendanceStaff { userId: number; fullName: string; role: string; totalHours: number; presentDays: number; records: { id: number; date: string; checkIn: string | null; checkOut: string | null; totalHours: string | null; status: string }[] }
interface SalaryRecord { id: number; staffId: number; month: number; year: number; totalHours: number; wageRate: number; wageType: string; baseSalary: number; bonus: number; finalSalary: number; isPaid: boolean; paidAt: string | null; staff: { fullName: string; email: string } }
interface WageConfig { id: number; staffId: number; wageType: string; wageRate: number; staff: { id: number; fullName: string } }
interface Service { id: number; name: string; type: string; price: string; stockQuantity: number; isActive: boolean }
interface Invoice { id: number; createdAt: string; finalTotal: string; paymentMethod: string; staffName: string; customerName: string; courtName: string; items: { name: string; quantity: number; price: string }[] }

const TAB_IDS = [
  { id: "overview",   labelKey: "tabOverview"   },
  { id: "facilities", labelKey: "tabFacilities" },
  { id: "staff",      labelKey: "tabStaff"      },
  { id: "attendance", labelKey: "tabAttendance" },
  { id: "salary",     labelKey: "tabSalary"     },
  { id: "invoices",   labelKey: "tabInvoices"   },
  { id: "services",   labelKey: "tabServices"   },
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
  const [form, setForm] = useState({ name: "", address: "", description: "", sportIds: [] as number[] });
  const [courtForm, setCourtForm] = useState({ name: "", categoryId: "", weekdayPrice: "", weekendPrice: "", peakPrice: "" });
  const [facilityId, setFacilityId] = useState<number | null>(null);
  const [courts, setCourts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

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

  async function createFacility() {
    setLoading(true);
    const res = await fetch("/api/owner/facilities", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    setLoading(false);
    if (res.ok) {
      setShowForm(false);
      setForm({ name: "", address: "", description: "", sportIds: [] });
      fetch("/api/owner/facilities").then(r => r.json()).then(setFacilities);
    } else { const d = await res.json(); alert(d.error); }
  }

  async function addCourt() {
    if (!facilityId) return;
    setLoading(true);
    const res = await fetch("/api/owner/courts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...courtForm, facilityId }) });
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
            <textarea className={INPUT} rows={2} placeholder="Mô tả" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
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
            <div className="flex justify-between items-start">
              <div>
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
                      <div key={c.id} className="flex items-center justify-between bg-white rounded-xl px-4 py-2.5 border border-gray-200">
                        <div>
                          <p className="text-sm font-medium text-black">{c.name}</p>
                          <p className="text-xs text-gray-500">{c.category?.name}</p>
                        </div>
                        <button onClick={() => deleteCourt(c.id)} className={BTN_R}>Xóa</button>
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
                    <input className={INPUT} placeholder="Giá ngày thường (đ/giờ)" type="number" value={courtForm.weekdayPrice} onChange={e => setCourtForm(f => ({ ...f, weekdayPrice: e.target.value }))} />
                    <input className={INPUT} placeholder="Giá cuối tuần (đ/giờ)" type="number" value={courtForm.weekendPrice} onChange={e => setCourtForm(f => ({ ...f, weekendPrice: e.target.value }))} />
                    <input className={INPUT} placeholder="Giá cao điểm 17-21h (đ/giờ)" type="number" value={courtForm.peakPrice} onChange={e => setCourtForm(f => ({ ...f, peakPrice: e.target.value }))} />
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
  const [form, setForm] = useState({ facilityId: "", fullName: "", email: "", phone: "", password: "", role: "STAFF" });
  const [loading, setLoading] = useState(false);

  const loadStaff = useCallback((fid?: string) => {
    const q = fid ? `?facilityId=${fid}` : "";
    fetch(`/api/owner/staff${q}`).then(r => r.json()).then(setStaff);
  }, []);

  useEffect(() => { loadStaff(); }, [loadStaff]);

  async function createStaff() {
    setLoading(true);
    const res = await fetch("/api/owner/staff", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    setLoading(false);
    if (res.ok) {
      setShowForm(false);
      setForm({ facilityId: "", fullName: "", email: "", phone: "", password: "", role: "STAFF" });
      loadStaff(selectedFacility);
    } else { const d = await res.json(); alert(d.error); }
  }

  async function toggleLockStaff(recordId: number, isLocked: boolean) {
    const action = isLocked ? "Mở khóa" : "Khóa";
    if (!confirm(`${action} tài khoản nhân viên này?`)) return;
    await fetch(`/api/owner/staff/${recordId}`, { method: "PATCH" });
    loadStaff(selectedFacility);
  }

  const filtered = selectedFacility ? staff.filter(s => s.facilityId === Number(selectedFacility)) : staff;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <select className={INPUT + " w-48"} value={selectedFacility}
            onChange={e => { setSelectedFacility(e.target.value); loadStaff(e.target.value); }}>
            <option value="">Tất cả cơ sở</option>
            {facilities.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>
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
          </div>
          <div className="flex gap-2 justify-end mt-3">
            <button onClick={() => setShowForm(false)} className={BTN_W}>Hủy</button>
            <button onClick={createStaff} disabled={loading} className={BTN_G}>{loading ? "Đang tạo..." : "Tạo tài khoản"}</button>
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
              <th className="text-left px-4 py-3 font-semibold text-gray-700">Cơ sở</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-8 text-gray-400">Chưa có nhân viên</td></tr>
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
                <td className="px-4 py-3 text-gray-600 text-xs">{s.facilityName}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => toggleLockStaff(s.staffRecordId, s.user.isLocked)}
                    className={s.user.isLocked ? BTN_G : BTN_R}
                  >
                    {s.user.isLocked ? "Mở khóa" : "Khóa"}
                  </button>
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

  async function load() {
    if (!facilityId) { alert("Vui lòng chọn cơ sở"); return; }
    const res = await fetch(`/api/owner/attendance?facilityId=${facilityId}&month=${month}&year=${year}`);
    const d = await res.json();
    setData(d);
    setLoaded(true);
  }

  const STATUS_LABEL: Record<string, string> = { WORKING: "Đang làm", COMPLETED: "Hoàn thành", ABSENT: "Vắng" };

  return (
    <div>
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
          <button onClick={load} className={BTN_G}>Xem</button>
        </div>
      </div>

      {loaded && data.map(staff => (
        <div key={staff.userId} className={CARD} style={BG}>
          <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpandedStaff(expandedStaff === staff.userId ? null : staff.userId)}>
            <div>
              <p className="font-semibold text-black">{staff.fullName}</p>
              <p className="text-xs text-gray-500">{staff.role === "WAREHOUSE_MANAGER" ? "Quản lý kho" : "Nhân viên"}</p>
            </div>
            <div className="flex gap-4 text-right text-sm">
              <div><p className="font-bold text-emerald-600">{staff.presentDays}</p><p className="text-xs text-gray-500">ngày</p></div>
              <div><p className="font-bold text-blue-600">{staff.totalHours}h</p><p className="text-xs text-gray-500">giờ</p></div>
              <span className="text-gray-400">{expandedStaff === staff.userId ? "▲" : "▼"}</span>
            </div>
          </div>
          {expandedStaff === staff.userId && (
            <div className="mt-3 overflow-auto">
              <table className="w-full text-xs">
                <thead><tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-3 font-semibold text-gray-600">Ngày</th>
                  <th className="text-left py-2 px-3 font-semibold text-gray-600">Vào</th>
                  <th className="text-left py-2 px-3 font-semibold text-gray-600">Ra</th>
                  <th className="text-left py-2 px-3 font-semibold text-gray-600">Giờ</th>
                  <th className="text-left py-2 px-3 font-semibold text-gray-600">Trạng thái</th>
                </tr></thead>
                <tbody>
                  {staff.records.length === 0 ? (
                    <tr><td colSpan={5} className="py-4 text-center text-gray-400">Không có dữ liệu</td></tr>
                  ) : staff.records.map(r => (
                    <tr key={r.id} className="border-t border-gray-100">
                      <td className="py-2 px-3">{new Date(r.date).toLocaleDateString("vi-VN")}</td>
                      <td className="py-2 px-3">{r.checkIn ? new Date(r.checkIn).toISOString().substring(11, 16) : "—"}</td>
                      <td className="py-2 px-3">{r.checkOut ? new Date(r.checkOut).toISOString().substring(11, 16) : "—"}</td>
                      <td className="py-2 px-3 font-medium">{r.totalHours ?? "—"}</td>
                      <td className="py-2 px-3">
                        <span className={`px-2 py-0.5 rounded-full ${r.status === "ABSENT" ? "bg-red-100 text-red-600" : "bg-emerald-100 text-emerald-700"}`}>
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
  const [data, setData] = useState<{ salaryRecords: SalaryRecord[]; wageConfigs: WageConfig[]; staffList: any[] } | null>(null);
  const [selectedStaff, setSelectedStaff] = useState<any>(null);
  const [wageForm, setWageForm] = useState({ wageType: "HOURLY", wageRate: "", bonus: "" });
  const [loading, setLoading] = useState(false);

  async function load() {
    if (!facilityId) return;
    const res = await fetch(`/api/owner/salary?facilityId=${facilityId}&month=${month}&year=${year}`);
    setData(await res.json());
  }

  async function calculate() {
    if (!selectedStaff || !facilityId) return;
    setLoading(true);
    const res = await fetch("/api/owner/salary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ facilityId, staffId: selectedStaff.id, month, year, ...wageForm }),
    });
    setLoading(false);
    if (res.ok) { setSelectedStaff(null); load(); }
    else { const d = await res.json(); alert(d.error); }
  }

  async function paySalary(recordId: number) {
    if (!confirm("Xác nhận thanh toán lương?")) return;
    const res = await fetch("/api/owner/salary/pay", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ salaryRecordId: recordId }),
    });
    const d = await res.json();
    if (res.ok) load();
    else alert(d.error);
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
        </div>
      </div>

      {data && (
        <>
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-semibold text-black">Bảng lương tháng {month}/{year}</h3>
            <select className={INPUT + " w-52"} value={selectedStaff?.id || ""} onChange={e => {
              const s = data.staffList.find(x => x.id === Number(e.target.value));
              setSelectedStaff(s || null);
              const cfg = data.wageConfigs.find(x => x.staffId === s?.id);
              if (cfg) setWageForm(f => ({ ...f, wageType: cfg.wageType, wageRate: String(cfg.wageRate) }));
            }}>
              <option value="">-- Tính lương nhân viên --</option>
              {data.staffList.map(s => <option key={s.id} value={s.id}>{s.fullName}</option>)}
            </select>
          </div>

          {selectedStaff && (
            <div className={CARD} style={BG}>
              <p className="font-semibold text-black mb-3">Cấu hình lương: {selectedStaff.fullName}</p>
              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Loại lương</p>
                  <select className={INPUT} value={wageForm.wageType} onChange={e => setWageForm(f => ({ ...f, wageType: e.target.value }))}>
                    <option value="HOURLY">Theo giờ</option>
                    <option value="DAILY">Theo ngày</option>
                  </select>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">{wageForm.wageType === "HOURLY" ? "Giá/giờ (đ)" : "Giá/ngày (đ)"}</p>
                  <input className={INPUT} type="number" placeholder="Mức lương" value={wageForm.wageRate} onChange={e => setWageForm(f => ({ ...f, wageRate: e.target.value }))} />
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Thưởng thêm (đ)</p>
                  <input className={INPUT} type="number" placeholder="0" value={wageForm.bonus} onChange={e => setWageForm(f => ({ ...f, bonus: e.target.value }))} />
                </div>
              </div>
              <div className="flex gap-2 justify-end mt-3">
                <button onClick={() => setSelectedStaff(null)} className={BTN_W}>Hủy</button>
                <button onClick={calculate} disabled={loading} className={BTN_G}>{loading ? "..." : "Tính lương"}</button>
              </div>
            </div>
          )}

          <div className="overflow-auto rounded-2xl border border-gray-300" style={BG}>
            <table className="w-full text-sm">
              <thead><tr className="border-b border-gray-200">
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Nhân viên</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-700">Giờ/Ngày</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-700">Lương cơ bản</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-700">Thưởng</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-700">Tổng lương</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-700">Trạng thái</th>
                <th className="px-4 py-3"></th>
              </tr></thead>
              <tbody>
                {data.salaryRecords.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-8 text-gray-400">Chưa có bảng lương</td></tr>
                ) : data.salaryRecords.map(r => (
                  <tr key={r.id} className="border-t border-gray-100">
                    <td className="px-4 py-3 font-medium text-black">{r.staff.fullName}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{r.totalHours}{r.wageType === "HOURLY" ? "h" : " ngày"}</td>
                    <td className="px-4 py-3 text-right">{Number(r.baseSalary).toLocaleString("vi-VN")}đ</td>
                    <td className="px-4 py-3 text-right text-emerald-600">+{Number(r.bonus).toLocaleString("vi-VN")}đ</td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-600">{Number(r.finalSalary).toLocaleString("vi-VN")}đ</td>
                    <td className="px-4 py-3 text-center">
                      {r.isPaid
                        ? <span className="text-xs bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full">Đã trả</span>
                        : <span className="text-xs bg-yellow-100 text-yellow-700 px-2.5 py-1 rounded-full">Chưa trả</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {!r.isPaid && <button onClick={() => paySalary(r.id)} className={BTN_G + " text-xs py-1.5"}>Thanh toán ví</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
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

// ─── Invoices Tab ────────────────────────────────────────────────────────────
function InvoicesTab({ facilities }: { facilities: Facility[] }) {
  const now = new Date();
  const [facilityId, setFacilityId] = useState<string>("");
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [occupancy, setOccupancy] = useState<any>(null);
  const [monthlyStats, setMonthlyStats] = useState<any[]>([]);
  const [chartView, setChartView] = useState<"day" | "hour" | "court" | "sport" | "month">("day");

  const PM_LABEL: Record<string, string> = { CASH: "Tiền mặt", TRANSFER: "Chuyển khoản", QR: "VNPay", WALLET: "Ví SportHub" };

  async function load() {
    if (!facilityId) return;
    const [invRes, occRes, mRes] = await Promise.all([
      fetch(`/api/owner/invoices?facilityId=${facilityId}&month=${month}&year=${year}`),
      fetch(`/api/owner/occupancy?facilityId=${facilityId}&month=${month}&year=${year}`),
      fetch(`/api/owner/occupancy?facilityId=${facilityId}&year=${year}&period=year`),
    ]);
    const invData = await invRes.json();
    const occData = await occRes.json();
    const mData = await mRes.json();
    setInvoices(Array.isArray(invData) ? invData : []);
    setOccupancy(occData.dailyStats ? occData : null);
    setMonthlyStats(mData.monthlyStats || []);
    setLoaded(true);
  }

  const total = invoices.reduce((s, i) => s + Number(i.finalTotal), 0);

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
      case "day":
        return (occupancy?.dailyStats || []).map((d: any) => ({ label: `${d.day}`, value: d.count }));
      case "hour":
        return (occupancy?.hourlyStats || []).map((h: any) => ({
          label: h.hour.replace(":00", "h"),
          value: h.count,
          highlight: parseInt(h.hour) >= 7 && parseInt(h.hour) < 9,
        }));
      case "court":
        return (occupancy?.courtStats || []).map((c: any) => ({ label: c.courtName, value: c.count }));
      case "sport":
        return (occupancy?.sportStats || []).map((s: any) => ({ label: s.name, value: s.count }));
      case "month":
        return monthlyStats.map((m: any) => ({ label: `T${m.month}`, value: m.count, rate: m.rate }));
    }
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

          {/* Occupancy chart */}
          <div className={CARD} style={BG}>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <h3 className="font-semibold text-black">Tỉ lệ lấp đầy</h3>
              <div className="flex gap-1 flex-wrap">
                {CHART_VIEWS.map(v => (
                  <button key={v.key} onClick={() => setChartView(v.key)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors border ${
                      chartView === v.key
                        ? "bg-emerald-500 text-white border-emerald-500"
                        : "bg-white text-gray-600 border-gray-300 hover:border-emerald-300"
                    }`}>
                    {v.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Summary row */}
            {occupancy && chartView !== "month" && (
              <div className="flex gap-3 mb-4 flex-wrap">
                <div className="bg-white rounded-xl px-4 py-2 border border-gray-200 text-center">
                  <p className="text-xs text-gray-500">Tổng lượt đặt</p>
                  <p className="font-bold text-emerald-600 text-lg">
                    {(occupancy.dailyStats || []).reduce((s: number, d: any) => s + d.count, 0)}
                  </p>
                </div>
                <div className="bg-white rounded-xl px-4 py-2 border border-gray-200 text-center">
                  <p className="text-xs text-gray-500">Ngày cao nhất</p>
                  <p className="font-bold text-blue-600 text-lg">
                    {Math.max(...(occupancy.dailyStats || [{ count: 0 }]).map((d: any) => d.count))} lượt
                  </p>
                </div>
                <div className="bg-white rounded-xl px-4 py-2 border border-gray-200 text-center">
                  <p className="text-xs text-gray-500">Lấp đầy TB/ngày</p>
                  <p className="font-bold text-orange-600 text-lg">
                    {(() => {
                      const days = (occupancy.dailyStats || []);
                      const avg = days.length ? Math.round(days.reduce((s: number, d: any) => s + d.rate, 0) / days.length) : 0;
                      return avg + "%";
                    })()}
                  </p>
                </div>
              </div>
            )}

            <BarChart
              items={getChartItems()}
              labelKey="label"
              valueKey="value"
              color="#10b981"
            />

            {chartView === "hour" && (
              <p className="text-xs text-gray-400 mt-2">Màu vàng = khung giờ cao điểm (7h–9h)</p>
            )}
            {chartView === "month" && (
              <p className="text-xs text-gray-400 mt-2">Tổng lượt đặt theo từng tháng — năm {year}</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Services Tab ────────────────────────────────────────────────────────────
function ServicesTab({ facilities }: { facilities: Facility[] }) {
  const [facilityId, setFacilityId] = useState<string>("");
  const [services, setServices] = useState<Service[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [form, setForm] = useState({ name: "", type: "PRODUCT", price: "", stockQuantity: "" });
  const [editForm, setEditForm] = useState<Partial<Omit<Service, "stockQuantity"> & { stockQuantity: string }>>({});
  const [loaded, setLoaded] = useState(false);

  const loadServices = useCallback((fid: string) => {
    if (!fid) return;
    fetch(`/api/owner/services?facilityId=${fid}`).then(r => r.json()).then(d => { setServices(Array.isArray(d) ? d : []); setLoaded(true); });
  }, []);

  async function createService() {
    const res = await fetch("/api/owner/services", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, facilityId }),
    });
    if (res.ok) { setShowForm(false); setForm({ name: "", type: "PRODUCT", price: "", stockQuantity: "" }); loadServices(facilityId); }
    else { const d = await res.json(); alert(d.error); }
  }

  async function updateService() {
    if (!editing) return;
    const res = await fetch(`/api/owner/services/${editing.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
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
          <div className="grid grid-cols-2 gap-2.5">
            <input className={INPUT} placeholder="Tên dịch vụ *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            <select className={INPUT} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
              <option value="PRODUCT">Sản phẩm (F&B)</option>
              <option value="RENTAL">Cho thuê</option>
            </select>
            <input className={INPUT} placeholder="Giá (đ) *" type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} />
            <input className={INPUT} placeholder="Tồn kho" type="number" value={form.stockQuantity} onChange={e => setForm(f => ({ ...f, stockQuantity: e.target.value }))} />
          </div>
          <div className="flex gap-2 justify-end mt-3">
            <button onClick={() => setShowForm(false)} className={BTN_W}>Hủy</button>
            <button onClick={createService} className={BTN_G}>Thêm</button>
          </div>
        </div>
      )}

      {loaded && (
        <div className="overflow-auto rounded-2xl border border-gray-300" style={BG}>
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-200">
              <th className="text-left px-4 py-3 font-semibold text-gray-700">Tên dịch vụ</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-700">Loại</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-700">Giá</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-700">Tồn kho</th>
              <th className="text-center px-4 py-3 font-semibold text-gray-700">Trạng thái</th>
              <th className="px-4 py-3"></th>
            </tr></thead>
            <tbody>
              {services.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-gray-400">Chưa có dịch vụ</td></tr>
              ) : services.map(svc => (
                <>
                  <tr key={svc.id} className="border-t border-gray-100">
                    <td className="px-4 py-3 font-medium text-black">{svc.name}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2.5 py-1 rounded-full ${svc.type === "RENTAL" ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-orange-700"}`}>
                        {svc.type === "RENTAL" ? "Cho thuê" : "F&B"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-emerald-600">{Number(svc.price).toLocaleString("vi-VN")}đ</td>
                    <td className="px-4 py-3 text-right">{svc.stockQuantity}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${svc.isActive ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                        {svc.isActive ? "Hoạt động" : "Ẩn"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right flex gap-2 justify-end">
                      <button onClick={() => { setEditing(svc); setEditForm({ name: svc.name, type: svc.type, price: svc.price, stockQuantity: String(svc.stockQuantity), isActive: svc.isActive }); }}
                        className="bg-blue-500 hover:bg-blue-400 text-white px-3 py-1.5 rounded-lg text-xs transition-colors">Sửa</button>
                      <button onClick={() => deleteService(svc.id)} className={BTN_R}>Ẩn</button>
                    </td>
                  </tr>
                  {editing?.id === svc.id && (
                    <tr className="bg-blue-50">
                      <td colSpan={6} className="px-4 py-3">
                        <div className="grid grid-cols-4 gap-2">
                          <input className={INPUT} placeholder="Tên" value={editForm.name || ""} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
                          <select className={INPUT} value={editForm.type || ""} onChange={e => setEditForm(f => ({ ...f, type: e.target.value }))}>
                            <option value="PRODUCT">F&B</option><option value="RENTAL">Cho thuê</option>
                          </select>
                          <input className={INPUT} placeholder="Giá" type="number" value={editForm.price || ""} onChange={e => setEditForm(f => ({ ...f, price: e.target.value }))} />
                          <input className={INPUT} placeholder="Tồn kho" type="number" value={editForm.stockQuantity || ""} onChange={e => setEditForm(f => ({ ...f, stockQuantity: e.target.value }))} />
                        </div>
                        <div className="flex gap-2 justify-end mt-2">
                          <button onClick={() => setEditing(null)} className={BTN_W + " text-xs py-1.5"}>Hủy</button>
                          <button onClick={updateService} className={BTN_G + " text-xs py-1.5"}>Lưu</button>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
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
          {activeTab === "attendance" && <AttendanceTab facilities={facilities} />}
          {activeTab === "salary"     && <SalaryTab facilities={facilities} />}
          {activeTab === "invoices"   && <InvoicesTab facilities={facilities} />}
          {activeTab === "services"   && <ServicesTab facilities={facilities} />}
        </div>
      </div>
    </div>
  );
}
