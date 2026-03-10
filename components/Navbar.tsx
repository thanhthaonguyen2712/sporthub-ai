"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { useState } from "react";

export default function Navbar() {
  const { data: session, status } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="border-b border-slate-700/50 bg-slate-900/80 backdrop-blur-xl sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center text-sm">⚡</div>
          <span className="font-bold text-lg text-white">Sport<span className="text-emerald-400">Hub</span></span>
        </Link>

        {/* Auth section */}
        <div className="flex items-center gap-3">
          {status === "loading" ? (
            <div className="w-8 h-8 rounded-full bg-slate-700 animate-pulse" />
          ) : session ? (
            // Đã đăng nhập
            <div className="relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl px-3 py-2 transition-colors"
              >
                <div className="w-7 h-7 bg-emerald-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                  {session.user?.name?.[0]?.toUpperCase() || "U"}
                </div>
                <span className="text-white text-sm font-medium max-w-24 truncate">
                  {session.user?.name}
                </span>
                <span className="text-slate-400 text-xs">▾</span>
              </button>

              {/* Dropdown */}
              {menuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-slate-800 border border-slate-700 rounded-xl shadow-xl overflow-hidden z-50">
                  <div className="px-4 py-3 border-b border-slate-700">
                    <p className="text-white text-sm font-medium truncate">{session.user?.name}</p>
                    <p className="text-slate-400 text-xs truncate">{session.user?.email}</p>
                    <span className="inline-block mt-1 bg-emerald-500/20 text-emerald-400 text-xs px-2 py-0.5 rounded-full">
                      {(session.user as any)?.role || "CUSTOMER"}
                    </span>
                  </div>
                  <Link
                    href="/profile"
                    className="block px-4 py-2.5 text-slate-300 hover:bg-slate-700 text-sm transition-colors"
                    onClick={() => setMenuOpen(false)}
                  >
                    👤 Hồ sơ của tôi
                  </Link>
                  <Link
                    href="/bookings"
                    className="block px-4 py-2.5 text-slate-300 hover:bg-slate-700 text-sm transition-colors"
                    onClick={() => setMenuOpen(false)}
                  >
                    📋 Lịch đặt sân
                  </Link>
                  <button
                    onClick={() => { signOut({ callbackUrl: "/" }); setMenuOpen(false); }}
                    className="w-full text-left px-4 py-2.5 text-red-400 hover:bg-slate-700 text-sm transition-colors border-t border-slate-700"
                  >
                     Đăng xuất
                  </button>
                </div>
              )}
            </div>
          ) : (
            // Chưa đăng nhập
            <>
              <Link href="/login" className="text-slate-400 hover:text-white text-sm transition-colors">
                Đăng nhập
              </Link>
              <Link href="/register" className="bg-emerald-500 hover:bg-emerald-400 text-white text-sm px-4 py-2 rounded-lg transition-colors">
                Đăng ký
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}