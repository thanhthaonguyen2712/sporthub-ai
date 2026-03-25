"use client";
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Image from "next/image";
import Navbar from "@/components/Navbar";

interface BookingDetail {
  id: number;
  bookingDate: string;
  startTime: string;
  endTime: string;
  totalPrice: number;
  courtName: string;
  categoryId: number;
  facility: { id: number; name: string; address: string };
}

export default function BookingSuccessPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = searchParams.get("id");

  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [step, setStep] = useState<"ask" | "form" | "done">("ask");
  const [tmForm, setTmForm] = useState({ requiredPlayers: "4", level: "BEGINNER", description: "" });
  const [tmSubmitting, setTmSubmitting] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/bookings/${id}`)
      .then((r) => r.json())
      .then((data) => { if (data.id) setBooking(data); });
  }, [id]);

  async function handleTeammatePost() {
    if (!booking) return;
    setTmSubmitting(true);
    const numRequired = Number(tmForm.requiredPlayers);
    const res = await fetch("/api/match-posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        facilityId: booking.facility.id,
        categoryId: booking.categoryId,
        matchDate: booking.bookingDate.split("T")[0],
        startTime: booking.startTime,
        endTime: booking.endTime,
        level: tmForm.level,
        requiredPlayers: numRequired,
        description: tmForm.description,
        bookingId: booking.id,
        courtName: booking.courtName,
        totalPrice: booking.totalPrice,
      }),
    });
    setTmSubmitting(false);
    if (res.ok) setStep("done");
    else {
      const d = await res.json();
      alert(d.error || "Không thể đăng bài!");
    }
  }

  const pricePerPerson = booking && Number(tmForm.requiredPlayers) > 1
    ? Math.ceil(booking.totalPrice / Number(tmForm.requiredPlayers))
    : 0;

  if (step === "done") {
    return (
      <div className="min-h-screen" style={{ fontFamily: "Arial, sans-serif", background: "linear-gradient(to right, #DDEFBB, #FFEEEE)" }}>
        <Navbar />
        <div className="max-w-lg mx-auto px-6 py-20 text-center">
          <div className="border border-gray-300 rounded-2xl p-10" style={{ background: "#E0EEE0" }}>
            <div className="flex justify-center mb-4">
              <Image src="/group.png" alt="Đồng đội" width={72} height={72} />
            </div>
            <h2 className="text-2xl font-bold text-black mb-4">Đã đăng tìm đồng đội!</h2>
            <p className="text-gray-600 text-sm mb-6">Bài đăng của bạn đã được công khai. Mọi người có thể tham gia nhóm của bạn.</p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => router.push("/profile?tab=bookings")}
                className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white px-6 py-2.5 rounded-xl text-sm font-medium transition-colors">
                <Image src="/list.png" alt="" width={16} height={16} />
                Xem lịch đặt sân
              </button>
              <button onClick={() => router.push("/")}
                className="bg-white border border-gray-300 text-gray-600 hover:border-emerald-400 px-6 py-2.5 rounded-xl text-sm transition-colors">
                Về trang chủ
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === "form" && booking) {
    return (
      <div className="min-h-screen" style={{ fontFamily: "Arial, sans-serif", background: "linear-gradient(to right, #DDEFBB, #FFEEEE)" }}>
        <Navbar />
        <div className="max-w-lg mx-auto px-6 py-8">
          <div className="border border-gray-300 rounded-2xl p-6" style={{ background: "#E0EEE0" }}>
            <div className="flex items-center gap-3 mb-5">
              <Image src="/group.png" alt="group" width={32} height={32} />
              <h2 className="text-xl font-bold text-black">Tìm đồng đội</h2>
            </div>

            {/* Booking info */}
            <div className="bg-white border border-gray-200 rounded-xl p-4 mb-5 space-y-2 text-sm">
              <div className="flex items-center gap-2 text-gray-700">
                <Image src="/placeholder.png" alt="" width={16} height={16} className="flex-shrink-0" />
                <span className="font-medium">{booking.courtName}</span>
                <span className="text-gray-400">·</span>
                <span className="text-gray-500">{booking.facility.name}</span>
              </div>
              <div className="text-gray-500 pl-6">{booking.facility.address}</div>
              <div className="flex items-center gap-2 text-gray-700">
                <Image src="/calendar.png" alt="" width={16} height={16} className="flex-shrink-0" />
                <span>
                  {new Date(booking.bookingDate).toLocaleDateString("vi-VN", { weekday: "short", day: "2-digit", month: "2-digit" })}
                  {" · "}{booking.startTime} – {booking.endTime}
                </span>
              </div>
              <div className="flex items-center gap-2 text-gray-700 border-t border-gray-100 pt-2">
                <Image src="/atm-card.png" alt="" width={16} height={16} className="flex-shrink-0" />
                <span>Tổng đã trả: <span className="font-semibold text-emerald-600">{booking.totalPrice.toLocaleString("vi-VN")}đ</span></span>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-600 font-medium mb-1 block">Cần bao nhiêu người? (bao gồm bạn)</label>
                <input type="number" min="2" max="30"
                  value={tmForm.requiredPlayers}
                  onChange={(e) => setTmForm((f) => ({ ...f, requiredPlayers: e.target.value }))}
                  className="w-full bg-white border border-gray-300 text-black rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-400"
                />
              </div>

              {pricePerPerson > 0 && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                  <p className="text-xs text-emerald-700 font-medium">
                    Mỗi người trả: <span className="text-base font-bold">{pricePerPerson.toLocaleString("vi-VN")}đ</span>
                  </p>
                  <p className="text-xs text-emerald-600 mt-0.5">
                    = {booking.totalPrice.toLocaleString("vi-VN")}đ ÷ {tmForm.requiredPlayers} người · Thanh toán qua ví SportHub
                  </p>
                </div>
              )}

              <div>
                <label className="text-xs text-gray-600 font-medium mb-1 block">Trình độ</label>
                <select value={tmForm.level} onChange={(e) => setTmForm((f) => ({ ...f, level: e.target.value }))}
                  className="w-full bg-white border border-gray-300 text-black rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-400">
                  <option value="BEGINNER">Người mới</option>
                  <option value="INTERMEDIATE">Trung bình</option>
                  <option value="PRO">Chuyên nghiệp</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-gray-600 font-medium mb-1 block">Mô tả (không bắt buộc)</label>
                <textarea value={tmForm.description}
                  onChange={(e) => setTmForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="VD: Tìm 3 bạn cùng chơi cầu lông, vui vẻ là chính..."
                  rows={3}
                  className="w-full bg-white border border-gray-300 text-black rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-400 resize-none"
                />
              </div>

              <div className="flex gap-3">
                <button onClick={handleTeammatePost} disabled={tmSubmitting}
                  className="flex-1 bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-300 text-white py-3 rounded-xl text-sm font-semibold transition-colors">
                  {tmSubmitting ? "Đang đăng..." : "Đăng tìm đồng đội"}
                </button>
                <button onClick={() => router.push("/profile?tab=bookings")}
                  className="flex-1 bg-white border border-gray-300 text-gray-600 hover:border-emerald-400 py-3 rounded-xl text-sm transition-colors">
                  Bỏ qua
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // step === "ask"
  return (
    <div className="min-h-screen" style={{ fontFamily: "Arial, sans-serif", background: "linear-gradient(to right, #DDEFBB, #FFEEEE)" }}>
      <Navbar />
      <div className="max-w-lg mx-auto px-6 py-20 text-center">
        <div className="border border-gray-300 rounded-2xl p-10" style={{ background: "#E0EEE0" }}>
          <div className="flex justify-center mb-4">
            <Image src="/giftbox.png" alt="Thành công" width={72} height={72} />
          </div>
          <h2 className="text-2xl font-bold text-black mb-4">Đặt sân thành công!</h2>
          <div className="bg-white border border-gray-200 rounded-xl px-5 py-4 mb-4 text-left space-y-2">
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <Image src="/atm-card.png" alt="Thanh toán" width={20} height={20} />
              <span>Thanh toán VNPay thành công</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <Image src="/list.png" alt="Mã booking" width={20} height={20} />
              <span>Mã booking: <span className="font-bold text-emerald-600">#{id}</span></span>
            </div>
          </div>

          {/* Tìm đồng đội CTA */}
          <div className="bg-white border border-emerald-200 rounded-xl px-5 py-4 mb-6 text-left">
            <div className="flex items-center gap-2 mb-2">
              <Image src="/group.png" alt="group" width={20} height={20} />
              <span className="font-semibold text-black text-sm">Bạn muốn tìm đồng đội?</span>
            </div>
            <p className="text-xs text-gray-500 mb-3">Đăng bài để mọi người cùng tham gia và chia sẻ chi phí sân.</p>
            <button onClick={() => setStep("form")}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2">
              <Image src="/group.png" alt="" width={16} height={16} />
              Tìm đồng đội
            </button>
          </div>

          <div className="flex gap-3 justify-center">
            <button onClick={() => router.push("/profile?tab=bookings")}
              className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white px-6 py-2.5 rounded-xl text-sm font-medium transition-colors">
              <Image src="/list.png" alt="" width={16} height={16} />
              Xem lịch đặt sân
            </button>
            <button onClick={() => router.push("/")}
              className="bg-white border border-gray-300 text-gray-600 hover:border-emerald-400 px-6 py-2.5 rounded-xl text-sm transition-colors">
              Về trang chủ
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
