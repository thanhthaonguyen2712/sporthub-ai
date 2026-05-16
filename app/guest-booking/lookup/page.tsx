"use client";
import { useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { useTranslations } from "next-intl";

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

interface MatchJoinResult {
  id: number;
  guestName: string;
  guestPhone: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
  matchPost: {
    title: string;
    matchDate: string;
    startTime: string;
    endTime: string;
    facility: { name: string; address: string };
    sport: { name: string };
    pricePerPerson: number | null;
  };
}

function formatTime(iso: string) {
  return new Date(iso).toISOString().substring(11, 16);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("vi-VN");
}

export default function GuestLookupPage() {
  const t = useTranslations("guestBooking");

  const STATUS_LABEL: Record<string, { label: string; color: string }> = {
    PENDING: { label: t("statusPending"), color: "text-yellow-600 bg-yellow-50 border-yellow-200" },
    CONFIRMED: { label: t("statusConfirmed"), color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
    PAID: { label: t("statusPaid"), color: "text-blue-600 bg-blue-50 border-blue-200" },
    CANCELLED: { label: t("statusCancelled"), color: "text-red-600 bg-red-50 border-red-200" },
  };

  const [phone, setPhone] = useState("");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [matchJoins, setMatchJoins] = useState<MatchJoinResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);

  const JOIN_STATUS: Record<string, { label: string; color: string }> = {
    PENDING: { label: "Chờ duyệt", color: "text-yellow-600 bg-yellow-50 border-yellow-200" },
    APPROVED: { label: "Đã được duyệt", color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
    REJECTED: { label: "Bị từ chối", color: "text-red-600 bg-red-50 border-red-200" },
  };

  async function handleSearch() {
    if (!phone) return;
    setLoading(true);
    const [bookingRes, joinRes] = await Promise.all([
      fetch(`/api/guest-bookings/lookup?phone=${encodeURIComponent(phone)}`),
      fetch(`/api/match-join-requests/lookup?phone=${encodeURIComponent(phone)}`),
    ]);
    const bookingData = await bookingRes.json();
    const joinData = await joinRes.json();
    setLoading(false);
    setSearched(true);
    setBookings(bookingRes.ok && Array.isArray(bookingData) ? bookingData : []);
    setMatchJoins(joinRes.ok && Array.isArray(joinData) ? joinData : []);
  }

  return (
    <div className="min-h-screen text-black" style={{ fontFamily: "Arial, sans-serif", background: "linear-gradient(to right, #DDEFBB, #FFEEEE)" }}>
      <Navbar />
      <div className="max-w-2xl mx-auto px-6 py-10">
        <div className="mb-6">
          <Link href="/" className="text-sm text-emerald-600 hover:underline">{t("backHome")}</Link>
          <h1 className="text-2xl font-bold text-black mt-2">{t("lookupTitle")}</h1>
          <p className="text-gray-500 text-sm mt-1">{t("lookupSubtitle")}</p>
        </div>

        <div className="border border-gray-300 rounded-2xl p-5 mb-6" style={{ background: "#E0EEE0" }}>
          <div className="flex gap-3">
            <input
              type="tel"
              placeholder={t("phoneLookupPlaceholder")}
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
              {loading ? "..." : t("search")}
            </button>
          </div>
        </div>

        {searched && bookings.length === 0 && matchJoins.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <div className="text-4xl mb-3">📭</div>
            <p>{t("noBookings")}</p>
            <Link href="/guest-booking" className="text-emerald-600 hover:underline text-sm mt-2 inline-block">
              {t("bookNow")}
            </Link>
          </div>
        )}

        {/* Ghép trận kết quả */}
        {matchJoins.length > 0 && (
          <div className="space-y-4 mb-6">
            <p className="text-sm text-gray-600 font-medium">Yêu cầu ghép trận ({matchJoins.length})</p>
            {matchJoins.map((jn) => {
              const s = JOIN_STATUS[jn.status] || { label: jn.status, color: "text-gray-600 bg-gray-50 border-gray-200" };
              return (
                <div key={jn.id} className="border border-gray-300 rounded-2xl p-5" style={{ background: "#E0EEE0" }}>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-semibold text-black">{jn.matchPost.facility.name}</p>
                      <p className="text-sm text-gray-500">{jn.matchPost.facility.address}</p>
                    </div>
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${s.color}`}>{s.label}</span>
                  </div>
                  <div className="bg-white rounded-xl p-4 space-y-1.5 text-sm">
                    <div className="flex justify-between"><span className="text-gray-500">Trận</span><span className="font-medium">{jn.matchPost.title}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Môn</span><span className="font-medium">{jn.matchPost.sport.name}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Ngày</span><span className="font-medium">{new Date(jn.matchPost.matchDate).toLocaleDateString("vi-VN")}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Giờ</span><span className="font-medium">{jn.matchPost.startTime}–{jn.matchPost.endTime}</span></div>
                    {jn.matchPost.pricePerPerson && (
                      <div className="flex justify-between"><span className="text-gray-500">Phí</span><span className="font-semibold text-emerald-600">{jn.matchPost.pricePerPerson.toLocaleString("vi-VN")}đ</span></div>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-2">Mã yêu cầu: #{jn.id}</p>
                </div>
              );
            })}
          </div>
        )}

        {bookings.length > 0 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">{t("found", { count: bookings.length })}</p>
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
                      <span className="text-gray-500">{t("court")}</span>
                      <span className="font-medium">{b.court.name} ({b.court.sport})</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">{t("day")}</span>
                      <span className="font-medium">{formatDate(b.bookingDate)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">{t("time")}</span>
                      <span className="font-medium">{formatTime(b.startTime)} – {formatTime(b.endTime)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">{t("payAtVenueNote")}</span>
                      <span className="font-semibold text-emerald-600">
                        {Number(b.totalPrice).toLocaleString("vi-VN")}đ
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <p className="text-xs text-gray-400">{t("bookingRef")}: #{b.id}</p>
                    <Link
                      href={`/guest-booking/invoice/${b.id}?phone=${encodeURIComponent(phone)}`}
                      className="text-xs font-semibold text-emerald-600 hover:text-emerald-500 underline"
                    >
                      {t("viewInvoiceLink")}
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
