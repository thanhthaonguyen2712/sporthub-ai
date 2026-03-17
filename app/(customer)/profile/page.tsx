"use client";
import { useSession, signOut } from "next-auth/react";
import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Navbar from "@/components/Navbar";

const menuItems = [
  { id: "info", icon: "👤", label: "Thông tin cá nhân" },
  { id: "bookings", icon: "📋", label: "Lịch đặt sân" },
  { id: "wallet", icon: "💰", label: "Ví SportHub" },
  { id: "courses", icon: "🎓", label: "Khóa học" },
  { id: "membership", icon: "💎", label: "Gói hội viên" },
  { id: "vouchers", icon: "🎁", label: "Ưu đãi của tôi" },
  { id: "groups", icon: "👥", label: "Nhóm của tôi" },
  { id: "password", icon: "🔒", label: "Đổi mật khẩu" },
  { id: "settings", icon: "⚙️", label: "Cài đặt" },
];

export default function ProfilePage() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const [active, setActive] = useState(searchParams.get("tab") || "info");

  return (
    <div className="min-h-screen" style={{ fontFamily: "Arial, sans-serif", background: "linear-gradient(to right, #DDEFBB, #FFEEEE)", color: "#000" }}>
      <Navbar />
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex gap-6">

          {/* Sidebar */}
          <aside className="w-64 flex-shrink-0">
            {/* Avatar + tên */}
            <div className="border border-gray-300 rounded-2xl p-5 mb-4 text-center" style={{ background: "#E0EEE0" }}>
              <div className="relative inline-block mb-3">
                <div className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center text-2xl font-bold mx-auto text-white">
                  {session?.user?.name?.[0]?.toUpperCase() || "U"}
                </div>
                <button className="absolute bottom-0 right-0 w-6 h-6 bg-gray-200 hover:bg-gray-300 rounded-full flex items-center justify-center text-xs border-2 border-white transition-colors">
                  📷
                </button>
              </div>
              <p className="font-semibold text-black text-sm">{session?.user?.name}</p>
              <p className="text-gray-600 text-xs mt-0.5">{session?.user?.email}</p>
              <span className="inline-block mt-2 bg-emerald-100 text-emerald-700 text-xs px-2 py-0.5 rounded-full">
                {(session?.user as any)?.role || "CUSTOMER"}
              </span>
            </div>

            {/* Menu */}
            <nav className="border border-gray-300 rounded-2xl overflow-hidden" style={{ background: "#E0EEE0" }}>
              {menuItems.map((item, index) => (
                <button
                  key={item.id}
                  onClick={() => setActive(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors text-left
                    ${index !== 0 ? "border-t border-gray-300" : ""}
                    ${active === item.id
                      ? "bg-emerald-100 text-emerald-700 font-medium"
                      : "text-black hover:bg-blue-100"
                    }`}
                >
                  <span>{item.icon}</span>
                  {item.label}
                </button>
              ))}

              {/* Đăng xuất */}
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-500 hover:bg-red-50 transition-colors border-t border-gray-300 text-left"
              >
              Đăng xuất
              </button>

              {/* Xóa tài khoản */}
              <button className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-700 hover:bg-red-50 transition-colors border-t border-gray-300 text-left">
               Xóa tài khoản
              </button>
            </nav>
          </aside>

          {/* Nội dung */}
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
    </div>
  );
}

/* ─── THÔNG TIN CÁ NHÂN ─── */
function SectionInfo({ session }: { session: any }) {
  const [editing, setEditing] = useState(false);
  return (
    <div className="border border-gray-300 rounded-2xl p-6" style={{ background: "#E0EEE0" }}>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-black">Thông tin cá nhân</h2>
        <button
          onClick={() => setEditing(!editing)}
          className="text-sm text-emerald-600 hover:text-emerald-700 border border-emerald-400 px-3 py-1.5 rounded-lg transition-colors"
        >
          {editing ? "Hủy" : "✏️ Chỉnh sửa"}
        </button>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {[
          { label: "Họ và tên", value: session?.user?.name, placeholder: "Nhập họ tên" },
          { label: "Email", value: session?.user?.email, placeholder: "Nhập email" },
          { label: "Số điện thoại", value: "", placeholder: "Nhập số điện thoại" },
          { label: "Ngày sinh", value: "", placeholder: "DD/MM/YYYY" },
        ].map((field) => (
          <div key={field.label}>
            <label className="text-xs text-gray-600 mb-1.5 block font-medium">{field.label}</label>
            <input
              defaultValue={field.value || ""}
              placeholder={field.placeholder}
              disabled={!editing}
              className="w-full bg-white border border-gray-300 text-black placeholder-gray-400 rounded-xl px-4 py-2.5 text-sm disabled:opacity-60 focus:outline-none focus:border-emerald-400 transition-all"
            />
          </div>
        ))}
      </div>
      {editing && (
        <button className="mt-5 bg-emerald-500 hover:bg-emerald-400 text-white px-6 py-2.5 rounded-xl text-sm font-medium transition-colors">
          Lưu thay đổi
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
    if (filter === "Sắp tới")
      return bookingDate >= today && (b.status === "CONFIRMED" || b.status === "PENDING");
    if (filter === "Đã hoàn thành")
      return b.status === "COMPLETED" || bookingDate < today;
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
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`text-xs px-3 py-1.5 rounded-lg transition-colors border ${
              filter === tab
                ? "bg-emerald-100 text-emerald-700 border-emerald-300 font-medium"
                : "bg-white text-gray-600 border-gray-300 hover:bg-emerald-50"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-24 bg-white/50 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <div className="text-4xl mb-2">📋</div>
          <p className="text-sm">Chưa có lịch đặt sân nào</p>
          <a href="/" className="inline-block mt-3 text-emerald-600 text-sm hover:underline">
            Đặt sân ngay →
          </a>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((b) => (
            <div key={b.id} className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  {b.court.iconUrl && (
                    <img src={b.court.iconUrl} className="w-6 h-6" alt={b.court.category} />
                  )}
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
                <span className="text-emerald-600 font-bold text-sm">
                  {Number(b.totalPrice).toLocaleString("vi-VN")}đ
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">#{b.id}</span>
                  {(b.status === "CONFIRMED" || b.status === "PENDING") &&
                    (new Date().getTime() - new Date(b.createdAt).getTime()) / 60000 <= 60 && (
                      <button
                        onClick={() => setShowConfirm(b.id)}
                        className="text-xs text-red-500 hover:text-red-700 border border-red-300 hover:border-red-500 px-2 py-0.5 rounded-lg transition-colors">Hủy
                      </button>
                    )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-medium text-white ${toast.includes("thành công") || toast.includes("Hoàn") ? "bg-emerald-500" : "bg-red-500"}`}>
          {toast}
        </div>
      )}

      {/* Popup xác nhận hủy */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl">
            <h3 className="font-bold text-black text-lg mb-2">Xác nhận hủy sân</h3>
            <p className="text-gray-600 text-sm mb-1">Bạn có chắc muốn hủy lịch đặt sân này?</p>
            <p className="text-emerald-600 text-xs mb-5">✅ Tiền sẽ được hoàn về ví SportHub ngay lập tức.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(null)}
                className="flex-1 border border-gray-300 text-gray-600 py-2.5 rounded-xl text-sm hover:bg-gray-50 transition-colors">Không hủy
              </button>
              <button
                onClick={() => handleCancel(showConfirm)}
                disabled={cancellingId === showConfirm}
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

  useEffect(() => {
    fetch("/api/wallet/detail")
      .then((r) => r.json())
      .then((data) => {
        setWallet(data.wallet);
        setTransactions(data.transactions || []);
        setLoading(false);
      });
  }, []);

  const typeLabel: Record<string, { label: string; color: string; sign: string }> = {
    DEPOSIT:  { label: "Nạp tiền",        color: "text-emerald-600", sign: "+" },
    PAYMENT:  { label: "Thanh toán",      color: "text-red-500",     sign: "-" },
    REFUND:   { label: "Hoàn tiền",       color: "text-emerald-600", sign: "+" },
    WITHDRAW: { label: "Rút tiền",        color: "text-red-500",     sign: "-" },
  };

  return (
    <div className="space-y-4">
      {/* Số dư */}
      <div className="border border-gray-300 rounded-2xl p-6" style={{ background: "#E0EEE0" }}>
        <h2 className="text-lg font-semibold text-black mb-4">💰 Ví SportHub</h2>
        {loading ? (
          <div className="h-16 bg-white/50 rounded-xl animate-pulse" />
        ) : (
          <div className="bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-2xl p-5 text-white">
            <p className="text-sm opacity-80 mb-1">Số dư hiện tại</p>
            <p className="text-3xl font-bold">{Number(wallet?.balance || 0).toLocaleString("vi-VN")}đ</p>
            <div className="flex items-center gap-2 mt-3">
              <span className={`text-xs px-2 py-0.5 rounded-full ${wallet?.status === "ACTIVE" ? "bg-white/20" : "bg-red-300/40"}`}>
                {wallet?.status === "ACTIVE" ? "✅ Hoạt động" : "🔒 Bị khóa"}
              </span>
            </div>
          </div>
        )}

        {/* Nút nạp tiền (demo) */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          {[50000, 100000, 200000, 500000, 1000000, 2000000].map((amount) => (
            <button
              key={amount}
              className="bg-white border border-emerald-300 text-emerald-700 text-xs py-2 rounded-xl hover:bg-emerald-50 transition-colors font-medium"
              onClick={async () => {
                const res = await fetch("/api/wallet/topup", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ amount }),
                });
                const data = await res.json();
                if (res.ok) {
                  setWallet((w: any) => ({ ...w, balance: Number(w.balance) + amount }));
                  setTransactions((prev) => [data.transaction, ...prev]);
                }
              }}
            >
              +{(amount / 1000).toFixed(0)}k
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-2 text-center">Chọn số tiền để nạp vào ví (demo)</p>
      </div>

      {/* Lịch sử giao dịch */}
      <div className="border border-gray-300 rounded-2xl p-6" style={{ background: "#E0EEE0" }}>
        <h2 className="text-lg font-semibold text-black mb-4">📜 Lịch sử giao dịch</h2>
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <div key={i} className="h-14 bg-white/50 rounded-xl animate-pulse" />)}
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-10 text-gray-500">
            <div className="text-4xl mb-2">📭</div>
            <p className="text-sm">Chưa có giao dịch nào</p>
          </div>
        ) : (
          <div className="space-y-2">
            {transactions.map((t) => (
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
    </div>
  );
}
/* ─── KHÓA HỌC ─── */
function SectionCourses() {
  const courses = [
    { name: "Khóa học Pickleball cơ bản", coach: "HLV Nguyễn Văn A", schedule: "T2, T4, T6 - 7:00", sessions: "12 buổi", status: "Đang học", progress: 40 },
    { name: "Nâng cao kỹ thuật Tennis", coach: "HLV Trần Thị B", schedule: "T3, T5 - 17:30", sessions: "8 buổi", status: "Sắp khai giảng", progress: 0 },
  ];
  return (
    <div className="border border-gray-300 rounded-2xl p-6" style={{ background: "#E0EEE0" }}>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-black">Khóa học của tôi</h2>
        <a href="/courses" className="text-sm text-emerald-600 hover:text-emerald-700 transition-colors">Xem tất cả →</a>
      </div>
      <div className="space-y-4">
        {courses.map((c) => (
          <div key={c.name} className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="font-medium text-sm text-black">{c.name}</p>
                <p className="text-gray-500 text-xs mt-0.5">👨‍🏫 {c.coach} · 🕐 {c.schedule}</p>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full ${c.status === "Đang học" ? "bg-emerald-100 text-emerald-700" : "bg-yellow-100 text-yellow-700"}`}>
                {c.status}
              </span>
            </div>
            {c.progress > 0 && (
              <div className="mt-3">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Tiến độ</span><span>{c.progress}%</span>
                </div>
                <div className="h-1.5 bg-gray-200 rounded-full">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${c.progress}%` }} />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── GÓI HỘI VIÊN ─── */
function SectionMembership() {
  return (
    <div className="border border-gray-300 rounded-2xl p-6" style={{ background: "#E0EEE0" }}>
      <h2 className="text-lg font-semibold text-black mb-6">Gói hội viên</h2>
      <div className="bg-gradient-to-br from-emerald-50 to-blue-50 border border-emerald-200 rounded-xl p-5 mb-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 mb-1">Gói hiện tại</p>
            <p className="text-xl font-bold text-emerald-600">FREE</p>
          </div>
          <span className="text-3xl">🥉</span>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[
          { name: "Silver", price: "199.000đ/tháng", icon: "🥈", perks: ["Giảm 10% khi đặt sân", "Ưu tiên đặt giờ cao điểm"] },
          { name: "Gold", price: "399.000đ/tháng", icon: "🥇", perks: ["Giảm 20% khi đặt sân", "1 buổi PT miễn phí/tháng"] },
          { name: "Platinum", price: "699.000đ/tháng", icon: "💎", perks: ["Giảm 30% khi đặt sân", "Không giới hạn PT"] },
        ].map((pkg) => (
          <div key={pkg.name} className="bg-white border border-gray-200 rounded-xl p-4 text-center">
            <div className="text-2xl mb-2">{pkg.icon}</div>
            <p className="font-semibold text-sm text-black mb-1">{pkg.name}</p>
            <p className="text-emerald-600 text-xs mb-3">{pkg.price}</p>
            {pkg.perks.map((p) => <p key={p} className="text-gray-500 text-xs mb-1">✓ {p}</p>)}
            <button className="mt-3 w-full bg-emerald-500 hover:bg-emerald-400 text-white text-xs py-2 rounded-lg transition-colors">
              Nâng cấp
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── ƯU ĐÃI ─── */
function SectionVouchers() {
  return (
    <div className="border border-gray-300 rounded-2xl p-6" style={{ background: "#E0EEE0" }}>
      <h2 className="text-lg font-semibold text-black mb-6">Ưu đãi của tôi</h2>
      <div className="space-y-3">
        {[
          { code: "WELCOME10", desc: "Giảm 10% lần đặt đầu tiên", expire: "31/03/2026", used: false },
          { code: "SUMMER20", desc: "Giảm 20% mùa hè", expire: "30/06/2026", used: false },
          { code: "OLDCODE", desc: "Voucher đã hết hạn", expire: "01/01/2026", used: true },
        ].map((v) => (
          <div key={v.code} className={`flex items-center justify-between border rounded-xl p-4 ${v.used ? "opacity-50 border-gray-300 bg-gray-100" : "border-emerald-200 bg-white"}`}>
            <div>
              <p className="font-mono font-bold text-emerald-600 text-sm">{v.code}</p>
              <p className="text-gray-700 text-xs mt-0.5">{v.desc}</p>
              <p className="text-gray-400 text-xs mt-0.5">HSD: {v.expire}</p>
            </div>
            <span className={`text-xs px-2 py-1 rounded-lg ${v.used ? "bg-gray-200 text-gray-500" : "bg-emerald-100 text-emerald-700"}`}>
              {v.used ? "Hết hạn" : "Dùng ngay"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── NHÓM ─── */
function SectionGroups() {
  return (
    <div className="border border-gray-300 rounded-2xl p-6" style={{ background: "#E0EEE0" }}>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-black">Nhóm của tôi</h2>
        <button className="text-sm bg-emerald-500 hover:bg-emerald-400 text-white px-4 py-1.5 rounded-lg transition-colors">
          + Tạo nhóm
        </button>
      </div>
      <div className="text-center py-16 text-gray-500">
        <div className="text-5xl mb-3">👥</div>
        <p className="text-sm">Bạn chưa tham gia nhóm nào</p>
        <p className="text-xs mt-2 text-gray-400">Tạo nhóm để rủ bạn bè cùng đặt sân</p>
      </div>
    </div>
  );
}

/* ─── ĐỔI MẬT KHẨU ─── */
function SectionPassword() {
  return (
    <div className="border border-gray-300 rounded-2xl p-6" style={{ background: "#E0EEE0" }}>
      <h2 className="text-lg font-semibold text-black mb-6">Đổi mật khẩu</h2>
      <div className="max-w-sm space-y-4">
        {["Mật khẩu hiện tại", "Mật khẩu mới", "Xác nhận mật khẩu mới"].map((label) => (
          <div key={label}>
            <label className="text-xs text-gray-600 mb-1.5 block font-medium">{label}</label>
            <input type="password" className="w-full bg-white border border-gray-300 text-black rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-400 transition-all" />
          </div>
        ))}
        <button className="w-full bg-emerald-500 hover:bg-emerald-400 text-white py-2.5 rounded-xl text-sm font-medium transition-colors mt-2">
          Cập nhật mật khẩu
        </button>
      </div>
    </div>
  );
}

/* ─── CÀI ĐẶT ─── */
function SectionSettings() {
  const [notif, setNotif] = useState({ email: true, sms: false, push: true });
  const [lang, setLang] = useState("vi");
  return (
    <div className="space-y-4">
      <div className="border border-gray-300 rounded-2xl p-6" style={{ background: "#E0EEE0" }}>
        <h2 className="text-lg font-semibold text-black mb-5">Cài đặt thông báo</h2>
        <div className="space-y-4">
          {[
            { key: "email", label: "Thông báo qua Email", desc: "Nhận xác nhận đặt sân qua email" },
            { key: "sms", label: "Thông báo SMS", desc: "Nhận nhắc nhở qua tin nhắn" },
            { key: "push", label: "Thông báo đẩy", desc: "Nhận thông báo trên trình duyệt" },
          ].map((item) => (
            <div key={item.key} className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-black">{item.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
              </div>
              <button
                onClick={() => setNotif((p) => ({ ...p, [item.key]: !p[item.key as keyof typeof p] }))}
                className={`w-11 h-6 rounded-full transition-colors relative ${notif[item.key as keyof typeof notif] ? "bg-emerald-500" : "bg-gray-300"}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all shadow ${notif[item.key as keyof typeof notif] ? "left-[22px]" : "left-0.5"}`} />
              </button>
            </div>
          ))}
        </div>
      </div>
      <div className="border border-gray-300 rounded-2xl p-6" style={{ background: "#E0EEE0" }}>
        <h2 className="text-lg font-semibold text-black mb-5">Ngôn ngữ</h2>
        <div className="flex gap-3">
          {[{ value: "vi", label: "🇻🇳 Tiếng Việt" }, { value: "en", label: "🇬🇧 English" }].map((l) => (
            <button
              key={l.value}
              onClick={() => setLang(l.value)}
              className={`px-4 py-2 rounded-xl text-sm border transition-colors ${lang === l.value ? "bg-emerald-100 border-emerald-400 text-emerald-700 font-medium" : "border-gray-300 text-gray-600 hover:border-gray-400 bg-white"}`}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}