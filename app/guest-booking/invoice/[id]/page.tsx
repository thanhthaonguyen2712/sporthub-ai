"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";

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

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  PENDING:   { label: "Chờ xác nhận", color: "text-yellow-700 bg-yellow-50 border-yellow-300", icon: "⏳" },
  CONFIRMED: { label: "Đã xác nhận",  color: "text-emerald-700 bg-emerald-50 border-emerald-300", icon: "✅" },
  PAID:      { label: "Đã thanh toán", color: "text-blue-700 bg-blue-50 border-blue-300", icon: "💳" },
  CANCELLED: { label: "Đã hủy",        color: "text-red-700 bg-red-50 border-red-300", icon: "❌" },
  EXPIRED:   { label: "Đã hết hạn",   color: "text-gray-600 bg-gray-100 border-gray-300", icon: "🕐" },
};

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

function getCountdown(expiredAt: string): string | null {
  const diff = new Date(expiredAt).getTime() - Date.now();
  if (diff <= 0) return null;
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  if (h > 0) return `${h}h ${m}m còn lại`;
  if (m > 0) return `${m}m ${s}s còn lại`;
  return `${s}s còn lại`;
}

export default function GuestInvoicePage() {
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
      setError(data.error || "Có lỗi xảy ra");
    }
  }, [id]);

  useEffect(() => {
    if (phone) fetchBooking(phone);
  }, [phone, fetchBooking]);

  // Countdown timer
  useEffect(() => {
    if (!booking) return;
    const timer = setInterval(() => {
      const cd = getCountdown(booking.expiredAt);
      setCountdown(cd);
      if (!cd) {
        setIsExpired(true);
        clearInterval(timer);
      }
    }, 1000);
    setCountdown(getCountdown(booking.expiredAt));
    return () => clearInterval(timer);
  }, [booking]);

  // Chưa có phone — hiển thị form nhập SĐT
  if (!phone) {
    return (
      <div className="min-h-screen text-black" style={{ fontFamily: "Arial, sans-serif", background: "linear-gradient(to right, #DDEFBB, #FFEEEE)" }}>
        <Navbar />
        <div className="max-w-md mx-auto px-6 py-16 text-center">
          <div className="text-5xl mb-4">🧾</div>
          <h1 className="text-xl font-bold mb-2">Xem hóa đơn đặt sân</h1>
          <p className="text-gray-500 text-sm mb-6">Nhập số điện thoại đã dùng khi đặt sân để xem hóa đơn #{id}</p>
          <div className="border border-gray-300 rounded-2xl p-5" style={{ background: "#E0EEE0" }}>
            <input
              type="tel"
              placeholder="Số điện thoại..."
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
              {loading ? "Đang tải..." : "Xem hóa đơn"}
            </button>
          </div>
          <Link href="/" className="text-sm text-emerald-600 hover:underline mt-4 inline-block">← Về trang chủ</Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "linear-gradient(to right, #DDEFBB, #FFEEEE)" }}>
        <div className="text-gray-500 text-sm">Đang tải hóa đơn...</div>
      </div>
    );
  }

  if (error && !booking) {
    return (
      <div className="min-h-screen text-black" style={{ fontFamily: "Arial, sans-serif", background: "linear-gradient(to right, #DDEFBB, #FFEEEE)" }}>
        <Navbar />
        <div className="max-w-md mx-auto px-6 py-20 text-center">
          <div className="text-5xl mb-4">❌</div>
          <h1 className="text-xl font-bold mb-2">Không tìm thấy hóa đơn</h1>
          <p className="text-gray-500 text-sm mb-6">{error}</p>
          <button
            onClick={() => { setPhone(""); setPhoneInput(""); setError(""); }}
            className="bg-emerald-500 hover:bg-emerald-400 text-white px-6 py-3 rounded-xl text-sm font-semibold mr-3 transition-colors"
          >
            Thử lại
          </button>
          <Link href="/" className="text-sm text-gray-600 hover:underline">Về trang chủ</Link>
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
          <Link href="/" className="text-sm text-emerald-600 hover:underline">← Về trang chủ</Link>
        </div>

        {/* Hóa đơn card */}
        <div className="border border-gray-300 rounded-2xl overflow-hidden shadow-sm" style={{ background: "#fff" }}>
          {/* Header */}
          <div className="px-6 py-5 text-center" style={{ background: "linear-gradient(to right, #DDEFBB, #c8eecc)" }}>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">SportHub</p>
            <h1 className="text-xl font-bold text-gray-800">HÓA ĐƠN ĐẶT SÂN</h1>
            <p className="text-sm text-gray-500 mt-1">Mã đặt sân #{booking.id}</p>

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
                <span>⏱</span> Hóa đơn còn hiệu lực: <span className="font-bold">{countdown}</span>
              </div>
            )}
            {isExpired && booking.status !== "CANCELLED" && (
              <p className="mt-3 text-sm text-gray-500">Hóa đơn đã hết hiệu lực sau giờ thuê sân</p>
            )}
          </div>

          {/* Body */}
          <div className="px-6 py-5 space-y-4">
            {/* Thông tin khách */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Thông tin khách</p>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Họ tên</span>
                  <span className="font-medium">{booking.guestName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Điện thoại</span>
                  <span className="font-medium">{booking.guestPhone}</span>
                </div>
                {booking.guestEmail && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Email</span>
                    <span className="font-medium">{booking.guestEmail}</span>
                  </div>
                )}
              </div>
            </div>

            <hr className="border-gray-100" />

            {/* Thông tin sân */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Thông tin sân</p>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Cơ sở</span>
                  <span className="font-medium text-right max-w-[200px]">{booking.court.facility}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Địa chỉ</span>
                  <span className="font-medium text-right max-w-[200px] text-xs">{booking.court.address}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Sân</span>
                  <span className="font-medium">{booking.court.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Môn</span>
                  <span className="font-medium">{booking.court.sport}</span>
                </div>
              </div>
            </div>

            <hr className="border-gray-100" />

            {/* Thời gian */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Lịch đặt sân</p>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Ngày</span>
                  <span className="font-medium">{formatDate(booking.bookingDate)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Khung giờ</span>
                  <span className="font-medium">{formatTime(booking.startTime)} – {formatTime(booking.endTime)}</span>
                </div>
              </div>
            </div>

            <hr className="border-gray-100" />

            {/* Thanh toán */}
            <div className="rounded-xl p-4" style={{ background: "#f0f9f4" }}>
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm font-semibold text-gray-700">Tổng tiền</p>
                  <p className="text-xs text-gray-500 mt-0.5">Thanh toán tại sân</p>
                </div>
                <p className="text-2xl font-bold text-emerald-600">
                  {Number(booking.totalPrice).toLocaleString("vi-VN")}đ
                </p>
              </div>
            </div>

            {/* Ngày tạo */}
            <p className="text-xs text-gray-400 text-center">
              Đặt lúc: {formatDateTime(booking.createdAt)}
            </p>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-100 flex gap-3" style={{ background: "#fafafa" }}>
            <Link
              href="/guest-booking"
              className="flex-1 text-center bg-emerald-500 hover:bg-emerald-400 text-white py-3 rounded-xl text-sm font-semibold transition-colors"
            >
              Đặt sân khác
            </Link>
            <Link
              href={`/guest-booking/lookup`}
              className="flex-1 text-center bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 py-3 rounded-xl text-sm font-semibold transition-colors"
            >
              Tra cứu lịch
            </Link>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-5">
          Vui lòng trình hóa đơn này khi đến sân. Hóa đơn có hiệu lực đến hết giờ thuê.
        </p>
      </div>
    </div>
  );
}
