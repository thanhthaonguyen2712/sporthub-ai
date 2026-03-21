"use client";
import { useSession, signOut } from "next-auth/react";
import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Navbar from "@/components/Navbar";
import { useTranslations } from "next-intl";


export default function ProfilePage() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const t = useTranslations("profile");
  const [active, setActive] = useState(searchParams.get("tab") || "info");
  const menuItems = [
  { id: "info", icon: "👤", label: t("info") },
  { id: "bookings", icon: "📋", label: t("bookings") },
  { id: "wallet", icon: "💰", label: t("wallet") },
  { id: "courses", icon: "🎓", label: t("courses") },
  { id: "membership", icon: "💎", label: t("membership") },
  { id: "vouchers", icon: "🎁", label: t("vouchers") },
  { id: "groups", icon: "👥", label: t("groups") },
  { id: "password", icon: "🔒", label: t("password") },
  { id: "settings", icon: "⚙️", label: t("settings") },
];
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/user/profile").then(r => r.json()).then(d => {
      if (d.avatar) setAvatarUrl(d.avatar);
    });
  }, []);

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/user/avatar", { method: "POST", body: form });
    const data = await res.json();
    setAvatarUploading(false);
    if (res.ok) setAvatarUrl(data.avatarUrl);
    else alert(data.error || "Upload thất bại");
  }

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);
  async function handleDeleteAccount() {
    if (!deletePassword) { setDeleteError("Vui lòng nhập mật khẩu!"); return; }
    setDeleting(true);
    const res = await fetch("/api/user/delete", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: deletePassword }),
    });
    const data = await res.json();
    setDeleting(false);
    if (res.ok) {
      signOut({ callbackUrl: "/" });
    } else {
      setDeleteError(data.error || "Có lỗi xảy ra!");
    }
  }
  return (
    <div className="min-h-screen" style={{ fontFamily: "Arial, sans-serif", background: "linear-gradient(to right, #DDEFBB, #FFEEEE)", color: "#000" }}>
      <Navbar />
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex gap-6">
          <aside className="w-64 flex-shrink-0">
            <div className="border border-gray-300 rounded-2xl p-5 mb-4 text-center" style={{ background: "#E0EEE0" }}>
              <div className="relative inline-block mb-3">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="avatar" className="w-20 h-20 rounded-full object-cover mx-auto border-2 border-emerald-300" />
                ) : (
                  <div className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center text-2xl font-bold mx-auto text-white">
                    {session?.user?.name?.[0]?.toUpperCase() || "U"}
                  </div>
                )}
                <button
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={avatarUploading}
                  className="absolute bottom-0 right-0 w-6 h-6 bg-gray-200 hover:bg-gray-300 rounded-full flex items-center justify-center text-xs border-2 border-white transition-colors disabled:opacity-50"
                  title="Thay ảnh đại diện"
                >
                  {avatarUploading ? "⏳" : "📷"}
                </button>
                <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
              </div>
              <p className="font-semibold text-black text-sm">{session?.user?.name}</p>
              <p className="text-gray-600 text-xs mt-0.5">{session?.user?.email}</p>
              <span className="inline-block mt-2 bg-emerald-100 text-emerald-700 text-xs px-2 py-0.5 rounded-full">
                {(session?.user as any)?.role || "CUSTOMER"}
              </span>
            </div>
            <nav className="border border-gray-300 rounded-2xl overflow-hidden" style={{ background: "#E0EEE0" }}>
              {menuItems.map((item, index) => (
                <button
                  key={item.id}
                  onClick={() => setActive(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors text-left
                    ${index !== 0 ? "border-t border-gray-300" : ""}
                    ${active === item.id ? "bg-emerald-100 text-emerald-700 font-medium" : "text-black hover:bg-blue-100"}`}>
                  <span>{item.icon}</span>
                  {item.label}
                </button>
              ))}
              <button onClick={() => signOut({ callbackUrl: "/" })}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-500 hover:bg-red-50 transition-colors border-t border-gray-300 text-left" >
                 {t("logout")}
              </button>
              <button onClick={() => setShowDeleteConfirm(true)}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-700 hover:bg-red-50 transition-colors border-t border-gray-300 text-left">
                {t("deleteAccount")}
              </button>
            </nav>
          </aside>

          <main className="flex-1 min-w-0">
            {active === "info" && <SectionInfo session={session} />}
            {active === "bookings" && <SectionBookings />}
            {active === "wallet" && <SectionWallet />}
            {active === "courses" && <SectionCourses />}
            {active === "membership" && <SectionMembership />}
            {active === "vouchers" && <SectionVouchers />}
            {active === "groups" && <SectionGroups />}
            {active === "password" && <SectionPassword />}
            {active === "settings" && <SectionSettings />}
          </main>
        </div>
      </div>
    {/* Popup xóa tài khoản */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl">
            <div className="text-center mb-4">
              <div className="text-4xl mb-2">⚠️</div>
              <h3 className="font-bold text-black text-lg">Xóa tài khoản</h3>
              <p className="text-gray-500 text-sm mt-1">Hành động này không thể hoàn tác! Tất cả dữ liệu sẽ bị xóa vĩnh viễn.</p>
            </div>
            <div className="mb-4">
              <label className="text-xs text-gray-600 mb-1.5 block font-medium">Nhập mật khẩu để xác nhận</label>
              <input
                type="password"
                value={deletePassword}
                onChange={(e) => { setDeletePassword(e.target.value); setDeleteError(""); }}
                placeholder="Nhập mật khẩu của bạn..."
                className="w-full bg-gray-50 border border-gray-300 text-black rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-red-400"
              />
              {deleteError && <p className="text-red-500 text-xs mt-1">{deleteError}</p>}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setShowDeleteConfirm(false); setDeletePassword(""); setDeleteError(""); }}
                className="flex-1 border border-gray-300 text-gray-600 py-2.5 rounded-xl text-sm hover:bg-gray-50 transition-colors">
                Hủy
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleting}
                className="flex-1 bg-red-500 hover:bg-red-400 disabled:bg-red-300 text-white py-2.5 rounded-xl text-sm font-medium transition-colors">
                {deleting ? "Đang xóa..." : "Xác nhận xóa"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── THÔNG TIN CÁ NHÂN ─── */
function SectionInfo({ session }: { session: any }) {
  const [editing, setEditing] = useState(false);
  const t = useTranslations("profile");
  const [form, setForm] = useState({ fullName: "", phone: "" });
  const [dob, setDob] = useState({ day: "", month: "", year: "" });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch("/api/user/profile")
      .then((r) => r.json())
      .then((data) => {
        setForm({ fullName: data.fullName || "", phone: data.phone || "" });
      });
  }, []);

  // Auto focus next input khi nhập đủ ký tự
  function handleDob(field: "day" | "month" | "year", value: string) {
    if (!/^\d*$/.test(value)) return;
    setDob((prev) => ({ ...prev, [field]: value }));
    if (field === "day" && value.length === 2) {
      document.getElementById("dob-month")?.focus();
    }
    if (field === "month" && value.length === 2) {
      document.getElementById("dob-year")?.focus();
    }
  }

  async function handleSave() {
    setSaving(true);
    const res = await fetch("/api/user/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName: form.fullName, phone: form.phone }),
    });
    const data = await res.json();
    setSaving(false);
    if (res.ok) {
      setMsg("✅ Lưu thành công!");
      setEditing(false);
      // Reload trang để cập nhật session
      setTimeout(() => window.location.reload(), 800);
    } else {
      setMsg(data.error || "Lỗi khi lưu!");
    }
    setTimeout(() => setMsg(""), 3000);
  }

  return (
    <div className="border border-gray-300 rounded-2xl p-6" style={{ background: "#E0EEE0" }}>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-black">{t("info")}</h2>
        <button onClick={() => setEditing(!editing)}
          className="text-sm text-emerald-600 hover:text-emerald-700 border border-emerald-400 px-3 py-1.5 rounded-lg transition-colors">
          {editing ? t("cancel") : t("edit")}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-gray-600 mb-1.5 block font-medium">Họ và tên</label>
          <input value={form.fullName} onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
            disabled={!editing} placeholder="Nhập họ tên"
            className="w-full bg-white border border-gray-300 text-black placeholder-gray-400 rounded-xl px-4 py-2.5 text-sm disabled:opacity-60 focus:outline-none focus:border-emerald-400 transition-all" />
        </div>
        <div>
          <label className="text-xs text-gray-600 mb-1.5 block font-medium">Email</label>
          <input value={session?.user?.email || ""} disabled
            className="w-full bg-white border border-gray-300 text-black rounded-xl px-4 py-2.5 text-sm opacity-60" />
        </div>
        <div>
          <label className="text-xs text-gray-600 mb-1.5 block font-medium">Số điện thoại</label>
          <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            disabled={!editing} placeholder="Nhập số điện thoại"
            className="w-full bg-white border border-gray-300 text-black placeholder-gray-400 rounded-xl px-4 py-2.5 text-sm disabled:opacity-60 focus:outline-none focus:border-emerald-400 transition-all" />
        </div>
        <div>
          <label className="text-xs text-gray-600 mb-1.5 block font-medium">Ngày sinh</label>
          <div className="flex gap-2">
            {/* Ngày */}
            <div className="flex-1">
              <input id="dob-day" value={dob.day}
                onChange={(e) => handleDob("day", e.target.value)}
                disabled={!editing} placeholder="DD" maxLength={2}
                className="w-full bg-white border border-gray-300 text-black text-center placeholder-gray-400 rounded-xl px-2 py-2.5 text-sm disabled:opacity-60 focus:outline-none focus:border-emerald-400 transition-all" />
              <p className="text-xs text-gray-400 text-center mt-0.5">Ngày</p>
            </div>
            <div className="flex items-start pt-2.5 text-gray-400">/</div>
            {/* Tháng */}
            <div className="flex-1">
              <input id="dob-month" value={dob.month}
                onChange={(e) => handleDob("month", e.target.value)}
                disabled={!editing} placeholder="MM" maxLength={2}
                className="w-full bg-white border border-gray-300 text-black text-center placeholder-gray-400 rounded-xl px-2 py-2.5 text-sm disabled:opacity-60 focus:outline-none focus:border-emerald-400 transition-all" />
              <p className="text-xs text-gray-400 text-center mt-0.5">Tháng</p>
            </div>
            <div className="flex items-start pt-2.5 text-gray-400">/</div>
            {/* Năm */}
            <div className="flex-[2]">
              <input id="dob-year" value={dob.year}
                onChange={(e) => handleDob("year", e.target.value)}
                disabled={!editing} placeholder="YYYY" maxLength={4}
                className="w-full bg-white border border-gray-300 text-black text-center placeholder-gray-400 rounded-xl px-2 py-2.5 text-sm disabled:opacity-60 focus:outline-none focus:border-emerald-400 transition-all" />
              <p className="text-xs text-gray-400 text-center mt-0.5">Năm</p>
            </div>
          </div>
        </div>
      </div>

      {msg && (
        <p className={`mt-3 text-sm px-3 py-2 rounded-lg ${msg.includes("✅") ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`}>
          {msg}
        </p>
      )}

      {editing && (
        <button onClick={handleSave} disabled={saving}
          className="mt-5 bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-300 text-white px-6 py-2.5 rounded-xl text-sm font-medium transition-colors">
          {saving ? t("saving") : t("save")}
        </button>
      )}
    </div>
  );
}

/* ─── LỊCH ĐẶT SÂN ─── */
function SectionBookings() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [filter, setFilter] = useState("Tất cả");
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [showConfirm, setShowConfirm] = useState<number | null>(null);
  const [toast, setToast] = useState("");

  function loadBookings() {
    fetch("/api/bookings/myschedule")
      .then((r) => r.json())
      .then((data) => { setBookings(Array.isArray(data) ? data : []); setLoading(false); });
  }
  useEffect(() => { loadBookings(); }, []);

  async function handleCancel(bookingId: number) {
    setCancellingId(bookingId);
    const res = await fetch(`/api/bookings/${bookingId}/cancel`, { method: "POST" });
    const data = await res.json();
    setCancellingId(null);
    setShowConfirm(null);
    setToast(res.ok ? data.message : data.error || "Hủy thất bại!");
    setTimeout(() => setToast(""), 4000);
    if (res.ok) loadBookings();
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const filtered = bookings.filter((b) => {
    const bookingDate = new Date(b.bookingDate);
    bookingDate.setHours(0, 0, 0, 0);
    if (filter === "Tất cả") return true;
    if (filter === "Sắp tới") return bookingDate >= today && (b.status === "CONFIRMED" || b.status === "PENDING");
    if (filter === "Đã hoàn thành") return b.status === "COMPLETED" || bookingDate < today;
    if (filter === "Đã hủy") return b.status === "CANCELLED";
    return true;
  });

  const statusLabel: Record<string, { label: string; color: string }> = {
    PENDING:   { label: "Chờ xác nhận", color: "bg-yellow-100 text-yellow-700" },
    CONFIRMED: { label: "Đã xác nhận",  color: "bg-emerald-100 text-emerald-700" },
    COMPLETED: { label: "Hoàn thành",   color: "bg-blue-100 text-blue-700" },
    CANCELLED: { label: "Đã hủy",       color: "bg-red-100 text-red-600" },
    NO_SHOW:   { label: "Không đến",    color: "bg-gray-100 text-gray-600" },
  };

  return (
    <div className="border border-gray-300 rounded-2xl p-6" style={{ background: "#E0EEE0" }}>
      <h2 className="text-lg font-semibold text-black mb-4">Lịch đặt sân</h2>
      <div className="flex gap-2 mb-5 flex-wrap">
        {["Tất cả", "Sắp tới", "Đã hoàn thành", "Đã hủy"].map((tab) => (
          <button key={tab} onClick={() => setFilter(tab)}
            className={`text-xs px-3 py-1.5 rounded-lg transition-colors border ${filter === tab ? "bg-emerald-100 text-emerald-700 border-emerald-300 font-medium" : "bg-white text-gray-600 border-gray-300 hover:bg-emerald-50"}`}>
            {tab}
          </button>
        ))}
      </div>
      {loading ? (
        <div className="space-y-3">{[1, 2].map((i) => <div key={i} className="h-24 bg-white/50 rounded-xl animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <div className="text-4xl mb-2">📋</div>
          <p className="text-sm">Chưa có lịch đặt sân nào</p>
          <a href="/" className="inline-block mt-3 text-emerald-600 text-sm hover:underline">Đặt sân ngay →</a>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((b) => (
            <div key={b.id} className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  {b.court.iconUrl && <img src={b.court.iconUrl} className="w-6 h-6" alt={b.court.category} />}
                  <div>
                    <p className="font-semibold text-black text-sm">{b.facility.name}</p>
                    <p className="text-gray-500 text-xs">{b.court.name} · {b.court.category}</p>
                  </div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${statusLabel[b.status]?.color}`}>
                  {statusLabel[b.status]?.label}
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs text-gray-600 mb-2">
                <span>📅 {new Date(b.bookingDate).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" })}</span>
                <span>🕐 {b.startTime} – {b.endTime}</span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-emerald-600 font-bold text-sm">{Number(b.totalPrice).toLocaleString("vi-VN")}đ</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">#{b.id}</span>
                  {(b.status === "CONFIRMED" || b.status === "PENDING") &&
                    (new Date().getTime() - new Date(b.createdAt).getTime()) / 60000 <= 60 && (
                      <button onClick={() => setShowConfirm(b.id)}
                        className="text-xs text-red-500 hover:text-red-700 border border-red-300 hover:border-red-500 px-2 py-0.5 rounded-lg transition-colors">
                        Hủy
                      </button>
                    )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-medium text-white ${toast.includes("thành công") || toast.includes("Hoàn") ? "bg-emerald-500" : "bg-red-500"}`}>
          {toast}
        </div>
      )}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl">
            <h3 className="font-bold text-black text-lg mb-2">Xác nhận hủy sân</h3>
            <p className="text-gray-600 text-sm mb-1">Bạn có chắc muốn hủy lịch đặt sân này?</p>
            <p className="text-emerald-600 text-xs mb-5">✅ Tiền sẽ được hoàn về ví SportHub ngay lập tức.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowConfirm(null)} className="flex-1 border border-gray-300 text-gray-600 py-2.5 rounded-xl text-sm hover:bg-gray-50 transition-colors">Không hủy</button>
              <button onClick={() => handleCancel(showConfirm)} disabled={cancellingId === showConfirm}
                className="flex-1 bg-red-500 hover:bg-red-400 disabled:bg-red-300 text-white py-2.5 rounded-xl text-sm font-medium transition-colors">
                {cancellingId === showConfirm ? "Đang hủy..." : "Xác nhận hủy"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── VÍ SPORTHUB ─── */
function SectionWallet() {
  const [wallet, setWallet] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [showTopup, setShowTopup] = useState(false);
  const [topupAmount, setTopupAmount] = useState("");
  const [topuping, setTopuping] = useState(false);
  const [withdrawForm, setWithdrawForm] = useState({ amount: "", bankName: "", accountNumber: "", accountName: "", saveBank: false });
  const [savedBanks, setSavedBanks] = useState<any[]>([]);
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawMsg, setWithdrawMsg] = useState("");
  const [txFilter, setTxFilter] = useState("Tất cả");

  useEffect(() => {
    fetch("/api/wallet/detail").then((r) => r.json()).then((data) => {
      setWallet(data.wallet);
      setTransactions(data.transactions || []);
      setLoading(false);
    });
    fetch("/api/wallet/banks").then((r) => r.json()).then((data) => setSavedBanks(Array.isArray(data) ? data : []));
  }, []);

  const typeLabel: Record<string, { label: string; color: string; sign: string }> = {
    DEPOSIT:  { label: "Nạp tiền",   color: "text-emerald-600", sign: "+" },
    PAYMENT:  { label: "Thanh toán", color: "text-red-500",     sign: "-" },
    REFUND:   { label: "Hoàn tiền",  color: "text-emerald-600", sign: "+" },
    WITHDRAW: { label: "Rút tiền",   color: "text-red-500",     sign: "-" },
  };
  async function handleTopup() {
    if (!topupAmount || Number(topupAmount) <= 0) return;
    setTopuping(true);
    const amount = Number(topupAmount) * 1000;
    const res = await fetch("/api/wallet/topup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount }),
    });
    const data = await res.json();
    setTopuping(false);
    if (res.ok) {
      setWallet((w: any) => ({ ...w, balance: Number(w.balance) + amount }));
      setTransactions((prev) => [data.transaction, ...prev]);
      setTopupAmount("");
      setShowTopup(false);
    }
  }

  async function handleWithdraw() {
    if (!withdrawForm.amount || !withdrawForm.bankName || !withdrawForm.accountNumber || !withdrawForm.accountName) {
      setWithdrawMsg("Vui lòng điền đầy đủ thông tin!"); return;
    }
    setWithdrawing(true);
    const res = await fetch("/api/wallet/withdraw", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: Number(withdrawForm.amount)* 1000, bankName: withdrawForm.bankName, accountNumber: withdrawForm.accountNumber, accountName: withdrawForm.accountName, saveBank: withdrawForm.saveBank }),
    });
    const data = await res.json();
    setWithdrawing(false);
    if (res.ok) {
      setWithdrawMsg(data.message);
      setWallet((w: any) => ({ ...w, balance: Number(w.balance) - Number(withdrawForm.amount) }));
      setWithdrawForm({ amount: "", bankName: "", accountNumber: "", accountName: "", saveBank: false });
      setShowWithdraw(false);
      fetch("/api/wallet/detail").then((r) => r.json()).then((d) => setTransactions(d.transactions || []));
      setTimeout(() => setWithdrawMsg(""), 4000);
    } else {
      setWithdrawMsg(data.error || "Rút tiền thất bại!");
    }
  }

  return (
    <div className="space-y-4">
      {/* Card số dư */}
      <div className="border border-gray-300 rounded-2xl p-6" style={{ background: "#E0EEE0" }}>
        <h2 className="text-lg font-semibold text-black mb-4">💰 Ví SportHub</h2>
        {loading ? (
          <div className="h-16 bg-white/50 rounded-xl animate-pulse" />
        ) : (
          <div className="bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-2xl p-5 text-white">
            <p className="text-sm opacity-80 mb-1">Số dư hiện tại</p>
            <p className="text-3xl font-bold">{Number(wallet?.balance || 0).toLocaleString("vi-VN")}đ</p>
            <span className={`inline-block mt-3 text-xs px-2 py-0.5 rounded-full ${wallet?.status === "ACTIVE" ? "bg-white/20" : "bg-red-300/40"}`}>
              {wallet?.status === "ACTIVE" ? "✅ Hoạt động" : "🔒 Bị khóa"}
            </span>
          </div>
        )}

        {/* 2 button lớn */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button onClick={() => setShowTopup(true)}
            className="flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white font-semibold py-3 rounded-xl transition-colors text-sm">
             Nạp tiền
          </button>
          <button onClick={() => setShowWithdraw(true)}
            className="flex items-center justify-center gap-2 bg-white border border-red-300 text-red-500 hover:bg-red-50 font-semibold py-3 rounded-xl transition-colors text-sm">
             Rút tiền
          </button>
        </div>

        {withdrawMsg && (
          <div className={`mt-3 text-xs px-3 py-2 rounded-lg ${withdrawMsg.includes("thành công") ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`}>
            {withdrawMsg}
          </div>
        )}
      </div>
      {/* Lịch sử giao dịch */}
      <div className="border border-gray-300 rounded-2xl p-6" style={{ background: "#E0EEE0" }}>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h2 className="text-lg font-semibold text-black">📜 Lịch sử giao dịch</h2>
          <div className="flex gap-2 flex-wrap">
            {["Tất cả", "Nạp tiền", "Thanh toán", "Hoàn tiền", "Rút tiền"].map((tab) => (
              <button key={tab} onClick={() => setTxFilter(tab)}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                  txFilter === tab
                    ? "bg-emerald-100 text-emerald-700 border-emerald-300 font-medium"
                    : "bg-white text-gray-600 border-gray-300 hover:bg-emerald-50"
                }`}>
                {tab}
              </button>
            ))}
          </div>
        </div>
        {loading ? (
          <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-14 bg-white/50 rounded-xl animate-pulse" />)}</div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-10 text-gray-500">
            <div className="text-4xl mb-2">📭</div>
            <p className="text-sm">Chưa có giao dịch nào</p>
          </div>
        ) : (
          <div className="space-y-2">
            {transactions
              .filter((t) => {
                if (txFilter === "Tất cả") return true;
                if (txFilter === "Nạp tiền") return t.type === "DEPOSIT";
                if (txFilter === "Thanh toán") return t.type === "PAYMENT";
                if (txFilter === "Hoàn tiền") return t.type === "REFUND";
                if (txFilter === "Rút tiền") return t.type === "WITHDRAW";
                return true;
              })
              .map((t) => (
                <div key={t.id} className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-black">{typeLabel[t.type]?.label || t.type}</p>
                    {t.description && <p className="text-xs text-gray-500 mt-0.5">{t.description}</p>}
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(t.createdAt).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  <span className={`font-bold text-sm ${typeLabel[t.type]?.color}`}>
                    {typeLabel[t.type]?.sign}{Number(t.amount).toLocaleString("vi-VN")}đ
                  </span>
                </div>
              ))}
          </div>
        )}
      </div>
      {/* Popup nạp tiền */}
      {showTopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl">
            <h3 className="font-bold text-black text-lg mb-4">💰 Nạp tiền vào ví</h3>

            {/* Hiển thị số tiền */}
            <div className="bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-center mb-3">
              <p className="text-2xl font-bold text-black">
                {topupAmount ? (Number(topupAmount) * 1000).toLocaleString("vi-VN") : "0"}đ
              </p>
              <p className="text-xs text-gray-400 mt-1">Số dư hiện tại: {Number(wallet?.balance || 0).toLocaleString("vi-VN")}đ</p>
            </div>

            {/* Numpad */}
            <div className="grid grid-cols-3 gap-2 mb-2">
              {["1","2","3","4","5","6","7","8","9","⌫","0","✓"].map((key) => (
                <button key={key} type="button"
                  onClick={() => {
                    if (key === "⌫") setTopupAmount((v) => v.slice(0, -1));
                    else if (key === "✓") {}
                    else {
                      if (topupAmount.length >= 6) return;
                      setTopupAmount((v) => v + key);
                    }
                  }}
                  className={`py-3 rounded-xl text-sm font-semibold transition-colors border ${
                    key === "⌫" ? "bg-red-50 border-red-200 text-red-500 hover:bg-red-100"
                    : key === "✓" ? "bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100"
                    : "bg-white border-gray-200 text-black hover:bg-gray-50"
                  }`}>
                  {key}
                </button>
              ))}
            </div>

            {/* Phím tắt */}
            <div className="grid grid-cols-4 gap-1.5 mb-4">
              {[50, 100, 200, 500].map((val) => (
                <button key={val} type="button"
                  onClick={() => setTopupAmount(String(val))}
                  className="py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-lg hover:bg-emerald-100 transition-colors font-medium">
                  {val}k
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-2">
                <button
                  disabled={!topupAmount}
                  onClick={async () => {
                    if (!topupAmount) return;
                    const amount = Number(topupAmount) * 1000;
                    const res = await fetch("/api/payment/vnpay", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        amount,
                        orderInfo: `Nap tien vi SportHub`,
                        bookingData: { isTopup: true },
                      }),
                    });
                    const data = await res.json();
                    if (data.payUrl) {
                      window.location.href = data.payUrl;
                    } else {
                      alert(data.error || "Lỗi kết nối VNPay!");
                    }
                  }}
                  className="w-full bg-blue-500 hover:bg-blue-400 disabled:bg-blue-300 text-white py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2">
                  <img src="/vnpay.png" className="w-5 h-5 object-contain" alt="VNPay" />
                  Nạp tiền qua VNPay
                </button>
              <button onClick={() => { setShowTopup(false); setTopupAmount(""); }}
                className="w-full border border-gray-300 text-gray-600 py-2.5 rounded-xl text-sm hover:bg-gray-50 transition-colors">
                Hủy
              </button>
            </div>

            
          </div>
        </div>
      )}
      {/* Popup rút tiền */}
      {showWithdraw && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-black text-lg mb-4">🏦 Rút tiền về ngân hàng</h3>
            {savedBanks.length > 0 && (
              <div className="mb-4">
                <p className="text-xs text-gray-500 mb-2">Tài khoản đã lưu:</p>
                <div className="space-y-2">
                  {savedBanks.map((b) => (
                    <button key={b.id}
                      onClick={() => setWithdrawForm((f) => ({ ...f, bankName: b.bankName, accountNumber: b.accountNumber, accountName: b.accountName }))}
                      className="w-full text-left bg-gray-50 border border-gray-200 hover:border-emerald-400 rounded-xl px-4 py-2.5 text-sm transition-colors">
                      <p className="font-medium text-black">{b.bankName} - {b.accountNumber}</p>
                      <p className="text-xs text-gray-500">{b.accountName}</p>
                    </button>
                  ))}
                </div>
                <div className="border-t border-gray-200 my-3" />
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-600 mb-1 block font-medium">Số tiền rút (đ)</label>
                {/* Hiển thị số tiền */}
                <div className="bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-center mb-3">
                  <p className="text-2xl font-bold text-black">
                    {withdrawForm.amount
                      ? (Number(withdrawForm.amount) * 1000).toLocaleString("vi-VN")
                      : "0"}đ
                  </p>
                  <p className="text-xs text-gray-400 mt-1">Số dư: {Number(wallet?.balance || 0).toLocaleString("vi-VN")}đ</p>
                </div>

                {/* Numpad */}
                <div className="grid grid-cols-3 gap-2 mb-2">
                  {["1","2","3","4","5","6","7","8","9","⌫","0","✓"].map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        if (key === "⌫") {
                          setWithdrawForm((f) => ({ ...f, amount: f.amount.slice(0, -1) }));
                        } else if (key === "✓") {
                          // xác nhận số
                        } else {
                          if (withdrawForm.amount.length >= 6) return; // tối đa 999.999k
                          setWithdrawForm((f) => ({ ...f, amount: f.amount + key }));
                        }
                      }}
                      className={`py-3 rounded-xl text-sm font-semibold transition-colors border ${
                        key === "⌫" ? "bg-red-50 border-red-200 text-red-500 hover:bg-red-100"
                        : key === "✓" ? "bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100"
                        : "bg-white border-gray-200 text-black hover:bg-gray-50"
                      }`}
                    >
                      {key}
                    </button>
                  ))}
                </div>
                {/* Phím tắt */}
                <div className="grid grid-cols-4 gap-1.5">
                  {[50, 100, 200, 500].map((val) => (
                    <button key={val} type="button"
                      onClick={() => setWithdrawForm((f) => ({ ...f, amount: String(val) }))}
                      className="py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-lg hover:bg-emerald-100 transition-colors font-medium">
                      {val}k
                    </button>
                  ))}
                </div>
              </div>
              <div>
                  <label className="text-xs text-gray-600 mb-1 block font-medium">Ngân hàng</label>
                  <select value={withdrawForm.bankName}
                    onChange={(e) => setWithdrawForm((f) => ({ ...f, bankName: e.target.value }))}
                    className="w-full bg-gray-50 border border-gray-300 text-black rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-400">
                    <option value="">Chọn ngân hàng...</option>
                    {["Vietcombank", "Techcombank", "MB Bank", "BIDV", "Agribank", "VPBank", "ACB", "Sacombank", "TPBank", "VIB"].map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
              </div>
              <div>
                  <label className="text-xs text-gray-600 mb-1 block font-medium">Số tài khoản</label>
                  <input type="text" value={withdrawForm.accountNumber}
                    onChange={(e) => setWithdrawForm((f) => ({ ...f, accountNumber: e.target.value }))}
                    placeholder="Nhập số tài khoản..."
                    className="w-full bg-gray-50 border border-gray-300 text-black rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-400" />
              </div>
              <div>
                  <label className="text-xs text-gray-600 mb-1 block font-medium">Tên chủ tài khoản</label>
                  <input type="text" value={withdrawForm.accountName}
                    onChange={(e) => setWithdrawForm((f) => ({ ...f, accountName: e.target.value.toUpperCase() }))}
                    placeholder="NGUYEN VAN A..."
                    className="w-full bg-gray-50 border border-gray-300 text-black rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-400" />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                  <input type="checkbox" checked={withdrawForm.saveBank}
                    onChange={(e) => setWithdrawForm((f) => ({ ...f, saveBank: e.target.checked }))}
                    className="accent-emerald-500" />
                  Lưu tài khoản này để dùng lần sau
              </label>
            </div>
            {withdrawMsg && (
              <p className="text-xs text-red-500 mt-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{withdrawMsg}</p>
            )}

            <div className="flex gap-3 mt-5">
              <button onClick={() => { setShowWithdraw(false); setWithdrawMsg(""); }}
                className="flex-1 border border-gray-300 text-gray-600 py-2.5 rounded-xl text-sm hover:bg-gray-50 transition-colors">
                Hủy
              </button>
              <button onClick={handleWithdraw} disabled={withdrawing}
                className="flex-1 bg-red-500 hover:bg-red-400 disabled:bg-red-300 text-white py-2.5 rounded-xl text-sm font-medium transition-colors">
                {withdrawing ? "Đang xử lý..." : "Xác nhận rút tiền"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── KHÓA HỌC ─── */
function SectionCourses() {
  const [tab, setTab] = useState<"mine" | "public">("mine");
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({
    title: "", description: "", sport: "", level: "BEGINNER",
    price: "", maxStudents: "10", schedule: "",
    startDate: "", endDate: "", isPublic: true,
  });

  useEffect(() => {
    setLoading(true);
    fetch(`/api/courses?type=${tab}`)
      .then((r) => r.json())
      .then((data) => { setCourses(Array.isArray(data) ? data : []); setLoading(false); });
  }, [tab]);

  async function handleEnroll(courseId: number) {
    setEnrolling(true);
    const res = await fetch("/api/courses/enroll", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseId, paymentMethod: "WALLET" }),
    });
    const data = await res.json();
    setEnrolling(false);
    setMsg(res.ok ? data.message : data.error);
    setTimeout(() => setMsg(""), 3000);
    if (res.ok) {
      setSelected(null);
      fetch(`/api/courses?type=${tab}`).then((r) => r.json()).then((d) => setCourses(Array.isArray(d) ? d : []));
    }
  }

  async function handleCreate() {
    const res = await fetch("/api/courses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, price: Number(form.price), maxStudents: Number(form.maxStudents) }),
    });
    const data = await res.json();
    if (res.ok) {
      setShowCreate(false);
      setForm({ title: "", description: "", sport: "", level: "BEGINNER", price: "", maxStudents: "10", schedule: "", startDate: "", endDate: "", isPublic: true });
      fetch(`/api/courses?type=public`).then((r) => r.json()).then((d) => setCourses(Array.isArray(d) ? d : []));
      setMsg("✅ Tạo khóa học thành công!");
      setTimeout(() => setMsg(""), 3000);
    } else {
      setMsg(data.error);
    }
  }

  const levelLabel: Record<string, string> = {
    BEGINNER: "Người mới", INTERMEDIATE: "Trung bình", PRO: "Chuyên nghiệp"
  };

  return (
    <div className="space-y-4">
      {msg && (
        <div className={`px-4 py-2 rounded-xl text-sm ${msg.includes("✅") || msg.includes("thành công") ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`}>
          {msg}
        </div>
      )}

      <div className="border border-gray-300 rounded-2xl p-6" style={{ background: "#E0EEE0" }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-black">Khóa học</h2>
          <button onClick={() => setShowCreate(true)}
            className="bg-emerald-500 hover:bg-emerald-400 text-white text-sm px-4 py-2 rounded-xl transition-colors">
            + Tạo khóa học
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-5">
          {[{ key: "mine", label: "📚 Khóa học của tôi" }, { key: "public", label: "🌐 Khóa học đang mở" }].map((t) => (
            <button key={t.key} onClick={() => setTab(t.key as any)}
              className={`text-sm px-4 py-2 rounded-xl border transition-colors ${tab === t.key ? "bg-emerald-100 text-emerald-700 border-emerald-300 font-medium" : "bg-white text-gray-600 border-gray-300 hover:bg-emerald-50"}`}>
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-3">{[1,2].map((i) => <div key={i} className="h-20 bg-white/50 rounded-xl animate-pulse" />)}</div>
        ) : courses.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <div className="text-4xl mb-2">📚</div>
            <p className="text-sm">{tab === "mine" ? "Bạn chưa đăng ký khóa học nào" : "Chưa có khóa học nào"}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {courses.map((item) => {
              const course = tab === "mine" ? item.course : item;
              const enrollment = tab === "mine" ? item : null;
              if (!course) return null;
              return (
                <div key={item.id} onClick={() => setSelected({ course, enrollment })}
                  className="bg-white border border-gray-200 hover:border-emerald-400 rounded-xl p-4 cursor-pointer transition-colors">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-semibold text-black text-sm">{course.title}</p>
                      <p className="text-gray-500 text-xs mt-0.5">🏸 {course.sport} · {levelLabel[course.level]}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      enrollment?.status === "ACTIVE" ? "bg-emerald-100 text-emerald-700"
                      : enrollment?.status === "COMPLETED" ? "bg-blue-100 text-blue-700"
                      : "bg-gray-100 text-gray-600"
                    }`}>
                      {enrollment ? (enrollment.status === "ACTIVE" ? "Đang học" : enrollment.status === "COMPLETED" ? "Hoàn thành" : "Chờ xử lý") : `${course._count?.enrollments || 0}/${course.maxStudents} học viên`}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>👨‍🏫 {course.coach?.fullName}</span>
                    <span className="text-emerald-600 font-bold">{Number(course.price).toLocaleString("vi-VN")}đ</span>
                  </div>
                  {enrollment && enrollment.progress > 0 && (
                    <div className="mt-2">
                      <div className="h-1.5 bg-gray-200 rounded-full">
                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${enrollment.progress}%` }} />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Popup chi tiết khóa học */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between mb-4">
              <h3 className="font-bold text-black text-lg">{selected.course.title}</h3>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-black text-xl">✕</button>
            </div>

            <div className="space-y-2 text-sm mb-4">
              <div className="flex justify-between"><span className="text-gray-500">Môn</span><span className="font-medium">{selected.course.sport} · {levelLabel[selected.course.level]}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Lịch học</span><span className="font-medium">{selected.course.schedule}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Bắt đầu</span><span className="font-medium">{new Date(selected.course.startDate).toLocaleDateString("vi-VN")}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Kết thúc</span><span className="font-medium">{new Date(selected.course.endDate).toLocaleDateString("vi-VN")}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Học phí</span><span className="font-bold text-emerald-600">{Number(selected.course.price).toLocaleString("vi-VN")}đ</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Sĩ số</span><span className="font-medium">{selected.course._count?.enrollments || 0}/{selected.course.maxStudents}</span></div>
              {selected.course.facility && (
                <div className="flex justify-between"><span className="text-gray-500">Địa điểm</span><span className="font-medium text-right">{selected.course.facility.name}</span></div>
              )}
            </div>

            {/* Thông tin HLV */}
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 mb-4">
              <p className="text-xs text-gray-500 mb-1">👨‍🏫 Huấn luyện viên</p>
              <p className="font-semibold text-black text-sm">{selected.course.coach?.fullName}</p>
              <p className="text-xs text-gray-500">{selected.course.coach?.phone} · {selected.course.coach?.email}</p>
            </div>

            {selected.course.description && (
              <p className="text-sm text-gray-600 mb-4">{selected.course.description}</p>
            )}

            {/* Nút đăng ký nếu chưa đăng ký */}
            {!selected.enrollment && (
              <div className="flex gap-2">
                <button onClick={() => setSelected(null)}
                  className="flex-1 border border-gray-300 text-gray-600 py-2.5 rounded-xl text-sm hover:bg-gray-50 transition-colors">
                  Đóng
                </button>
                <button onClick={() => handleEnroll(selected.course.id)} disabled={enrolling}
                  className="flex-1 bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-300 text-white py-2.5 rounded-xl text-sm font-medium transition-colors">
                  {enrolling ? "Đang đăng ký..." : "💰 Đăng ký ngay"}
                </button>
              </div>
            )}
            {selected.enrollment && (
              <button onClick={() => setSelected(null)}
                className="w-full border border-gray-300 text-gray-600 py-2.5 rounded-xl text-sm hover:bg-gray-50 transition-colors">
                Đóng
              </button>
            )}
          </div>
        </div>
      )}

      {/* Popup tạo khóa học */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-black text-lg mb-4">+ Tạo khóa học mới</h3>
            <div className="space-y-3">
              {[
                { label: "Tên khóa học", key: "title", placeholder: "VD: Khóa cầu lông cơ bản" },
                { label: "Môn thể thao", key: "sport", placeholder: "VD: Cầu lông" },
                { label: "Lịch học", key: "schedule", placeholder: "VD: T2, T4, T6 - 07:00" },
                { label: "Học phí (đ)", key: "price", placeholder: "VD: 500000" },
                { label: "Số học viên tối đa", key: "maxStudents", placeholder: "10" },
              ].map((f) => (
                <div key={f.key}>
                  <label className="text-xs text-gray-600 mb-1 block font-medium">{f.label}</label>
                  <input value={(form as any)[f.key]}
                    onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    className="w-full bg-gray-50 border border-gray-300 text-black rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-400" />
                </div>
              ))}

              <div>
                <label className="text-xs text-gray-600 mb-1 block font-medium">Trình độ</label>
                <select value={form.level} onChange={(e) => setForm((p) => ({ ...p, level: e.target.value }))}
                  className="w-full bg-gray-50 border border-gray-300 text-black rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-400">
                  <option value="BEGINNER">Người mới</option>
                  <option value="INTERMEDIATE">Trung bình</option>
                  <option value="PRO">Chuyên nghiệp</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-600 mb-1 block font-medium">Ngày bắt đầu</label>
                  <input type="date" value={form.startDate}
                    onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))}
                    className="w-full bg-gray-50 border border-gray-300 text-black rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-400" />
                </div>
                <div>
                  <label className="text-xs text-gray-600 mb-1 block font-medium">Ngày kết thúc</label>
                  <input type="date" value={form.endDate}
                    onChange={(e) => setForm((p) => ({ ...p, endDate: e.target.value }))}
                    className="w-full bg-gray-50 border border-gray-300 text-black rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-400" />
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-600 mb-1 block font-medium">Mô tả</label>
                <textarea value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  placeholder="Mô tả về khóa học..."
                  rows={3}
                  className="w-full bg-gray-50 border border-gray-300 text-black rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-400 resize-none" />
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                <input type="checkbox" checked={form.isPublic}
                  onChange={(e) => setForm((p) => ({ ...p, isPublic: e.target.checked }))}
                  className="accent-emerald-500" />
                Công khai (hiển thị cho mọi người)
              </label>
            </div>

            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowCreate(false)}
                className="flex-1 border border-gray-300 text-gray-600 py-2.5 rounded-xl text-sm hover:bg-gray-50 transition-colors">
                Hủy
              </button>
              <button onClick={handleCreate}
                className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-white py-2.5 rounded-xl text-sm font-medium transition-colors">
                Tạo khóa học
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
/* ─── GÓI HỘI VIÊN ─── */
function SectionMembership() {
  const [membership, setMembership] = useState<any>({ tier: "FREE" });
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch("/api/membership")
      .then((r) => r.json())
      .then((data) => { setMembership(data); setLoading(false); });
  }, []);

  async function handleUpgrade(tier: string) {
    if (!confirm(`Xác nhận nâng cấp lên gói ${tier}? Học phí sẽ trừ từ ví SportHub.`)) return;
    setUpgrading(tier);
    const res = await fetch("/api/membership", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier }),
    });
    const data = await res.json();
    setUpgrading("");
    setMsg(res.ok ? `✅ ${data.message}` : data.error);
    if (res.ok) {
      setMembership((m: any) => ({ ...m, tier, status: "ACTIVE" }));
    }
    setTimeout(() => setMsg(""), 4000);
  }
  async function handleCancel() {
  if (!confirm("Xác nhận hủy gói hội viên? Bạn sẽ về gói FREE ngay lập tức.")) return;
  const res = await fetch("/api/membership", { method: "DELETE" });
  const data = await res.json();
  setMsg(res.ok ? `✅ ${data.message}` : data.error);
  if (res.ok) setMembership((m: any) => ({ ...m, tier: "FREE", status: "CANCELLED" }));
  setTimeout(() => setMsg(""), 4000);
}

  const tiers = [
    { name: "SILVER", label: "Silver", price: "199.000đ/tháng", icon: "🥈", color: "from-gray-100 to-gray-200", perks: ["Giảm 10% khi đặt sân", "Ưu tiên đặt giờ cao điểm"] },
    { name: "GOLD", label: "Gold", price: "399.000đ/tháng", icon: "🥇", color: "from-yellow-50 to-yellow-100", perks: ["Giảm 20% khi đặt sân", "1 buổi PT miễn phí/tháng"] },
    { name: "PLATINUM", label: "Platinum", price: "699.000đ/tháng", icon: "💎", color: "from-blue-50 to-purple-100", perks: ["Giảm 30% khi đặt sân", "Không giới hạn PT"] },
  ];

  const tierColors: Record<string, string> = {
    FREE: "text-gray-600", SILVER: "text-gray-500", GOLD: "text-yellow-600", PLATINUM: "text-purple-600"
  };
  function getEffectiveTier(membership: any) {
  if (!membership || membership.tier === "FREE") return "FREE";
  // Nếu đã hết hạn → FREE
  if (membership.endDate && new Date(membership.endDate) < new Date()) return "FREE";
  return membership.tier;
}

  return (
    <div className="border border-gray-300 rounded-2xl p-6" style={{ background: "#E0EEE0" }}>
      <h2 className="text-lg font-semibold text-black mb-4">Gói hội viên</h2>

      {msg && (
        <div className={`mb-4 px-4 py-2 rounded-xl text-sm ${msg.includes("✅") ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`}>
          {msg}
        </div>
      )}

      {/* Gói hiện tại */}
      <div className="bg-gradient-to-br from-emerald-50 to-blue-50 border border-emerald-200 rounded-xl p-5 mb-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 mb-1">Gói hiện tại</p>
            <p className={`text-2xl font-bold ${tierColors[getEffectiveTier(membership)]}`}>
              {getEffectiveTier(membership)}
            </p>
            {membership?.endDate && membership.tier !== "FREE" && (
              <p className="text-xs text-gray-500 mt-1">
                Hết hạn: {new Date(membership.endDate).toLocaleDateString("vi-VN")}
              </p>
            )}
            {getEffectiveTier(membership) !== "FREE" && (
              <div className="mt-2">
                {membership?.status === "CANCELLED" ? (
                  <span className="text-xs text-orange-500">⚠️ Đã hủy gia hạn — còn hiệu lực đến {new Date(membership.endDate).toLocaleDateString("vi-VN")}</span>
                ) : (
                  <button onClick={handleCancel}
                    className="text-xs text-red-500 hover:text-red-700 underline transition-colors">
                    Hủy gia hạn tự động
                  </button>
                )}
              </div>
            )}
          </div>
          <span className="text-4xl">
            {membership?.tier === "SILVER" ? "🥈" : membership?.tier === "GOLD" ? "🥇" : membership?.tier === "PLATINUM" ? "💎" : "🥉"}
          </span>
        </div>
      </div>

      {/* Các gói */}
      <div className="grid grid-cols-3 gap-3">
        {tiers.map((pkg) => {
          const isCurrent = membership?.tier === pkg.name;
          return (
            <div key={pkg.name} className={`bg-gradient-to-br ${pkg.color} border rounded-xl p-4 text-center ${isCurrent ? "border-emerald-400" : "border-gray-200"}`}>
              <div className="text-2xl mb-2">{pkg.icon}</div>
              <p className="font-semibold text-sm text-black mb-1">{pkg.label}</p>
              <p className="text-emerald-600 text-xs mb-3">{pkg.price}</p>
              {pkg.perks.map((p) => <p key={p} className="text-gray-500 text-xs mb-1">✓ {p}</p>)}
              <button
                onClick={() => handleUpgrade(pkg.name)}
                disabled={isCurrent || upgrading === pkg.name}
                className={`mt-3 w-full text-xs py-2 rounded-lg transition-colors ${
                  isCurrent
                    ? "bg-emerald-100 text-emerald-700 cursor-default"
                    : "bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-300 text-white"
                }`}>
                {isCurrent ? "✅ Đang dùng" : upgrading === pkg.name ? "Đang xử lý..." : "Nâng cấp"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── ƯU ĐÃI ─── */
function SectionVouchers() {
  const [vouchers, setVouchers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch("/api/vouchers/mine")
      .then((r) => r.json())
      .then((data) => { setVouchers(Array.isArray(data) ? data : []); setLoading(false); });
  }, []);

  async function handleApply(code: string) {
    window.location.href = `/?voucher=${code}`;
  }

  const now = new Date();

  return (
    <div className="border border-gray-300 rounded-2xl p-6" style={{ background: "#E0EEE0" }}>
      <h2 className="text-lg font-semibold text-black mb-4">Ưu đãi của tôi</h2>

      {msg && (
        <div className={`mb-4 px-4 py-2 rounded-xl text-sm ${msg.includes("✅") ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`}>
          {msg}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">{[1,2].map((i) => <div key={i} className="h-16 bg-white/50 rounded-xl animate-pulse" />)}</div>
      ) : vouchers.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <div className="text-4xl mb-2">🎁</div>
          <p className="text-sm">Bạn chưa có voucher nào</p>
        </div>
      ) : (
        <div className="space-y-3">
          {vouchers.map((v) => {
            const isExpired = new Date(v.endDate) < now || v.usedCount >= v.usageLimit || !v.isActive;
            return (
              <div key={v.id} className={`flex items-center justify-between border rounded-xl p-4 ${isExpired ? "opacity-50 border-gray-300 bg-gray-100" : "border-emerald-200 bg-white"}`}>
                <div>
                  <p className="font-mono font-bold text-emerald-600 text-sm">{v.code}</p>
                  <p className="text-gray-700 text-xs mt-0.5">
                    {v.discountType === "PERCENT" ? `Giảm ${v.discountValue}%` : `Giảm ${Number(v.discountValue).toLocaleString("vi-VN")}đ`}
                    {v.minOrderValue > 0 && ` - Đơn tối thiểu ${Number(v.minOrderValue).toLocaleString("vi-VN")}đ`}
                  </p>
                  <p className="text-gray-400 text-xs mt-0.5">HSD: {new Date(v.endDate).toLocaleDateString("vi-VN")}</p>
                </div>
                <button
                  disabled={isExpired}
                  onClick={() => {
                    navigator.clipboard.writeText(v.code);
                    setMsg(`✅ Đã copy mã ${v.code}!`);
                    setTimeout(() => setMsg(""), 2000);
                  }}
                  className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${isExpired ? "bg-gray-200 text-gray-500 cursor-not-allowed" : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"}`}>
                  {isExpired ? "Hết hạn" : "📋 Copy mã"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── NHÓM ─── */
function SectionGroups() {
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showDetail, setShowDetail] = useState<any | null>(null);
  const [groupName, setGroupName] = useState("");
  const [groupDesc, setGroupDesc] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [creating, setCreating] = useState(false);
  const { data: session } = useSession();

  function loadGroups() {
    fetch("/api/groups")
      .then((r) => r.json())
      .then((data) => { setGroups(Array.isArray(data) ? data : []); setLoading(false); });
  }

  useEffect(() => { loadGroups(); }, []);

  async function handleCreate() {
    if (!groupName) { setMsg("Vui lòng nhập tên nhóm!"); return; }
    setCreating(true);
    const res = await fetch("/api/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: groupName, description: groupDesc }),
    });
    const data = await res.json();
    setCreating(false);
    if (res.ok) {
      setShowCreate(false);
      setGroupName(""); setGroupDesc("");
      loadGroups();
      setMsg("✅ Tạo nhóm thành công!");
    } else {
      setMsg(data.error);
    }
    setTimeout(() => setMsg(""), 3000);
  }

  async function handleInvite(groupId: number) {
    if (!inviteEmail) return;
    const res = await fetch(`/api/groups/${groupId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: inviteEmail }),
    });
    const data = await res.json();
    setMsg(res.ok ? `✅ ${data.message}` : data.error);
    if (res.ok) {
      setInviteEmail("");
      // Reload group detail
      fetch("/api/groups").then((r) => r.json()).then((d) => {
        setGroups(Array.isArray(d) ? d : []);
        const updated = d.find((g: any) => g.id === groupId);
        if (updated) setShowDetail(updated);
      });
    }
    setTimeout(() => setMsg(""), 3000);
  }

  async function handleRemove(groupId: number, userId: number) {
    const res = await fetch(`/api/groups/${groupId}/members`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    if (res.ok) {
      fetch("/api/groups").then((r) => r.json()).then((d) => {
        setGroups(Array.isArray(d) ? d : []);
        const updated = d.find((g: any) => g.id === groupId);
        if (updated) setShowDetail(updated);
        else setShowDetail(null);
      });
    }
  }

  const myId = Number((session?.user as any)?.id);

  return (
    <div className="border border-gray-300 rounded-2xl p-6" style={{ background: "#E0EEE0" }}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-black">Nhóm của tôi</h2>
        <button onClick={() => setShowCreate(true)}
          className="bg-emerald-500 hover:bg-emerald-400 text-white text-sm px-4 py-2 rounded-xl transition-colors">
          + Tạo nhóm
        </button>
      </div>

      {msg && (
        <div className={`mb-4 px-4 py-2 rounded-xl text-sm ${msg.includes("✅") ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`}>
          {msg}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">{[1,2].map((i) => <div key={i} className="h-16 bg-white/50 rounded-xl animate-pulse" />)}</div>
      ) : groups.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <div className="text-5xl mb-3">👥</div>
          <p className="text-sm">Bạn chưa tham gia nhóm nào</p>
          <p className="text-xs mt-2 text-gray-400">Tạo nhóm để rủ bạn bè cùng đặt sân</p>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((g) => (
            <div key={g.id} onClick={() => setShowDetail(g)}
              className="bg-white border border-gray-200 hover:border-emerald-400 rounded-xl p-4 cursor-pointer transition-colors">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-black text-sm">{g.name}</p>
                  {g.description && <p className="text-gray-500 text-xs mt-0.5">{g.description}</p>}
                </div>
                <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full">
                  👥 {g._count.members} thành viên
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                {g.ownerId === myId ? "👑 Bạn là trưởng nhóm" : `👤 Trưởng nhóm: ${g.owner.fullName}`}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Popup tạo nhóm */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl">
            <h3 className="font-bold text-black text-lg mb-4">+ Tạo nhóm mới</h3>
            <div className="space-y-3 mb-5">
              <div>
                <label className="text-xs text-gray-600 mb-1 block font-medium">Tên nhóm</label>
                <input value={groupName} onChange={(e) => setGroupName(e.target.value)}
                  placeholder="VD: Nhóm cầu lông sáng thứ 2..."
                  className="w-full bg-gray-50 border border-gray-300 text-black rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-400" />
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-1 block font-medium">Mô tả (tuỳ chọn)</label>
                <textarea value={groupDesc} onChange={(e) => setGroupDesc(e.target.value)}
                  placeholder="Mô tả nhóm..."
                  rows={2}
                  className="w-full bg-gray-50 border border-gray-300 text-black rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-400 resize-none" />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setShowCreate(false); setGroupName(""); setGroupDesc(""); }}
                className="flex-1 border border-gray-300 text-gray-600 py-2.5 rounded-xl text-sm hover:bg-gray-50 transition-colors">
                Hủy
              </button>
              <button onClick={handleCreate} disabled={creating}
                className="flex-1 bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-300 text-white py-2.5 rounded-xl text-sm font-medium transition-colors">
                {creating ? "Đang tạo..." : "Tạo nhóm"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Popup chi tiết nhóm */}
      {showDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-black text-lg">{showDetail.name}</h3>
              <button onClick={() => setShowDetail(null)} className="text-gray-400 hover:text-black text-xl">✕</button>
            </div>

            {showDetail.description && (
              <p className="text-gray-500 text-sm mb-4">{showDetail.description}</p>
            )}

            {/* Danh sách thành viên */}
            <p className="text-xs font-semibold text-gray-500 mb-2">THÀNH VIÊN ({showDetail.members.length})</p>
            <div className="space-y-2 mb-4">
              {showDetail.members.map((m: any) => (
                <div key={m.id} className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                      {m.user.fullName?.[0]?.toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-black">{m.user.fullName}</p>
                      <p className="text-xs text-gray-500">{m.user.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {m.role === "OWNER" && <span className="text-xs text-yellow-600">👑</span>}
                    {showDetail.ownerId === myId && m.userId !== myId && (
                      <button onClick={() => handleRemove(showDetail.id, m.userId)}
                        className="text-xs text-red-400 hover:text-red-600 transition-colors">✕</button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Thêm thành viên */}
            {showDetail.ownerId === myId && (
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-2">THÊM THÀNH VIÊN</p>
                <div className="flex gap-2">
                  <input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="Nhập email thành viên..."
                    className="flex-1 bg-gray-50 border border-gray-300 text-black rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-emerald-400" />
                  <button onClick={() => handleInvite(showDetail.id)}
                    className="bg-emerald-500 hover:bg-emerald-400 text-white px-4 py-2 rounded-xl text-sm transition-colors">
                    Thêm
                  </button>
                </div>
                {msg && (
                  <p className={`text-xs mt-2 ${msg.includes("✅") ? "text-emerald-600" : "text-red-500"}`}>{msg}</p>
                )}
              </div>
            )}

            {/* Nút đặt sân nhóm */}
            <button onClick={() => { setShowDetail(null); window.location.href = "/"; }}
              className="mt-4 w-full bg-emerald-500 hover:bg-emerald-400 text-white py-2.5 rounded-xl text-sm font-medium transition-colors">
              🏸 Đặt sân cho nhóm
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── ĐỔI MẬT KHẨU ─── */
function SectionPassword() {
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [show, setShow] = useState({ current: false, new: false, confirm: false });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  async function handleSubmit() {
    setLoading(true);
    setMsg("");
    const res = await fetch("/api/user/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setLoading(false);
    setMsg(res.ok ? `✅ ${data.message}` : data.error);
    if (res.ok) setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    setTimeout(() => setMsg(""), 4000);
  }

  const fields = [
    { key: "currentPassword", label: "Mật khẩu hiện tại", showKey: "current" },
    { key: "newPassword", label: "Mật khẩu mới", showKey: "new" },
    { key: "confirmPassword", label: "Xác nhận mật khẩu mới", showKey: "confirm" },
  ];

  return (
    <div className="border border-gray-300 rounded-2xl p-6" style={{ background: "#E0EEE0" }}>
      <h2 className="text-lg font-semibold text-black mb-6">Đổi mật khẩu</h2>

      {msg && (
        <div className={`mb-4 px-4 py-2 rounded-xl text-sm ${msg.includes("✅") ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`}>
          {msg}
        </div>
      )}

      <div className="max-w-sm space-y-4">
        {fields.map((field) => (
          <div key={field.key}>
            <label className="text-xs text-gray-600 mb-1.5 block font-medium">{field.label}</label>
            <div className="relative">
              <input
                type={show[field.showKey as keyof typeof show] ? "text" : "password"}
                value={(form as any)[field.key]}
                onChange={(e) => setForm((f) => ({ ...f, [field.key]: e.target.value }))}
                placeholder="••••••••"
                className="w-full bg-white border border-gray-300 text-black rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-400 transition-all pr-10"
              />
              <button
                onClick={() => setShow((s) => ({ ...s, [field.showKey]: !s[field.showKey as keyof typeof s] }))}
                className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 text-sm">
                {show[field.showKey as keyof typeof show] ? "🙈" : "👁️"}
              </button>
            </div>
          </div>
        ))}

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-300 text-white py-2.5 rounded-xl text-sm font-medium transition-colors mt-2">
          {loading ? "Đang xử lý..." : "Cập nhật mật khẩu"}
        </button>
      </div>
    </div>
  );
}

/* ─── CÀI ĐẶT ─── */
function SectionSettings() {
  const [settings, setSettings] = useState({ notifEmail: true, notifSms: false, notifPush: true, language: "vi" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch("/api/user/settings")
      .then((r) => r.json())
      .then((data) => { setSettings(data); setLoading(false); });
  }, []);

  async function handleSave() {
    setSaving(true);
    const res = await fetch("/api/user/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    const data = await res.json();
    setSaving(false);
    setMsg(res.ok ? `✅ ${data.message}` : data.error);
    setTimeout(() => setMsg(""), 3000);
  }

  return (
    <div className="space-y-4">
      {msg && (
        <div className={`px-4 py-2 rounded-xl text-sm ${msg.includes("✅") ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`}>
          {msg}
        </div>
      )}

      {/* Thông báo */}
      <div className="border border-gray-300 rounded-2xl p-6" style={{ background: "#E0EEE0" }}>
        <h2 className="text-lg font-semibold text-black mb-5">Cài đặt thông báo</h2>
        {loading ? (
          <div className="space-y-3">{[1,2,3].map((i) => <div key={i} className="h-10 bg-white/50 rounded-xl animate-pulse" />)}</div>
        ) : (
          <div className="space-y-4">
            {[
              { key: "notifEmail", label: "Thông báo qua Email", desc: "Nhận xác nhận đặt sân qua email" },
              { key: "notifSms", label: "Thông báo SMS", desc: "Nhận nhắc nhở qua tin nhắn" },
              { key: "notifPush", label: "Thông báo đẩy", desc: "Nhận thông báo trên trình duyệt" },
            ].map((item) => (
              <div key={item.key} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-black">{item.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
                </div>
                <button
                  onClick={() => setSettings((s) => ({ ...s, [item.key]: !s[item.key as keyof typeof s] }))}
                  className={`w-11 h-6 rounded-full transition-colors relative ${(settings as any)[item.key] ? "bg-emerald-500" : "bg-gray-300"}`}>
                  <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all shadow ${(settings as any)[item.key] ? "left-[22px]" : "left-0.5"}`} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Nút lưu */}
      <button onClick={handleSave} disabled={saving}
        className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-300 text-white py-3 rounded-xl text-sm font-medium transition-colors">
        {saving ? "Đang lưu..." : "💾 Lưu cài đặt"}
      </button>
    </div>
  );
}