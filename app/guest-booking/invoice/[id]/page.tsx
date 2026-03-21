"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { useTranslations } from "next-intl";

interface BookingDetail {
  id: number;
  guestName: string;
  guestPhone: string;
  guestEmail: string | null;
  bookingDate: string;
  startTime: string;
  endTime: string;
  totalPrice: string;
  status: string;
  expiredAt: string;
  createdAt: string;
  court: {
    name: string;
    sport: string;
    facility: string;
    address: string;
  };
}


function formatTime(iso: string) {
  return new Date(iso).toISOString().substring(11, 16);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("vi-VN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("vi-VN");
}

function getCountdown(expiredAt: string, remaining: string): string | null {
  const diff = new Date(expiredAt).getTime() - Date.now();
  if (diff <= 0) return null;
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  if (h > 0) return `${h}h ${m}m ${remaining}`;
  if (m > 0) return `${m}m ${s}s ${remaining}`;
  return `${s}s ${remaining}`;
}

export default function GuestInvoicePage() {
  const t = useTranslations("guestBooking");

  const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
    PENDING:   { label: t("statusPending"),   color: "text-yellow-700 bg-yellow-50 border-yellow-300", icon: "⏳" },
    CONFIRMED: { label: t("statusConfirmed"), color: "text-emerald-700 bg-emerald-50 border-emerald-300", icon: "✅" },
    PAID:      { label: t("statusPaid"),      color: "text-blue-700 bg-blue-50 border-blue-300", icon: "💳" },
    CANCELLED: { label: t("statusCancelled"), color: "text-red-700 bg-red-50 border-red-300", icon: "❌" },
    EXPIRED:   { label: t("statusExpired"),   color: "text-gray-600 bg-gray-100 border-gray-300", icon: "🕐" },
  };
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();

  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [phone, setPhone] = useState(searchParams.get("phone") || "");
  const [phoneInput, setPhoneInput] = useState(searchParams.get("phone") || "");
  const [isExpired, setIsExpired] = useState(false);
  const [countdown, setCountdown] = useState<string | null>(null);

  const fetchBooking = useCallback(async (phoneToUse: string) => {
    setLoading(true);
    setError("");
    const url = `/api/guest-bookings/${id}${phoneToUse ? `?phone=${encodeURIComponent(phoneToUse)}` : ""}`;
    const res = await fetch(url);
    const data = await res.json();
    setLoading(false);
    if (res.ok) {
      setBooking(data);
      setIsExpired(new Date(data.expiredAt) <= new Date());
    } else {
      setError(data.error || t("error"));
    }
  }, [id]);

  useEffect(() => {
    if (phone) fetchBooking(phone);
  }, [phone, fetchBooking]);

  // Countdown timer
  useEffect(() => {
    if (!booking) return;
    const timer = setInterval(() => {
      const cd = getCountdown(booking.expiredAt, t("remaining"));
      setCountdown(cd);
      if (!cd) {
        setIsExpired(true);
        clearInterval(timer);
      }
    }, 1000);
    setCountdown(getCountdown(booking.expiredAt, t("remaining")));
    return () => clearInterval(timer);
  }, [booking]);

  // Chưa có phone — hiển thị form nhập SĐT
  if (!phone) {
    return (
      <div className="min-h-screen text-black" style={{ fontFamily: "Arial, sans-serif", background: "linear-gradient(to right, #DDEFBB, #FFEEEE)" }}>
        <Navbar />
        <div className="max-w-md mx-auto px-6 py-16 text-center">
          <div className="text-5xl mb-4">🧾</div>
          <h1 className="text-xl font-bold mb-2">{t("invoiceTitle")}</h1>
          <p className="text-gray-500 text-sm mb-6">{t("invoiceSubtitle", { id })}</p>
          <div className="border border-gray-300 rounded-2xl p-5" style={{ background: "#E0EEE0" }}>
            <input
              type="tel"
              placeholder={t("phonePlaceholderInvoice")}
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && phoneInput && setPhone(phoneInput)}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:border-emerald-400 mb-3"
            />
            {error && <p className="text-red-500 text-xs mb-3">{error}</p>}
            <button
              onClick={() => phoneInput && setPhone(phoneInput)}
              disabled={!phoneInput || loading}
              className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-300 text-white py-3 rounded-xl font-semibold transition-colors text-sm"
            >
              {loading ? t("loadingText") : t("viewInvoiceBtn")}
            </button>
          </div>
          <Link href="/" className="text-sm text-emerald-600 hover:underline mt-4 inline-block">{t("backHome")}</Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "linear-gradient(to right, #DDEFBB, #FFEEEE)" }}>
        <div className="text-gray-500 text-sm">{t("loadingInvoice")}</div>
      </div>
    );
  }

  if (error && !booking) {
    return (
      <div className="min-h-screen text-black" style={{ fontFamily: "Arial, sans-serif", background: "linear-gradient(to right, #DDEFBB, #FFEEEE)" }}>
        <Navbar />
        <div className="max-w-md mx-auto px-6 py-20 text-center">
          <div className="text-5xl mb-4">❌</div>
          <h1 className="text-xl font-bold mb-2">{t("invoiceNotFound")}</h1>
          <p className="text-gray-500 text-sm mb-6">{error}</p>
          <button
            onClick={() => { setPhone(""); setPhoneInput(""); setError(""); }}
            className="bg-emerald-500 hover:bg-emerald-400 text-white px-6 py-3 rounded-xl text-sm font-semibold mr-3 transition-colors"
          >
            {t("retry")}
          </button>
          <Link href="/" className="text-sm text-gray-600 hover:underline">{t("backHome")}</Link>
        </div>
      </div>
    );
  }

  if (!booking) return null;

  const statusInfo = STATUS_CONFIG[isExpired && booking.status !== "CANCELLED" ? "EXPIRED" : booking.status]
    || { label: booking.status, color: "text-gray-600 bg-gray-100 border-gray-300", icon: "📋" };

  return (
    <div className="min-h-screen text-black" style={{ fontFamily: "Arial, sans-serif", background: "linear-gradient(to right, #DDEFBB, #FFEEEE)" }}>
      <Navbar />
      <div className="max-w-lg mx-auto px-6 py-10">
        {/* Back */}
        <div className="mb-5">
          <Link href="/" className="text-sm text-emerald-600 hover:underline">{t("backHome")}</Link>
        </div>

        {/* Hóa đơn card */}
        <div className="border border-gray-300 rounded-2xl overflow-hidden shadow-sm" style={{ background: "#fff" }}>
          {/* Header */}
          <div className="px-6 py-5 text-center" style={{ background: "linear-gradient(to right, #DDEFBB, #c8eecc)" }}>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">SportHub</p>
            <h1 className="text-xl font-bold text-gray-800">{t("invoiceHeader")}</h1>
            <p className="text-sm text-gray-500 mt-1">{t("bookingCode")} #{booking.id}</p>

            {/* Status badge */}
            <div className="mt-3 flex justify-center">
              <span className={`inline-flex items-center gap-1.5 text-sm font-medium px-4 py-1.5 rounded-full border ${statusInfo.color}`}>
                <span>{statusInfo.icon}</span>
                {statusInfo.label}
              </span>
            </div>

            {/* Countdown */}
            {!isExpired && countdown && (
              <div className="mt-3 inline-flex items-center gap-1.5 bg-white/70 rounded-xl px-4 py-2 text-sm text-emerald-700 font-medium">
                <span>⏱</span> {t("invoiceValid")}: <span className="font-bold">{countdown}</span>
              </div>
            )}
            {isExpired && booking.status !== "CANCELLED" && (
              <p className="mt-3 text-sm text-gray-500">{t("invoiceExpiredMsg")}</p>
            )}
          </div>

          {/* Body */}
          <div className="px-6 py-5 space-y-4">
            {/* Thông tin khách */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{t("guestInfo")}</p>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">{t("fullName")}</span>
                  <span className="font-medium">{booking.guestName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">{t("phone")}</span>
                  <span className="font-medium">{booking.guestPhone}</span>
                </div>
                {booking.guestEmail && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">{t("email")}</span>
                    <span className="font-medium">{booking.guestEmail}</span>
                  </div>
                )}
              </div>
            </div>

            <hr className="border-gray-100" />

            {/* Thông tin sân */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{t("courtInfo")}</p>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">{t("facility")}</span>
                  <span className="font-medium text-right max-w-[200px]">{booking.court.facility}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">{t("address")}</span>
                  <span className="font-medium text-right max-w-[200px] text-xs">{booking.court.address}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">{t("court")}</span>
                  <span className="font-medium">{booking.court.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">{t("sport")}</span>
                  <span className="font-medium">{booking.court.sport}</span>
                </div>
              </div>
            </div>

            <hr className="border-gray-100" />

            {/* Thời gian */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{t("schedule")}</p>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">{t("day")}</span>
                  <span className="font-medium">{formatDate(booking.bookingDate)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">{t("slot")}</span>
                  <span className="font-medium">{formatTime(booking.startTime)} – {formatTime(booking.endTime)}</span>
                </div>
              </div>
            </div>

            <hr className="border-gray-100" />

            {/* Thanh toán */}
            <div className="rounded-xl p-4" style={{ background: "#f0f9f4" }}>
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm font-semibold text-gray-700">{t("totalAmount")}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{t("payAtVenueNote")}</p>
                </div>
                <p className="text-2xl font-bold text-emerald-600">
                  {Number(booking.totalPrice).toLocaleString("vi-VN")}đ
                </p>
              </div>
            </div>

            {/* Ngày tạo */}
            <p className="text-xs text-gray-400 text-center">
              {t("bookedAt")}: {formatDateTime(booking.createdAt)}
            </p>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-100 flex gap-3" style={{ background: "#fafafa" }}>
            <Link
              href="/guest-booking"
              className="flex-1 text-center bg-emerald-500 hover:bg-emerald-400 text-white py-3 rounded-xl text-sm font-semibold transition-colors"
            >
              {t("bookAnother")}
            </Link>
            <Link
              href={`/guest-booking/lookup`}
              className="flex-1 text-center bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 py-3 rounded-xl text-sm font-semibold transition-colors"
            >
              {t("lookupSchedule")}
            </Link>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-5">
          {t("invoiceNote")}
        </p>
      </div>
    </div>
  );
}
