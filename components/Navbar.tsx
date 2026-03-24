"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import LocaleSwitcher from "./LocaleSwitcher";
import { useLocale, useTranslations } from "next-intl";

export default function Navbar() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const locale = useLocale();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const notifRef = useRef<HTMLDivElement>(null);
  const t = useTranslations("nav");

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
          {/* Chuyển ngôn ngữ */}
          <LocaleSwitcher currentLocale={locale} />

          {status === "loading" ? (
            <div className="w-8 h-8 rounded-full bg-slate-700 animate-pulse" />
          ) : session ? (
            <>
              {/* Chuông thông báo */}
              <div className="relative" ref={notifRef}>
                <button
                  onClick={() => setNotifOpen(!notifOpen)}
                  className="relative w-9 h-9 flex items-center justify-center bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-colors">
                  <img src="/bell.png" alt="Thông báo" className="w-5 h-5" />
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
                        Thông báo
                      </p>
                      {unreadCount > 0 && (
                        <button onClick={markAllRead} className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors">
                          Đọc tất cả
                        </button>
                      )}
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="text-center py-8 text-slate-500">
                          <div className="flex justify-center mb-2"><img src="/bell.png" alt="" className="w-8 h-8 opacity-40" /></div>
                          <p className="text-xs">Chưa có thông báo nào</p>
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
                    {/* Ẩn profile/bookings với nhân viên */}
                    {(session.user as any)?.role !== "STAFF" && (session.user as any)?.role !== "WAREHOUSE_MANAGER" && (
                      <>
                        <Link href="/profile" className="block px-4 py-2.5 text-slate-300 hover:bg-slate-700 text-sm transition-colors" onClick={() => setMenuOpen(false)}>
                          {t("profile")}
                        </Link>
                        <Link href="/profile?tab=bookings" className="block px-4 py-2.5 text-slate-300 hover:bg-slate-700 text-sm transition-colors" onClick={() => setMenuOpen(false)}>
                          {t("bookings")}
                        </Link>
                      </>
                    )}
                    {(session.user as any)?.role === "OWNER" && (
                      <Link href="/owner/dashboard" className="block px-4 py-2.5 text-emerald-400 hover:bg-slate-700 text-sm transition-colors font-medium" onClick={() => setMenuOpen(false)}>
                        Quản lý sân
                      </Link>
                    )}
                    {((session.user as any)?.role === "STAFF" || (session.user as any)?.role === "WAREHOUSE_MANAGER") && (
                      <Link href="/staff/dashboard" className="block px-4 py-2.5 text-blue-400 hover:bg-slate-700 text-sm transition-colors font-medium" onClick={() => setMenuOpen(false)}>
                        {(session.user as any)?.role === "WAREHOUSE_MANAGER" ? "Quản lý kho" : "Trang làm việc"}
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
              <Link href="/login" className="text-slate-400 hover:text-white text-sm transition-colors">{t("login")}</Link>
              <Link href="/register" className="bg-emerald-500 hover:bg-emerald-400 text-white text-sm px-4 py-2 rounded-lg transition-colors">{t("register")}</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}