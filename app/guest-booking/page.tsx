"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";

interface Facility {
  id: number;
  name: string;
  address: string;
  courts: Court[];
}

interface Court {
  id: number;
  name: string;
  category: { name: string };
  pricingRules: { dayType: string; startTime: string; endTime: string; pricePerHour: number }[];
}

interface Slot {
  time: string;
  endTime: string;
  duration: number;
  label: string;
  price: number;
}

function addMinutes(time: string, mins: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + mins;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function toMinutes(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function getPrice(pricingRules: Court["pricingRules"], dayType: string, slotTime: string): number {
  const slotMins = toMinutes(slotTime);
  const rule = pricingRules.find((r) => {
    const matches = r.dayType === dayType || r.dayType === "ALL";
    const start = toMinutes(r.startTime.substring(11, 16));
    const end = toMinutes(r.endTime.substring(11, 16));
    return matches && slotMins >= start && slotMins < end;
  });
  return rule ? Number(rule.pricePerHour) : 100000;
}

function generateSlots(sportName: string, pricingRules: Court["pricingRules"], dayType: string): Slot[] {
  const isOneHour = ["Bóng đá", "Bóng rổ"].includes(sportName);
  const slots: Slot[] = [];

  for (let h = 6; h < 17; h++) {
    if (isOneHour) {
      const time = `${String(h).padStart(2, "0")}:00`;
      const end = addMinutes(time, 60);
      const price = getPrice(pricingRules, dayType, time);
      slots.push({ time, endTime: end, duration: 60, label: `${time} – ${end}`, price });
    } else {
      for (const m of [0, 30]) {
        const time = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
        const end = addMinutes(time, 30);
        const price = getPrice(pricingRules, dayType, time);
        slots.push({ time, endTime: end, duration: 30, label: `${time} – ${end}`, price });
      }
    }
  }

  const peakSlots = [
    { time: "17:00", end: "19:00", dur: 120 },
    { time: "19:00", end: "21:00", dur: 120 },
  ];
  for (const p of peakSlots) {
    slots.push({ time: p.time, endTime: p.end, duration: p.dur, label: `${p.time} – ${p.end}`, price: getPrice(pricingRules, dayType, p.time) });
  }

  if (isOneHour) {
    slots.push({ time: "21:00", endTime: "22:00", duration: 60, label: "21:00 – 22:00", price: getPrice(pricingRules, dayType, "21:00") });
  } else {
    slots.push({ time: "21:00", endTime: "21:30", duration: 30, label: "21:00 – 21:30", price: getPrice(pricingRules, dayType, "21:00") });
    slots.push({ time: "21:30", endTime: "22:00", duration: 30, label: "21:30 – 22:00", price: getPrice(pricingRules, dayType, "21:30") });
  }

  return slots;
}

export default function GuestBookingPage() {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [selectedFacilityId, setSelectedFacilityId] = useState<number | null>(null);
  const [selectedCourt, setSelectedCourt] = useState<Court | null>(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [bookedSlots, setBookedSlots] = useState<{ start: string; end: string }[]>([]);
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [bookingId, setBookingId] = useState<number | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/facilities")
      .then((r) => r.json())
      .then(async (list: { id: number }[]) => {
        const details = await Promise.all(
          list.map((f) => fetch(`/api/facilities/${f.id}`).then((r) => r.json()))
        );
        setFacilities(details);
      });
  }, []);

  const facility = facilities.find((f) => f.id === selectedFacilityId) || null;

  useEffect(() => {
    setSelectedCourt(null);
    setSelectedSlot(null);
    setBookedSlots([]);
  }, [selectedFacilityId]);

  useEffect(() => {
    setSelectedSlot(null);
    setBookedSlots([]);
    if (!selectedCourt || !selectedDate) return;
    fetch(`/api/guest-bookings/slots?courtId=${selectedCourt.id}&date=${selectedDate}`)
      .then((r) => r.json())
      .then(setBookedSlots);
  }, [selectedCourt, selectedDate]);

  function isBooked(slot: Slot) {
    const slotStart = toMinutes(slot.time);
    const slotEnd = toMinutes(slot.endTime);
    return bookedSlots.some((b) => {
      const bStart = toMinutes(b.start);
      const bEnd = toMinutes(b.end);
      return slotStart < bEnd && slotEnd > bStart;
    });
  }

  function getDayType(date: string) {
    const day = new Date(date).getDay();
    return day === 0 || day === 6 ? "WEEKEND" : "WEEKDAY";
  }

  const slots = selectedCourt && selectedDate
    ? generateSlots(selectedCourt.category.name, selectedCourt.pricingRules, getDayType(selectedDate))
    : [];

  const today = new Date().toISOString().split("T")[0];

  async function handleSubmit() {
    if (!selectedCourt || !selectedDate || !selectedSlot || !guestName || !guestPhone) {
      setError("Vui lòng điền đầy đủ thông tin!");
      return;
    }
    setError("");
    setLoading(true);
    const res = await fetch("/api/guest-bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        guestName,
        guestPhone,
        guestEmail,
        courtId: selectedCourt.id,
        bookingDate: selectedDate,
        startTime: selectedSlot.time,
        endTime: selectedSlot.endTime,
        totalPrice: selectedSlot.price,
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (res.ok) {
      setSuccess(true);
      setBookingId(data.bookingId);
    } else {
      setError(data.error || "Có lỗi xảy ra!");
    }
  }

  if (success) {
    return (
      <div className="min-h-screen" style={{ fontFamily: "Arial, sans-serif", background: "linear-gradient(to right, #DDEFBB, #FFEEEE)" }}>
        <Navbar />
        <div className="max-w-lg mx-auto px-6 py-20 text-center">
          <div className="text-6xl mb-4">✅</div>
          <h1 className="text-2xl font-bold text-black mb-2">Đặt sân thành công!</h1>
          <p className="text-gray-600 mb-1">Mã đặt sân: <span className="font-semibold text-emerald-600">#{bookingId}</span></p>
          <p className="text-gray-600 mb-6">Dùng số điện thoại <span className="font-semibold">{guestPhone}</span> để tra cứu lịch đặt.</p>
          <div className="flex gap-3 justify-center">
            <Link href={`/guest-booking/invoice/${bookingId}?phone=${encodeURIComponent(guestPhone)}`}
              className="bg-emerald-500 hover:bg-emerald-400 text-white px-6 py-3 rounded-xl text-sm font-semibold transition-colors">
              Xem hóa đơn
            </Link>
            <Link href="/guest-booking/lookup"
              className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 px-6 py-3 rounded-xl text-sm font-semibold transition-colors">
              Tra cứu lịch đặt
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-black" style={{ fontFamily: "Arial, sans-serif", background: "linear-gradient(to right, #DDEFBB, #FFEEEE)" }}>
      <Navbar />
      <div className="max-w-2xl mx-auto px-6 py-10">
        <div className="mb-6">
          <Link href="/" className="text-sm text-emerald-600 hover:underline">← Về trang chủ</Link>
          <h1 className="text-2xl font-bold text-black mt-2">Đặt sân không cần tài khoản</h1>
          <p className="text-gray-500 text-sm mt-1">Điền thông tin bên dưới để đặt sân nhanh chóng</p>
        </div>

        <div className="space-y-5">
          {/* Chọn cơ sở */}
          <div className="border border-gray-300 rounded-2xl p-5" style={{ background: "#E0EEE0" }}>
            <h2 className="font-semibold text-black mb-3">1. Chọn cơ sở</h2>
            <select
              value={selectedFacilityId ?? ""}
              onChange={(e) => setSelectedFacilityId(e.target.value ? Number(e.target.value) : null)}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:border-emerald-400"
            >
              <option value="">-- Chọn cơ sở --</option>
              {facilities.map((f) => (
                <option key={f.id} value={f.id}>{f.name} – {f.address}</option>
              ))}
            </select>
          </div>

          {/* Chọn sân */}
          {facility && (
            <div className="border border-gray-300 rounded-2xl p-5" style={{ background: "#E0EEE0" }}>
              <h2 className="font-semibold text-black mb-3">2. Chọn sân</h2>
              <div className="grid grid-cols-2 gap-2">
                {facility.courts.map((court) => (
                  <button
                    key={court.id}
                    onClick={() => setSelectedCourt(court)}
                    className={`p-3 rounded-xl text-sm border transition-colors text-left ${
                      selectedCourt?.id === court.id
                        ? "bg-emerald-100 border-emerald-400 text-emerald-700 font-medium"
                        : "bg-white border-gray-300 text-gray-700 hover:border-emerald-300"
                    }`}
                  >
                    <p className="font-medium">{court.name}</p>
                    <p className="text-xs text-gray-500">{court.category.name}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Chọn ngày */}
          {selectedCourt && (
            <div className="border border-gray-300 rounded-2xl p-5" style={{ background: "#E0EEE0" }}>
              <h2 className="font-semibold text-black mb-3">3. Chọn ngày</h2>
              <input
                type="date"
                min={today}
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:border-emerald-400"
              />
            </div>
          )}

          {/* Chọn khung giờ */}
          {selectedDate && slots.length > 0 && (
            <div className="border border-gray-300 rounded-2xl p-5" style={{ background: "#E0EEE0" }}>
              <h2 className="font-semibold text-black mb-3">4. Chọn khung giờ</h2>
              <div className="grid grid-cols-2 gap-2">
                {slots.map((slot) => {
                  const booked = isBooked(slot);
                  const selected = selectedSlot?.time === slot.time;
                  return (
                    <button
                      key={slot.time}
                      disabled={booked}
                      onClick={() => setSelectedSlot(slot)}
                      className={`p-3 rounded-xl text-sm border transition-colors text-left ${
                        booked
                          ? "bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed"
                          : selected
                          ? "bg-emerald-100 border-emerald-400 text-emerald-700 font-medium"
                          : "bg-white border-gray-300 text-gray-700 hover:border-emerald-300"
                      }`}
                    >
                      <p className="font-medium">{slot.label}</p>
                      <p className="text-xs mt-0.5">
                        {booked ? "Đã đặt" : `${slot.price.toLocaleString("vi-VN")}đ`}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Thông tin khách */}
          {selectedSlot && (
            <div className="border border-gray-300 rounded-2xl p-5" style={{ background: "#E0EEE0" }}>
              <h2 className="font-semibold text-black mb-3">5. Thông tin của bạn</h2>
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Họ và tên *"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:border-emerald-400"
                />
                <input
                  type="tel"
                  placeholder="Số điện thoại * (dùng để tra cứu lịch)"
                  value={guestPhone}
                  onChange={(e) => setGuestPhone(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:border-emerald-400"
                />
                <input
                  type="email"
                  placeholder="Email (không bắt buộc)"
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:border-emerald-400"
                />
              </div>

              {/* Tổng kết */}
              <div className="mt-4 p-4 bg-white rounded-xl border border-gray-200">
                <p className="text-sm text-gray-600">Sân: <span className="font-medium text-black">{selectedCourt?.name}</span></p>
                <p className="text-sm text-gray-600">Ngày: <span className="font-medium text-black">{new Date(selectedDate).toLocaleDateString("vi-VN")}</span></p>
                <p className="text-sm text-gray-600">Giờ: <span className="font-medium text-black">{selectedSlot.label}</span></p>
                <p className="text-sm text-gray-600 mt-1">Thanh toán tại sân: <span className="font-semibold text-emerald-600 text-base">{selectedSlot.price.toLocaleString("vi-VN")}đ</span></p>
              </div>
            </div>
          )}

          {error && <p className="text-red-500 text-sm text-center">{error}</p>}

          {selectedSlot && (
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-300 text-white py-4 rounded-xl font-semibold transition-colors"
            >
              {loading ? "Đang xử lý..." : "Xác nhận đặt sân"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
