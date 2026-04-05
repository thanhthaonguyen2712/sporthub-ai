"use client";
import React, { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";

// ─── Constants ────────────────────────────────────────────────────────────────
const CARD  = "border border-gray-300 rounded-2xl p-5 mb-4";
const BG    = { background: "#E0EEE0" };
const INPUT = "w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:border-emerald-400";
const BTN_G = "bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-300 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors";
const BTN_W = "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 px-4 py-2 rounded-xl text-sm transition-colors";

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Admin", OWNER: "Chủ sân", STAFF: "Nhân viên",
  WAREHOUSE_MANAGER: "Quản kho", CUSTOMER: "Khách hàng",
};
const ROLE_COLOR: Record<string, string> = {
  ADMIN:             "bg-purple-100 text-purple-700",
  OWNER:             "bg-blue-100 text-blue-700",
  STAFF:             "bg-orange-100 text-orange-700",
  WAREHOUSE_MANAGER: "bg-teal-100 text-teal-700",
  CUSTOMER:          "bg-emerald-100 text-emerald-700",
};
const REPORT_TYPE_LABEL: Record<string, string> = {
  FACILITY:         "Sự cố sân",
  EQUIPMENT:        "Thiết bị hỏng",
  INVENTORY_DAMAGE: "Hàng hóa hỏng",
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface Stats {
  totalUsers: number;
  usersByRole: { role: string; _count: { id: number } }[];
  totalFacilities: number;
  activeFacilities: number;
  totalBookings: number;
  totalRevenue: number;
  openReports: number;
  recentUsers: User[];
}
interface User {
  id: number; fullName: string; email: string; phone: string;
  role: string; isLocked: boolean; createdAt: string; avatar: string | null;
  loyaltyPoint: number;
  _count: { bookings: number; ownedFacilities: number };
}
interface Facility {
  id: number; name: string; address: string; isActive: boolean;
  owner: { id: number; fullName: string; email: string; phone: string };
  facilitySports: { sportCategory: { name: string } }[];
  _count: { courts: number; facilityStaff: number };
}
interface Report {
  id: number; type: string; title: string; description: string;
  status: string; createdAt: string;
  staff: { fullName: string; email: string };
  facility: { name: string };
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────
function OverviewTab() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/stats").then(r => r.json()).then(d => { setStats(d); setLoading(false); });
  }, []);

  if (loading) return <p className="text-center text-gray-400 py-16">Đang tải...</p>;
  if (!stats)  return null;

  const byRole = Object.fromEntries(stats.usersByRole.map(r => [r.role, r._count.id]));

  const statCards = [
    { label: "Tổng người dùng",   value: stats.totalUsers,      color: "text-purple-600" },
    { label: "Cơ sở đang hoạt động", value: `${stats.activeFacilities}/${stats.totalFacilities}`, color: "text-blue-600" },
    { label: "Tổng lượt đặt sân", value: stats.totalBookings,   color: "text-orange-600" },
    { label: "Tổng doanh thu",     value: `${Number(stats.totalRevenue).toLocaleString("vi-VN")}đ`, color: "text-emerald-600" },
    { label: "Báo cáo chưa xử lý",value: stats.openReports,    color: "text-red-600" },
  ];

  return (
    <div className="space-y-4">
      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {statCards.map(s => (
          <div key={s.label} className={CARD + " !mb-0"} style={BG}>
            <p className="text-xs text-gray-500 mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Users by role */}
      <div className={CARD} style={BG}>
        <p className="font-semibold text-black mb-3">Người dùng theo vai trò</p>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {(["ADMIN","OWNER","STAFF","WAREHOUSE_MANAGER","CUSTOMER"] as const).map(r => (
            <div key={r} className="bg-white rounded-xl p-3 border border-gray-200 text-center">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLOR[r]}`}>{ROLE_LABEL[r]}</span>
              <p className="text-xl font-bold text-black mt-2">{byRole[r] ?? 0}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Recent registrations */}
      <div className={CARD} style={BG}>
        <p className="font-semibold text-black mb-3">Đăng ký gần đây</p>
        <div className="space-y-2">
          {stats.recentUsers.map(u => (
            <div key={u.id} className="flex items-center justify-between bg-white rounded-xl px-4 py-2.5 border border-gray-100">
              <div className="flex items-center gap-3 min-w-0">
                {u.avatar
                  ? <img src={u.avatar} className="w-8 h-8 rounded-full object-cover shrink-0" alt="" />
                  : <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 font-bold text-sm shrink-0">{u.fullName[0]}</div>
                }
                <div className="min-w-0">
                  <p className="text-sm font-medium text-black truncate">{u.fullName}</p>
                  <p className="text-xs text-gray-400 truncate">{u.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLOR[u.role]}`}>{ROLE_LABEL[u.role]}</span>
                <span className="text-xs text-gray-400">{new Date(u.createdAt).toLocaleDateString("vi-VN")}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Users Tab ─────────────────────────────────────────────────────────────────
function UsersTab() {
  const [users, setUsers]           = useState<User[]>([]);
  const [total, setTotal]           = useState(0);
  const [page, setPage]             = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch]         = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [loading, setLoading]       = useState(false);
  const [lockLoading, setLockLoading] = useState<number | null>(null);

  const load = useCallback(async (q = search, r = roleFilter, p = page) => {
    setLoading(true);
    const params = new URLSearchParams({ search: q, role: r, page: String(p) });
    const res = await fetch(`/api/admin/users?${params}`);
    const data = await res.json();
    setLoading(false);
    setUsers(data.users || []);
    setTotal(data.total || 0);
    setTotalPages(data.totalPages || 1);
  }, [search, roleFilter, page]);

  useEffect(() => { load(); }, [load]);

  async function toggleLock(user: User) {
    setLockLoading(user.id);
    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isLocked: !user.isLocked }),
    });
    setLockLoading(null);
    if (res.ok) load();
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    load(search, roleFilter, 1);
  }

  return (
    <div>
      {/* Search + Filter */}
      <form onSubmit={handleSearch} className={CARD + " !mb-3"} style={BG}>
        <div className="flex flex-wrap gap-2">
          <input className={INPUT + " flex-1 min-w-40"} placeholder="Tìm tên / email / SĐT..."
            value={search} onChange={e => setSearch(e.target.value)} />
          <select className={INPUT + " w-44"} value={roleFilter} onChange={e => { setRoleFilter(e.target.value); setPage(1); load(search, e.target.value, 1); }}>
            <option value="">Tất cả vai trò</option>
            {(["ADMIN","OWNER","STAFF","WAREHOUSE_MANAGER","CUSTOMER"] as const).map(r => (
              <option key={r} value={r}>{ROLE_LABEL[r]}</option>
            ))}
          </select>
          <button type="submit" className={BTN_G}>Tìm kiếm</button>
        </div>
      </form>

      <p className="text-xs text-gray-500 mb-2">Tổng: <span className="font-semibold text-black">{total}</span> người dùng</p>

      {/* Table */}
      <div className="overflow-auto rounded-2xl border border-gray-300" style={BG}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-gray-600 text-xs">
              <th className="text-left px-4 py-3 font-semibold">Người dùng</th>
              <th className="text-left px-4 py-3 font-semibold">Vai trò</th>
              <th className="text-left px-4 py-3 font-semibold hidden sm:table-cell">SĐT</th>
              <th className="text-center px-4 py-3 font-semibold hidden sm:table-cell">Đặt sân</th>
              <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">Ngày tạo</th>
              <th className="text-center px-4 py-3 font-semibold">Trạng thái</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center py-10 text-gray-400">Đang tải...</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-10 text-gray-400">Không tìm thấy</td></tr>
            ) : users.map(u => (
              <tr key={u.id} className={`border-t border-gray-100 ${u.isLocked ? "bg-red-50/40" : "hover:bg-white/50"}`}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 min-w-0">
                    {u.avatar
                      ? <img src={u.avatar} className="w-7 h-7 rounded-full object-cover shrink-0" alt="" />
                      : <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 font-bold text-xs shrink-0">{u.fullName[0]}</div>
                    }
                    <div className="min-w-0">
                      <p className="font-medium text-black text-xs truncate">{u.fullName}</p>
                      <p className="text-gray-400 text-[11px] truncate">{u.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLOR[u.role]}`}>{ROLE_LABEL[u.role]}</span>
                </td>
                <td className="px-4 py-3 text-xs text-gray-600 hidden sm:table-cell">{u.phone}</td>
                <td className="px-4 py-3 text-xs text-center hidden sm:table-cell">{u._count.bookings}</td>
                <td className="px-4 py-3 text-xs text-gray-500 hidden md:table-cell">
                  {new Date(u.createdAt).toLocaleDateString("vi-VN")}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${u.isLocked ? "bg-red-100 text-red-600" : "bg-emerald-100 text-emerald-700"}`}>
                    {u.isLocked ? "Đã khóa" : "Hoạt động"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => toggleLock(u)}
                    disabled={lockLoading === u.id}
                    className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50 ${
                      u.isLocked
                        ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                        : "bg-red-100 text-red-600 hover:bg-red-200"
                    }`}>
                    {lockLoading === u.id ? "..." : u.isLocked ? "Mở khóa" : "Khóa"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <button onClick={() => { setPage(p => Math.max(1, p-1)); load(search, roleFilter, Math.max(1, page-1)); }}
            disabled={page <= 1} className={BTN_W + " disabled:opacity-40"}>← Trước</button>
          <span className="flex items-center text-sm text-gray-600">Trang {page}/{totalPages}</span>
          <button onClick={() => { setPage(p => Math.min(totalPages, p+1)); load(search, roleFilter, Math.min(totalPages, page+1)); }}
            disabled={page >= totalPages} className={BTN_W + " disabled:opacity-40"}>Sau →</button>
        </div>
      )}
    </div>
  );
}

// ─── Facilities Tab ────────────────────────────────────────────────────────────
function FacilitiesTab() {
  const [facilities, setFacilities]   = useState<Facility[]>([]);
  const [loading, setLoading]         = useState(true);
  const [toggleLoading, setToggleLoading] = useState<number | null>(null);
  const [search, setSearch]           = useState("");

  useEffect(() => {
    fetch("/api/admin/facilities").then(r => r.json()).then(d => { setFacilities(d); setLoading(false); });
  }, []);

  async function toggleActive(f: Facility) {
    setToggleLoading(f.id);
    const res = await fetch(`/api/admin/facilities/${f.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !f.isActive }),
    });
    setToggleLoading(null);
    if (res.ok) setFacilities(prev => prev.map(x => x.id === f.id ? { ...x, isActive: !f.isActive } : x));
  }

  const filtered = search
    ? facilities.filter(f =>
        f.name.toLowerCase().includes(search.toLowerCase()) ||
        f.owner.fullName.toLowerCase().includes(search.toLowerCase()) ||
        f.address.toLowerCase().includes(search.toLowerCase())
      )
    : facilities;

  return (
    <div>
      <div className={CARD + " !mb-3"} style={BG}>
        <input className={INPUT} placeholder="Tìm tên cơ sở, chủ sân, địa chỉ..."
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <p className="text-xs text-gray-500 mb-2">
        Tổng: <span className="font-semibold text-black">{filtered.length}</span> cơ sở
        &nbsp;·&nbsp; Đang hoạt động: <span className="font-semibold text-emerald-600">{filtered.filter(f=>f.isActive).length}</span>
        &nbsp;·&nbsp; Tạm ngưng: <span className="font-semibold text-red-500">{filtered.filter(f=>!f.isActive).length}</span>
      </p>

      {loading ? <p className="text-center py-16 text-gray-400">Đang tải...</p> : (
        <div className="space-y-3">
          {filtered.map(f => (
            <div key={f.id} className={`border-2 rounded-2xl p-4 bg-white transition-all ${f.isActive ? "border-gray-200" : "border-red-200 bg-red-50/30"}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <p className="font-semibold text-black">{f.name}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${f.isActive ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`}>
                      {f.isActive ? "Đang hoạt động" : "Tạm ngưng"}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mb-1">{f.address}</p>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {f.facilitySports.map(fs => (
                      <span key={fs.sportCategory.name} className="text-[11px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full border border-blue-100">
                        {fs.sportCategory.name}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span>Chủ: <span className="font-medium text-black">{f.owner.fullName}</span></span>
                    <span>{f._count.courts} sân con</span>
                    <span>{f._count.facilityStaff} nhân viên</span>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-0.5">{f.owner.email} · {f.owner.phone}</p>
                </div>
                <button
                  onClick={() => toggleActive(f)}
                  disabled={toggleLoading === f.id}
                  className={`shrink-0 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50 ${
                    f.isActive
                      ? "bg-red-100 text-red-600 hover:bg-red-200"
                      : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                  }`}>
                  {toggleLoading === f.id ? "..." : f.isActive ? "Tạm ngưng" : "Kích hoạt"}
                </button>
              </div>
            </div>
          ))}
          {filtered.length === 0 && <p className="text-center py-16 text-gray-400">Không tìm thấy cơ sở nào</p>}
        </div>
      )}
    </div>
  );
}

// ─── Reports Tab ───────────────────────────────────────────────────────────────
function ReportsTab() {
  const [reports, setReports]         = useState<Report[]>([]);
  const [loading, setLoading]         = useState(true);
  const [statusFilter, setStatusFilter] = useState("OPEN");
  const [resolveLoading, setResolveLoading] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/reports");
    if (res.ok) setReports(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function markResolved(r: Report) {
    setResolveLoading(r.id);
    await fetch("/api/admin/reports", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: r.id, status: "RESOLVED" }),
    });
    setResolveLoading(null);
    setReports(prev => prev.map(x => x.id === r.id ? { ...x, status: "RESOLVED" } : x));
  }

  const filtered = reports.filter(r => !statusFilter || r.status === statusFilter);

  return (
    <div>
      {/* Filter */}
      <div className="flex gap-2 mb-4">
        {[["", "Tất cả"], ["OPEN", "Chưa xử lý"], ["RESOLVED", "Đã giải quyết"]].map(([v, l]) => (
          <button key={v} onClick={() => setStatusFilter(v)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors border ${
              statusFilter === v ? "bg-emerald-500 text-white border-emerald-500" : "bg-white text-gray-600 border-gray-300 hover:border-emerald-300"
            }`}>{l}</button>
        ))}
      </div>

      <p className="text-xs text-gray-500 mb-3">
        {filtered.length} báo cáo &nbsp;·&nbsp;
        Chưa xử lý: <span className="font-semibold text-red-500">{reports.filter(r=>r.status==="OPEN").length}</span>
      </p>

      {loading ? <p className="text-center py-16 text-gray-400">Đang tải...</p> : (
        <div className="space-y-3">
          {filtered.length === 0 && <p className="text-center py-16 text-gray-400">Không có báo cáo</p>}
          {filtered.map(r => (
            <div key={r.id} className={`border rounded-2xl p-4 bg-white transition-all ${r.status === "OPEN" ? "border-orange-200" : "border-gray-200"}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      r.type === "FACILITY" ? "bg-yellow-100 text-yellow-700"
                      : r.type === "EQUIPMENT" ? "bg-orange-100 text-orange-700"
                      : "bg-red-100 text-red-600"
                    }`}>{REPORT_TYPE_LABEL[r.type] || r.type}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${r.status === "OPEN" ? "bg-orange-100 text-orange-600" : "bg-emerald-100 text-emerald-700"}`}>
                      {r.status === "OPEN" ? "Chưa xử lý" : "Đã giải quyết"}
                    </span>
                  </div>
                  <p className="font-semibold text-black text-sm">{r.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{r.description}</p>
                  <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-400">
                    <span>Cơ sở: <span className="font-medium text-gray-700">{r.facility.name}</span></span>
                    <span>Nhân viên: <span className="font-medium text-gray-700">{r.staff.fullName}</span></span>
                    <span>{new Date(r.createdAt).toLocaleString("vi-VN", { day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit" })}</span>
                  </div>
                </div>
                {r.status === "OPEN" && (
                  <button
                    onClick={() => markResolved(r)}
                    disabled={resolveLoading === r.id}
                    className="shrink-0 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50">
                    {resolveLoading === r.id ? "..." : "Đánh dấu xử lý"}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Dashboard ────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    if (status === "unauthenticated") { router.push("/login"); return; }
    if (session && (session.user as any)?.role !== "ADMIN") { router.push("/"); return; }
  }, [session, status, router]);

  if (status === "loading" || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "linear-gradient(to right, #DDEFBB, #FFEEEE)" }}>
        <p className="text-gray-500">Đang tải...</p>
      </div>
    );
  }

  const TABS = [
    { id: "overview",    label: "Tổng quan"     },
    { id: "users",       label: "Người dùng"    },
    { id: "facilities",  label: "Cơ sở"         },
    { id: "reports",     label: "Báo cáo sự cố" },
  ];

  return (
    <div className="min-h-screen text-black" style={{ fontFamily: "Arial, sans-serif", background: "linear-gradient(to right, #DDEFBB, #FFEEEE)" }}>
      <Navbar />

      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-black">Quản trị hệ thống</h1>
          <p className="text-gray-500 text-sm mt-1">
            Xin chào, <span className="font-medium text-black">{session.user?.name}</span>
            &nbsp;·&nbsp;<span className="text-purple-600 font-semibold">Admin</span>
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 flex-wrap mb-6 border-b border-gray-200 pb-2">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? "bg-purple-600 text-white"
                  : "bg-white text-gray-600 hover:text-black border border-gray-300 hover:border-purple-300"
              }`}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div>
          {activeTab === "overview"   && <OverviewTab />}
          {activeTab === "users"      && <UsersTab />}
          {activeTab === "facilities" && <FacilitiesTab />}
          {activeTab === "reports"    && <ReportsTab />}
        </div>
      </div>
    </div>
  );
}
