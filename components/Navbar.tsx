"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

export default function Navbar() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const notifRef = useRef<HTMLDivElement>(null);
  const t = useTranslations("nav");

  // State cho tra cứu đặt sân khách vãng lai
  const [lookupOpen, setLookupOpen] = useState(false);
  const [guestPhone, setGuestPhone] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupResults, setLookupResults] = useState<any[] | null>(null);
  const [lookupError, setLookupError] = useState("");
  const lookupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (lookupRef.current && !lookupRef.current.contains(e.target as Node)) setLookupOpen(false);
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  async function doLookup(e: React.FormEvent) {
    e.preventDefault();
    if (!guestPhone.trim()) return;
    setLookupLoading(true); setLookupError(""); setLookupResults(null);
    const res = await fetch(`/api/guest-bookings/lookup?phone=${encodeURIComponent(guestPhone.trim())}`);
    const data = await res.json();
    setLookupLoading(false);
    if (res.ok) { setLookupResults(data); if (data.length === 0) setLookupError("Không tìm thấy lịch đặt nào đang hoạt động."); }
    else setLookupError(data.error || "Không thể tra cứu.");
  }

  useEffect(() => {
    if (!session) return;
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, [session]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function loadNotifications() {
    fetch("/api/notifications")
      .then((r) => r.json())
      .then((data) => {
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      });
  }

  async function markAllRead() {
    await fetch("/api/notifications", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "all" }),
    });
    setUnreadCount(0);
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  }

  async function markRead(id: number, link?: string) {
    await fetch("/api/notifications", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, isRead: true } : n));
    setUnreadCount((prev) => Math.max(0, prev - 1));
    setNotifOpen(false);
    if (link) router.push(link);
  }

  const typeIcon: Record<string, React.ReactNode> = {
    BOOKING:   <img src="/list.png"      alt="" className="w-4 h-4 mt-0.5 flex-shrink-0" />,
    PAYMENT:   <img src="/wallet.png"    alt="" className="w-4 h-4 mt-0.5 flex-shrink-0" />,
    SYSTEM:    <img src="/bell.png"      alt="" className="w-4 h-4 mt-0.5 flex-shrink-0" />,
    PROMOTION: <img src="/giftbox.png"   alt="" className="w-4 h-4 mt-0.5 flex-shrink-0" />,
    COURSE:    <img src="/education.png" alt="" className="w-4 h-4 mt-0.5 flex-shrink-0" />,
    MEMBERSHIP:<img src="/diamon.png"    alt="" className="w-4 h-4 mt-0.5 flex-shrink-0" />,
  };

  return (
    <>
    <nav className="border-b border-slate-700/50 bg-slate-900/80 backdrop-blur-xl sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center text-sm">
            <img src="/logo.png" className="w-8 h-8 rounded-lg" alt="SportHub Logo" />
          </div>
          <span className="font-bold text-lg text-white">Sport<span className="text-emerald-400">Hub</span></span>
        </Link>

        <div className="flex items-center gap-3">
          {status === "loading" ? (
            <div className="w-8 h-8 rounded-full bg-slate-700 animate-pulse" />
          ) : session ? (
            <>
              {/* Tìm đồng đội — chỉ cho khách hàng */}
              {(session.user as any)?.role === "CUSTOMER" && (
                <Link
                  href="/match-posts"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white transition-colors"
                >
                  <img src="/group.png" alt="group" className="w-5 h-5 flex-shrink-0" />
                  <span>{t("findTeammate")}</span>
                </Link>
              )}

              {/* Chuông thông báo */}
              <div className="relative" ref={notifRef}>
                <button
                  onClick={() => setNotifOpen(!notifOpen)}
                  className="relative w-9 h-9 flex items-center justify-center bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-colors">
                  <img src="/bell.png" alt="" className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </button>

                {notifOpen && (
                  <div className="absolute right-0 mt-2 w-80 bg-slate-800 border border-slate-700 rounded-xl shadow-xl overflow-hidden z-50">
                    <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
                      <p className="text-white text-sm font-semibold flex items-center gap-1.5">
                        <img src="/bell.png" alt="" className="w-4 h-4" />
                        {t("notifications")}
                      </p>
                      {unreadCount > 0 && (
                        <button onClick={markAllRead} className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors">
                          {t("markAllRead")}
                        </button>
                      )}
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="text-center py-8 text-slate-500">
                          <div className="flex justify-center mb-2"><img src="/bell.png" alt="" className="w-8 h-8 opacity-40" /></div>
                          <p className="text-xs">{t("noNotifications")}</p>
                        </div>
                      ) : (
                        notifications.map((n) => (
                          <div key={n.id}
                            onClick={() => markRead(n.id, n.link)}
                            className={`px-4 py-3 border-b border-slate-700/50 cursor-pointer hover:bg-slate-700/50 transition-colors ${!n.isRead ? "bg-slate-700/30" : ""}`}>
                            <div className="flex items-start gap-2">
                              <span className="text-base mt-0.5 flex-shrink-0">
                                {typeIcon[n.type] ?? <img src="/bell.png" alt="" className="w-4 h-4 mt-0.5" />}
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm ${!n.isRead ? "text-white font-medium" : "text-slate-300"}`}>
                                  {n.title}
                                </p>
                                <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{n.content}</p>
                                <p className="text-xs text-slate-500 mt-1">
                                  {new Date(n.createdAt).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                                </p>
                              </div>
                              {!n.isRead && <div className="w-2 h-2 bg-emerald-400 rounded-full mt-1.5 flex-shrink-0" />}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* User menu */}
              <div className="relative">
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl px-3 py-2 transition-colors">
                  <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0">
                    {(session.user as any)?.avatar ? (
                      <img src={(session.user as any).avatar} alt="avatar" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-emerald-500 flex items-center justify-center text-white text-xs font-bold">
                        {session.user?.name?.[0]?.toUpperCase() || "U"}
                      </div>
                    )}
                  </div>
                  <span className="text-white text-sm font-medium max-w-24 truncate">{session.user?.name}</span>
                  <span className="text-slate-400 text-xs">▾</span>
                </button>

                {menuOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-slate-800 border border-slate-700 rounded-xl shadow-xl overflow-hidden z-50">
                    <div className="px-4 py-3 border-b border-slate-700">
                      <p className="text-white text-sm font-medium truncate">{session.user?.name}</p>
                      <p className="text-slate-400 text-xs truncate">{session.user?.email}</p>
                      <span className="inline-block mt-1 bg-emerald-500/20 text-emerald-400 text-xs px-2 py-0.5 rounded-full">
                        {(session.user as any)?.role || "CUSTOMER"}
                      </span>
                    </div>
                    {/* Profile chỉ cho khách hàng */}
                    {(session.user as any)?.role === "CUSTOMER" && (
                      <Link href="/profile" className="block px-4 py-2.5 text-slate-300 hover:bg-slate-700 text-sm transition-colors" onClick={() => setMenuOpen(false)}>
                        {t("profile")}
                      </Link>
                    )}
                    {(session.user as any)?.role === "OWNER" && (
                      <>
                        <Link href="/owner/dashboard" className="block px-4 py-2.5 text-emerald-400 hover:bg-slate-700 text-sm transition-colors font-medium" onClick={() => setMenuOpen(false)}>
                          {t("manageCourt")}
                        </Link>
                        <Link href="/profile" className="block px-4 py-2.5 text-slate-300 hover:bg-slate-700 text-sm transition-colors" onClick={() => setMenuOpen(false)}>
                          Thông tin của tôi
                        </Link>
                      </>
                    )}
                    {((session.user as any)?.role === "STAFF" || (session.user as any)?.role === "WAREHOUSE_MANAGER") && (
                      <Link href="/staff/dashboard" className="block px-4 py-2.5 text-blue-400 hover:bg-slate-700 text-sm transition-colors font-medium" onClick={() => setMenuOpen(false)}>
                        {(session.user as any)?.role === "WAREHOUSE_MANAGER" ? t("manageWarehouse") : t("workPage")}
                      </Link>
                    )}
                    <button
                      onClick={() => { signOut({ callbackUrl: "/" }); setMenuOpen(false); }}
                      className="w-full text-left px-4 py-2.5 text-red-400 hover:bg-slate-700 text-sm transition-colors border-t border-slate-700">
                      {t("logout")}
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <Link
                href="/match-posts"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white transition-colors"
              >
                <img src="/group.png" alt="group" className="w-4 h-4 flex-shrink-0" />
                Ghép sân
              </Link>

              {/* Tra cứu lịch đặt sân cho khách vãng lai */}
              <div className="relative" ref={lookupRef}>
                <button
                  onClick={() => setLookupOpen(!lookupOpen)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white transition-colors"
                >
                  <span>🔍</span> Tra cứu đặt sân
                </button>
                {lookupOpen && (
                  <div className="absolute right-0 mt-2 w-80 bg-slate-800 border border-slate-700 rounded-xl shadow-xl overflow-hidden z-50 p-4">
                    <p className="text-white text-sm font-semibold mb-1">Tra cứu lịch đặt sân</p>
                    <p className="text-slate-400 text-xs mb-3">Nhập số điện thoại đã dùng khi đặt sân.</p>
                    <form onSubmit={doLookup} className="flex gap-2 mb-3">
                      <input
                        type="tel"
                        value={guestPhone}
                        onChange={e => setGuestPhone(e.target.value)}
                        placeholder="Số điện thoại..."
                        className="flex-1 bg-slate-700 border border-slate-600 text-white placeholder-slate-400 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-emerald-400"
                      />
                      <button type="submit" disabled={lookupLoading}
                        className="bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-sm transition-colors">
                        {lookupLoading ? "..." : "Tìm"}
                      </button>
                    </form>
                    {lookupError && <p className="text-red-400 text-xs mb-2">{lookupError}</p>}
                    {lookupResults && lookupResults.length > 0 && (
                      <div className="space-y-2 max-h-56 overflow-y-auto">
                        {lookupResults.map((b: any) => (
                          <div key={b.id} className="bg-slate-700 rounded-lg px-3 py-2">
                            <div className="flex items-center justify-between mb-0.5">
                              <span className="text-xs font-semibold text-white">#{b.id} – {b.court.facility}</span>
                              <span className={`text-xs px-1.5 py-0.5 rounded-full ${b.status === "CONFIRMED" ? "bg-emerald-500/20 text-emerald-400" : "bg-yellow-500/20 text-yellow-400"}`}>
                                {b.status === "CONFIRMED" ? "Xác nhận" : "Chờ"}
                              </span>
                            </div>
                            <p className="text-xs text-slate-300">{b.court.name} · {b.court.sport}</p>
                            <p className="text-xs text-slate-400">{new Date(b.bookingDate).toLocaleDateString("vi-VN")} · {new Date(b.startTime).toISOString().substring(11,16)}–{new Date(b.endTime).toISOString().substring(11,16)}</p>
                            <p className="text-xs font-bold text-emerald-400 mt-0.5">{Number(b.totalPrice).toLocaleString("vi-VN")}đ</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <Link href="/login" className="text-slate-400 hover:text-white text-sm transition-colors">{t("login")}</Link>
              <Link href="/register" className="bg-emerald-500 hover:bg-emerald-400 text-white text-sm px-4 py-2 rounded-lg transition-colors">{t("register")}</Link>
            </>
          )}
        </div>
      </div>
    </nav>
</>
  );
}