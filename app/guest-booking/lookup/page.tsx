"use client";
import { useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";

interface Booking {
  id: number;
  guestName: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  totalPrice: string;
  status: string;
  expiredAt: string;
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
  return new Date(iso).toLocaleDateString("vi-VN");
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  PENDING: { label: "Chờ xác nhận", color: "text-yellow-600 bg-yellow-50 border-yellow-200" },
  CONFIRMED: { label: "Đã xác nhận", color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
  PAID: { label: "Đã thanh toán", color: "text-blue-600 bg-blue-50 border-blue-200" },
  CANCELLED: { label: "Đã hủy", color: "text-red-600 bg-red-50 border-red-200" },
};

export default function GuestLookupPage() {
  const [phone, setPhone] = useState("");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSearch() {
    if (!phone) return;
    setLoading(true);
    const res = await fetch(`/api/guest-bookings/lookup?phone=${encodeURIComponent(phone)}`);
    const data = await res.json();
    setLoading(false);
    setSearched(true);
    if (res.ok) setBookings(data);
    else setBookings([]);
  }

  return (
    <div className="min-h-screen text-black" style={{ fontFamily: "Arial, sans-serif", background: "linear-gradient(to right, #DDEFBB, #FFEEEE)" }}>
      <Navbar />
      <div className="max-w-2xl mx-auto px-6 py-10">
        <div className="mb-6">
          <Link href="/" className="text-sm text-emerald-600 hover:underline">← Về trang chủ</Link>
          <h1 className="text-2xl font-bold text-black mt-2">Tra cứu lịch đặt sân</h1>
          <p className="text-gray-500 text-sm mt-1">Nhập số điện thoại đã dùng khi đặt sân để xem lịch</p>
        </div>

        <div className="border border-gray-300 rounded-2xl p-5 mb-6" style={{ background: "#E0EEE0" }}>
          <div className="flex gap-3">
            <input
              type="tel"
              placeholder="Nhập số điện thoại..."
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="flex-1 border border-gray-300 rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:border-emerald-400"
            />
            <button
              onClick={handleSearch}
              disabled={loading || !phone}
              className="bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-300 text-white px-6 py-3 rounded-xl text-sm font-semibold transition-colors"
            >
              {loading ? "..." : "Tra cứu"}
            </button>
          </div>
        </div>

        {searched && bookings.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <div className="text-4xl mb-3">📭</div>
            <p>Không tìm thấy lịch đặt sân nào còn hiệu lực.</p>
            <Link href="/guest-booking" className="text-emerald-600 hover:underline text-sm mt-2 inline-block">
              Đặt sân ngay →
            </Link>
          </div>
        )}

        {bookings.length > 0 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">Tìm thấy <span className="font-semibold">{bookings.length}</span> lịch đặt:</p>
            {bookings.map((b) => {
              const status = STATUS_LABEL[b.status] || { label: b.status, color: "text-gray-600 bg-gray-50 border-gray-200" };
              return (
                <div key={b.id} className="border border-gray-300 rounded-2xl p-5" style={{ background: "#E0EEE0" }}>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-semibold text-black">{b.court.facility}</p>
                      <p className="text-sm text-gray-500">{b.court.address}</p>
                    </div>
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${status.color}`}>
                      {status.label}
                    </span>
                  </div>
                  <div className="bg-white rounded-xl p-4 space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Sân</span>
                      <span className="font-medium">{b.court.name} ({b.court.sport})</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Ngày</span>
                      <span className="font-medium">{formatDate(b.bookingDate)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Giờ</span>
                      <span className="font-medium">{formatTime(b.startTime)} – {formatTime(b.endTime)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Thanh toán tại sân</span>
                      <span className="font-semibold text-emerald-600">
                        {Number(b.totalPrice).toLocaleString("vi-VN")}đ
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <p className="text-xs text-gray-400">Mã đặt: #{b.id}</p>
                    <Link
                      href={`/guest-booking/invoice/${b.id}?phone=${encodeURIComponent(phone)}`}
                      className="text-xs font-semibold text-emerald-600 hover:text-emerald-500 underline"
                    >
                      Xem hóa đơn →
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
