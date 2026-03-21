// ─── Ngày lễ Việt Nam ─────────────────────────────────────────────────────────
// Lễ cố định (tháng, ngày)
const FIXED_HOLIDAYS: [number, number][] = [
  [1, 1],   // Tết Dương lịch
  [4, 30],  // Ngày Giải phóng miền Nam
  [5, 1],   // Quốc tế Lao động
  [9, 2],   // Quốc khánh
];

// Lễ biến đổi (YYYY-MM-DD)
const VARIABLE_HOLIDAYS: string[] = [
  // Giỗ Tổ Hùng Vương
  "2025-04-07",
  "2026-03-28",
  // Tết Nguyên Đán 2025 (29/1 – 2/2)
  "2025-01-28", "2025-01-29", "2025-01-30", "2025-01-31",
  "2025-02-01", "2025-02-02", "2025-02-03",
  // Tết Nguyên Đán 2026 (17/2 – 21/2)
  "2026-02-16", "2026-02-17", "2026-02-18", "2026-02-19",
  "2026-02-20", "2026-02-21", "2026-02-22",
];

export function isHoliday(dateStr: string): boolean {
  if (VARIABLE_HOLIDAYS.includes(dateStr)) return true;
  const d = new Date(dateStr + "T00:00:00");
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return FIXED_HOLIDAYS.some(([hm, hd]) => hm === m && hd === day);
}

export function isWeekend(dateStr: string): boolean {
  const dow = new Date(dateStr + "T00:00:00").getDay();
  return dow === 0 || dow === 6; // 0 = CN, 6 = T7
}

export function isSpecialDay(dateStr: string): boolean {
  return isWeekend(dateStr) || isHoliday(dateStr);
}

// ─── Slot types ───────────────────────────────────────────────────────────────
export interface CourtSlot {
  time: string;     // "HH:MM" bắt đầu
  end: string;      // "HH:MM" kết thúc
  duration: number; // phút
  isPeak: boolean;
  isMorningPeak: boolean; // cao điểm sáng cuối tuần/lễ
  label: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function addMins(t: string, m: number): string {
  const [h, mm] = t.split(":").map(Number);
  const total = h * 60 + mm + m;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

const ONE_HOUR_SPORTS = ["Bóng đá", "Bóng rổ"];

// ─── Tạo danh sách slots cho 1 sân theo ngày ─────────────────────────────────
export function generateCourtSlots(sportName: string, dateStr: string): CourtSlot[] {
  const isOneHour = ONE_HOUR_SPORTS.includes(sportName);
  const special = isSpecialDay(dateStr); // cuối tuần hoặc lễ → thêm cao điểm sáng
  const slots: CourtSlot[] = [];

  function push(time: string, duration: number, isPeak: boolean, isMorningPeak = false) {
    const end = addMins(time, duration);
    slots.push({ time, end, duration, isPeak, isMorningPeak, label: `${time}–${end}` });
  }

  // 06:00 – 07:00 (luôn bình thường)
  if (isOneHour) {
    push("06:00", 60, false);
  } else {
    push("06:00", 30, false);
    push("06:30", 30, false);
  }

  // 07:00 – 09:00 (cao điểm sáng nếu cuối tuần/lễ, ngược lại bình thường)
  if (special) {
    push("07:00", 120, true, true); // 2h cao điểm sáng
  } else {
    if (isOneHour) {
      push("07:00", 60, false);
      push("08:00", 60, false);
    } else {
      push("07:00", 30, false);
      push("07:30", 30, false);
      push("08:00", 30, false);
      push("08:30", 30, false);
    }
  }

  // 09:00 – 17:00 (luôn bình thường)
  for (let h = 9; h < 17; h++) {
    if (isOneHour) {
      push(`${String(h).padStart(2, "0")}:00`, 60, false);
    } else {
      push(`${String(h).padStart(2, "0")}:00`, 30, false);
      push(`${String(h).padStart(2, "0")}:30`, 30, false);
    }
  }

  // 17:00 – 21:00 (cao điểm chiều — luôn có)
  push("17:00", 120, true);
  push("19:00", 120, true);

  // 21:00 – 22:00 (bình thường)
  if (isOneHour) {
    push("21:00", 60, false);
  } else {
    push("21:00", 30, false);
    push("21:30", 30, false);
  }

  return slots;
}

// ─── Tính giá 1 slot ──────────────────────────────────────────────────────────
export function getSlotPrice(slot: CourtSlot, dateStr: string): number {
  const holiday = isHoliday(dateStr);
  const multiplier = holiday ? 1.15 : 1;

  let base: number;
  if (slot.isPeak) {
    base = 160000; // 2h cao điểm
  } else if (slot.duration === 60) {
    base = 80000;
  } else {
    base = 40000; // 30 phút
  }

  return Math.round(base * multiplier);
}

// ─── Label giá hiển thị ───────────────────────────────────────────────────────
export function getSlotPriceLabel(slot: CourtSlot, dateStr: string): string {
  const price = getSlotPrice(slot, dateStr);
  const holiday = isHoliday(dateStr);
  const suffix = holiday ? "🎌" : "";
  if (slot.isPeak) return `${Math.round(price / 1000)}k/2h${suffix}`;
  if (slot.duration === 60) return `${Math.round(price / 1000)}k/1h${suffix}`;
  return `${Math.round(price / 1000)}k·30p${suffix}`;
}
