"use client";
import React, { useEffect, useState, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import VietnamAddressInput from "@/components/VietnamAddressInput";
import { useTranslations } from "next-intl";

// ─── Types ──────────────────────────────────────────────────────────────────
interface Facility { id: number; name: string; address: string; description: string; isActive: boolean; courtCount: number; staffCount: number; imageUrl?: string | null; defaultQrUrl?: string | null; sports: { id: number; name: string }[] }
interface WageHistoryEntry { id: number; oldRole: string | null; newRole: string | null; oldWageType: string | null; newWageType: string | null; oldWageRate: number | null; newWageRate: number | null; effectiveFrom: string; isApplied: boolean; appliedAt: string | null; changedAt: string }
interface StaffRecord { staffRecordId: number; facilityId: number; facilityName: string; role: string; joinedAt: string; user: { id: number; fullName: string; email: string; phone: string; role: string; isLocked: boolean; wallet: { balance: number; status: string } | null }; wageConfig: { wageType: string; wageRate: number } | null; wageHistory?: WageHistoryEntry[] }
interface AttendanceRecord { id: number; date: string; checkIn: string | null; checkOut: string | null; totalHours: string | null; status: string; isLate: boolean; forgotCheckIn: boolean; forgotCheckOut: boolean; overtimeMinutes: number; shift: { id: number; name: string; startTime: string; endTime: string } | null }
interface AttendanceStaff { userId: number; fullName: string; role: string; wageType: string | null; totalHours: number | null; presentDays: number; lateDays: number; forgotCheckInCount: number; forgotCheckOutCount: number; overtimeTotalMinutes: number; records: AttendanceRecord[] }
interface SalaryStaffRow { userId: number; fullName: string; role: string; wageConfig: { wageType: string; wageRate: number } | null; attendance: { totalHours: number | null; presentDays: number; lateDays: number; forgotCheckOutCount: number; overtimeHours: number }; salaryRecord: { id: number; baseSalary: number; bonus: number; overtimeHours: number; overtimePay: number; penaltyAmount: number; finalSalary: number; wageRate: number; wageType: string; isPaid: boolean; paidAt: string | null } | null }
interface WageConfig { id: number; staffId: number; wageType: string; wageRate: number; staff: { id: number; fullName: string } }
interface ImportBatch { id: number; date: string; quantity: number; importPrice: number; note: string | null; soldQty: number; revenue: number; cogs: number; profit: number }
interface LastImport { date: string; quantity: number; importPrice: number; note: string | null }
interface Service { id: number; name: string; type: string; price: string; importPrice: string; stockQuantity: number; monthlyThreshold: number; isActive: boolean; imageUrl?: string | null; soldThisMonth?: number; totalSold?: number; importBatches?: ImportBatch[]; lastImport?: LastImport | null; totalRevenue?: number; totalCogs?: number; totalProfit?: number }
interface Invoice { id: number; createdAt: string; subTotal: string; discountAmount: string; finalTotal: string; paymentMethod: string; invoiceStatus: string; bookingStatus: string; staffName: string; customerName: string; courtName: string; facilityName: string; items: { name: string; quantity: number; price: string }[] }
interface PricingRule { id?: number; startTime: string; endTime: string; pricePerHour: number; dayType: "WEEKDAY" | "WEEKEND" | "HOLIDAY"; isPeak: boolean; priority: number }
interface OwnerVoucher { id: number; code: string; name: string | null; discountType: "PERCENT" | "FIXED_AMOUNT"; discountValue: string; minOrderValue: string; maxDiscount: string | null; startDate: string; endDate: string; usageLimit: number; usedCount: number; isActive: boolean; requiredMembershipTier: string | null; facility: { id: number; name: string } | null }
interface WorkShift { id: number; name: string; shiftDate: string; startTime: string; endTime: string; maxStaff: number; status: string; note: string | null; registrations: { id: number; staffId: number; status: string; staff: { id: number; fullName: string; phone: string } }[] }
interface CourtLock { id: number; reason: string; note: string | null; startDate: string; endDate: string; isActive: boolean; locker: { fullName: string } }
interface StaffReport { id: number; type: string; title: string; description: string; status: string; createdAt: string; staff: { fullName: string } }

const TAB_IDS = [
  { id: "overview",   labelKey: "tabOverview"   },
  { id: "facilities", labelKey: "tabFacilities" },
  { id: "vouchers",   labelKey: "tabVouchers"   },
  { id: "staff",      labelKey: "tabStaff"      },
  { id: "shifts",     labelKey: "tabShifts"     },
  { id: "attendance", labelKey: "tabAttendance" },
  { id: "salary",     labelKey: "tabSalary"     },
  { id: "invoices",   labelKey: "tabInvoices"   },
  { id: "wallet",     labelKey: "tabWallet"     },
  { id: "services",   labelKey: "tabServices"   },
  { id: "revenue",    labelKey: "tabRevenue"    },
];

const CARD = "border border-gray-300 rounded-2xl p-5 mb-4";
const BG   = { background: "#E0EEE0" };
const INPUT = "w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:border-emerald-400";
const BTN_G = "bg-emerald-500 hover:bg-emerald-400 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors";
const BTN_R = "bg-red-500 hover:bg-red-400 text-white px-3 py-1.5 rounded-lg text-xs transition-colors";
const BTN_W = "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 px-4 py-2 rounded-xl text-sm transition-colors";

// ─── Overview helpers ────────────────────────────────────────────────────────
function toQ(arr: { actual?: number; plan?: number; count?: number; label: string }[]) {
  const sum = (s: number, f: "actual" | "plan" | "count") =>
    arr.slice(s, s + 3).reduce((acc, x) => acc + ((x as any)[f] || 0), 0);
  return (["Q1","Q2","Q3","Q4"] as const).map((label, i) => ({
    label, actual: sum(i * 3, "actual"), plan: sum(i * 3, "plan"), count: sum(i * 3, "count"),
  }));
}
function growthRates(arr: { count: number }[], forYear?: number) {
  const now = new Date();
  return arr.map((m, i) => {
    // Các tháng tương lai trong năm hiện tại/tương lai chưa có dữ liệu → hiển thị 0%
    if (forYear !== undefined && (forYear > now.getFullYear() || (forYear === now.getFullYear() && i >= now.getMonth()))) return 0;
    if (i === 0) return 0;
    if (arr[i - 1].count === 0) return 0;
    return +((m.count - arr[i - 1].count) / arr[i - 1].count * 100).toFixed(1);
  });
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`px-2 py-0.5 text-xs rounded font-medium transition-colors whitespace-nowrap ${active ? "bg-emerald-500 text-white" : "bg-white border border-gray-300 text-gray-600 hover:bg-gray-50"}`}>
      {children}
    </button>
  );
}
function PillGroup({ value, onChange, opts }: { value: string; onChange: (v: string) => void; opts: { v: string; label: string }[] }) {
  return (
    <div className="flex gap-1 flex-wrap">
      {opts.map(o => <Pill key={o.v} active={value === o.v} onClick={() => onChange(o.v)}>{o.label}</Pill>)}
    </div>
  );
}

// ─── Overview Tab ────────────────────────────────────────────────────────────
function OverviewTab() {
  const t = useTranslations("owner");
  const yearNow  = new Date().getFullYear();
  const monthNow = new Date().getMonth() + 1;

  const [stats,      setStats]      = useState<any>(null);
  const [loading,    setLoading]    = useState(true);
  const [year,       setYear]       = useState(yearNow);
  const [month,      setMonth]      = useState(monthNow);
  const [chartReady, setChartReady] = useState(false);

  // Trạng thái bộ lọc riêng cho từng biểu đồ
  const [revMode, setRevMode] = useState<"monthly"|"quarterly">("monthly");
  const [revCmp,  setRevCmp]  = useState<"curr"|"prev"|"both">("both");
  const [bkMode,  setBkMode]  = useState<"monthly"|"quarterly">("monthly");
  const [bkCmp,   setBkCmp]   = useState<"curr"|"prev"|"both">("both");
  const [custCmp, setCustCmp] = useState<"curr"|"prev"|"both">("both");

  const revRef     = useRef<HTMLCanvasElement>(null);
  const bkRef      = useRef<HTMLCanvasElement>(null);
  const custRef    = useRef<HTMLCanvasElement>(null);
  const growthRef  = useRef<HTMLCanvasElement>(null);
  const facRef     = useRef<HTMLCanvasElement>(null);
  const profitRef  = useRef<HTMLCanvasElement>(null);
  const revInst    = useRef<any>(null);
  const bkInst     = useRef<any>(null);
  const custInst   = useRef<any>(null);
  const growthInst = useRef<any>(null);
  const facInst    = useRef<any>(null);
  const profitInst = useRef<any>(null);

  // Tải Chart.js từ CDN một lần duy nhất
  useEffect(() => {
    if ((window as any).Chart) { setChartReady(true); return; }
    const existing = document.getElementById("_cjs_cdn");
    if (existing) { existing.addEventListener("load", () => setChartReady(true)); return; }
    const s = document.createElement("script");
    s.id = "_cjs_cdn";
    s.src = "https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js";
    s.onload = () => setChartReady(true);
    document.head.appendChild(s);
  }, []);

  // Lấy dữ liệu thống kê
  useEffect(() => {
    setLoading(true);
    fetch(`/api/owner/stats?year=${year}&month=${month}`)
      .then(r => r.json())
      .then(d => { setStats(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [year, month]);

  // ── Revenue chart ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!chartReady || !stats || !revRef.current) return;
    revInst.current?.destroy();
    const C  = (window as any).Chart;
    const f  = (n: number) => +(n / 1e6).toFixed(1);
    const curr = revMode === "quarterly" ? toQ(stats.revenueByMonth)         : stats.revenueByMonth;
    const prev = revMode === "quarterly" ? toQ(stats.prevYearRevenueByMonth) : stats.prevYearRevenueByMonth;
    const datasets: any[] = [];
    if (revCmp !== "prev") {
      datasets.push({ label: `Thực tế ${year}`,   data: curr.map((m: any) => f(m.actual)), backgroundColor: "#009999", borderRadius: 4 });
      datasets.push({ label: `Kế hoạch ${year}`,  data: curr.map((m: any) => f(m.plan)),   backgroundColor: "#FFCC66", borderRadius: 4 });
    }
    if (revCmp !== "curr") {
      datasets.push({ label: `Thực tế ${year - 1}`, data: prev.map((m: any) => f(m.actual)), backgroundColor: "#33CC66", borderRadius: 4 });
    }
    revInst.current = new C(revRef.current, {
      type: "bar",
      data: { labels: curr.map((m: any) => m.label), datasets },
      options: { responsive: true, maintainAspectRatio: true,
        plugins: { legend: { position: "top", labels: { font: { size: 11 } } }, tooltip: { callbacks: { label: (ctx: any) => `${ctx.dataset.label}: ${ctx.raw}M ` } } },
        scales: { y: { beginAtZero: true, title: { display: true, text: "Triệu đồng" }, ticks: { font: { size: 10 } } }, x: { ticks: { font: { size: 10 } } } } },
    });
    return () => { revInst.current?.destroy(); revInst.current = null; };
  }, [chartReady, stats, revMode, revCmp]);

  // ── Booking trend chart ──────────────────────────────────────────────────
  useEffect(() => {
    if (!chartReady || !stats || !bkRef.current) return;
    bkInst.current?.destroy();
    const C   = (window as any).Chart;
    const curr = bkMode === "quarterly" ? toQ(stats.bookingsByMonth)         : stats.bookingsByMonth;
    const prev = bkMode === "quarterly" ? toQ(stats.prevYearBookingsByMonth) : stats.prevYearBookingsByMonth;
    const datasets: any[] = [];
    if (bkCmp !== "prev")
      datasets.push({ label: `Đặt sân ${year}`, data: curr.map((m: any) => m.count),
        borderColor: "#3b82f6", backgroundColor: "rgba(59,130,246,0.1)", fill: true, tension: 0.4,
        pointRadius: 2, pointBorderWidth: 2,
        pointBackgroundColor: "#ffffff", pointBorderColor: "#3b82f6",
        pointHoverRadius: 7, pointHoverBackgroundColor: "#3b82f6", pointHoverBorderColor: "#fff" });
    if (bkCmp !== "curr")
      datasets.push({ label: `Đặt sân ${year - 1}`, data: prev.map((m: any) => m.count),
        borderColor: "#f97316", backgroundColor: "rgba(249,115,22,0.08)", fill: true, tension: 0.4,
        pointRadius: 2, pointBorderWidth: 2,
        pointBackgroundColor: "#ffffff", pointBorderColor: "#f97316",
        pointHoverRadius: 7, pointHoverBackgroundColor: "#f97316", pointHoverBorderColor: "#fff" });
    bkInst.current = new C(bkRef.current, {
      type: "line",
      data: { labels: curr.map((m: any) => m.label), datasets },
      options: { responsive: true, maintainAspectRatio: true,
        plugins: { legend: { position: "top", labels: { font: { size: 11 } } } },
        scales: { y: { beginAtZero: true, ticks: { font: { size: 10 } } }, x: { ticks: { font: { size: 10 } } } } },
    });
    return () => { bkInst.current?.destroy(); bkInst.current = null; };
  }, [chartReady, stats, bkMode, bkCmp]);

  // ── Customer count bar chart ─────────────────────────────────────────────
  useEffect(() => {
    if (!chartReady || !stats || !custRef.current) return;
    custInst.current?.destroy();
    const C    = (window as any).Chart;
    const curr = stats.customersByMonth;
    const prev = stats.prevYearCustomersByMonth;
    const datasets: any[] = [];
    if (custCmp !== "prev")
      datasets.push({ label: `KH ${year}`,     data: curr.map((m: any) => m.count),
        backgroundColor: "rgba(99,179,237,0.8)", borderColor: "#3b82f6", borderWidth: 1, borderRadius: 3 });
    if (custCmp !== "curr")
      datasets.push({ label: `KH ${year - 1}`, data: prev.map((m: any) => m.count),
        backgroundColor: "rgba(251,146,60,0.7)", borderColor: "#f97316", borderWidth: 1, borderRadius: 3 });
    custInst.current = new C(custRef.current, {
      type: "bar",
      data: { labels: curr.map((m: any) => m.label), datasets },
      options: { responsive: true, maintainAspectRatio: true,
        plugins: { legend: { position: "top", labels: { font: { size: 11 } } } },
        scales: {
          y: { beginAtZero: true, title: { display: true, text: "Khách" }, ticks: { font: { size: 10 } } },
          x: { ticks: { font: { size: 10 } } },
        } },
    });
    return () => { custInst.current?.destroy(); custInst.current = null; };
  }, [chartReady, stats, custCmp]);

  // ── Customer growth rate line chart ──────────────────────────────────────
  useEffect(() => {
    if (!chartReady || !stats || !growthRef.current) return;
    growthInst.current?.destroy();
    const C    = (window as any).Chart;
    const curr = stats.customersByMonth;
    const prev = stats.prevYearCustomersByMonth;
    const datasets: any[] = [];
    if (custCmp !== "prev")
      datasets.push({ label: `Tăng trưởng ${year} %`, data: growthRates(curr, year),
        borderColor: "#3b82f6", backgroundColor: "rgba(59,130,246,0.08)", fill: true, tension: 0.4,
        pointRadius: 2.5, pointBorderWidth: 2,
        pointBackgroundColor: "#ffffff", pointBorderColor: "#3b82f6",
        pointHoverRadius: 7, pointHoverBackgroundColor: "#3b82f6", pointHoverBorderColor: "#fff" });
    if (custCmp !== "curr")
      datasets.push({ label: `Tăng trưởng ${year - 1} %`, data: growthRates(prev),
        borderColor: "#f97316", backgroundColor: "rgba(249,115,22,0.06)", fill: true, tension: 0.4,
        pointRadius: 2.5, pointBorderWidth: 2,
        pointBackgroundColor: "#ffffff", pointBorderColor: "#f97316",
        pointHoverRadius: 7, pointHoverBackgroundColor: "#f97316", pointHoverBorderColor: "#fff" });
    growthInst.current = new C(growthRef.current, {
      type: "line",
      data: { labels: curr.map((m: any) => m.label), datasets },
      options: { responsive: true, maintainAspectRatio: true,
        plugins: { legend: { position: "top", labels: { font: { size: 11 } } } },
        scales: {
          y: { title: { display: true, text: "%" }, ticks: { font: { size: 10 }, callback: (v: any) => v + "%" } },
          x: { ticks: { font: { size: 10 } } },
        } },
    });
    return () => { growthInst.current?.destroy(); growthInst.current = null; };
  }, [chartReady, stats, custCmp]);

  // ── Profit chart ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!chartReady || !stats || !profitRef.current || !stats.profitByMonth) return;
    profitInst.current?.destroy();
    const C = (window as any).Chart;
    const f = (n: number) => +(n / 1e6).toFixed(1);
    const data = stats.profitByMonth;
    profitInst.current = new C(profitRef.current, {
      type: "bar",
      data: {
        labels: data.map((m: any) => m.label),
        datasets: [
          { label: "Doanh thu", data: data.map((m: any) => f(m.revenue)), backgroundColor: "rgba(16,185,129,0.7)", borderRadius: 4 },
          { label: "Chi phí", data: data.map((m: any) => f((m.salary || 0) + (m.cogs || 0))), backgroundColor: "rgba(239,68,68,0.7)", borderRadius: 4 },
          {
            label: "Lợi nhuận",
            data: data.map((m: any) => f(m.profit)),
            type: "line" as any,
            borderColor: "#3b82f6", backgroundColor: "rgba(59,130,246,0.1)",
            fill: false, tension: 0.4, pointRadius: 3, pointBorderWidth: 2,
            pointBackgroundColor: "#fff", pointBorderColor: "#3b82f6",
            yAxisID: "y",
          },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: true,
        plugins: {
          legend: { position: "top", labels: { font: { size: 11 } } },
          tooltip: { callbacks: { label: (ctx: any) => `${ctx.dataset.label}: ${ctx.raw}M đ` } },
        },
        scales: {
          y: { beginAtZero: true, title: { display: true, text: "Triệu đồng" }, ticks: { font: { size: 10 } } },
          x: { ticks: { font: { size: 10 } } },
        },
      },
    });
    return () => { profitInst.current?.destroy(); profitInst.current = null; };
  }, [chartReady, stats]);

  // ── Facility ranking chart ───────────────────────────────────────────────
  useEffect(() => {
    if (!chartReady || !stats || !facRef.current || !stats.revenueByFacility?.length) return;
    facInst.current?.destroy();
    const C = (window as any).Chart;
    facInst.current = new C(facRef.current, {
      type: "bar",
      data: {
        labels:   stats.revenueByFacility.map((f: any) => f.name.length > 18 ? f.name.slice(0, 17) + "…" : f.name),
        datasets: [{ label: "Doanh thu (triệu đồng)", data: stats.revenueByFacility.map((f: any) => +(f.total / 1e6).toFixed(1)), backgroundColor: ["#10b981","#3b82f6","#f97316","#a855f7","#ec4899","#14b8a6","#f59e0b","#06b6d4"], borderRadius: 4 }],
      },
      options: { indexAxis: "y", responsive: true, maintainAspectRatio: true,
        plugins: { legend: { display: false } },
        scales: { x: { beginAtZero: true, ticks: { font: { size: 10 } } }, y: { ticks: { font: { size: 10 } } } } },
    });
    return () => { facInst.current?.destroy(); facInst.current = null; };
  }, [chartReady, stats]);

  if (loading) return <div className="text-gray-400 text-sm py-10 text-center">{t("loading")}</div>;
  if (!stats)  return <div className="text-gray-400 text-sm py-10 text-center">Không có dữ liệu</div>;

  const fmtM    = (n: number) => n >= 1e6 ? (n / 1e6).toFixed(1) + "M" : n.toLocaleString("vi-VN");
  const fmtFull = (n: number) => n.toLocaleString("vi-VN") + "đ";
  const badgeCls = (v: number) => v >= 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600";
  const sign    = (v: number) => v >= 0 ? "+" : "";

  const gp         = Math.min(stats.planPercent, 100);
  const gaugeRad   = (gp / 100) * Math.PI;
  const needleX    = +(100 + 62 * Math.cos(Math.PI - gaugeRad)).toFixed(2);
  const needleY    = +(100 - 62 * Math.sin(Math.PI - gaugeRad)).toFixed(2);
  const gaugeColor = gp >= 80 ? "#3b82f6" : gp >= 50 ? "#06b6d4" : "#8b5cf6";

  const MONTH_NAMES = ["Tháng 1","Tháng 2","Tháng 3","Tháng 4","Tháng 5","Tháng 6","Tháng 7","Tháng 8","Tháng 9","Tháng 10","Tháng 11","Tháng 12"];
  const BAR_COLORS  = ["bg-emerald-500","bg-blue-500","bg-orange-500","bg-purple-500","bg-yellow-500","bg-teal-500","bg-pink-500","bg-indigo-500","bg-red-500","bg-cyan-500"];
  const VIEW_OPTS   = [{ v: "monthly",   label: "Tháng" }, { v: "quarterly", label: "Quý"   }];
  const CMP_OPTS    = [{ v: "both", label: "So sánh" }, { v: "curr", label: `${year}` }, { v: "prev", label: `${year - 1}` }];

  return (
    <div className="flex gap-4">
      <div className="flex-1 min-w-0 space-y-4">

        {/* KPI cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Doanh thu tháng", value: fmtM(stats.currentRevenue), change: stats.revenueChange,  title: fmtFull(stats.currentRevenue), color: "text-emerald-600" },
            { label: "Lượt đặt sân",    value: stats.currentBookings,       change: stats.bookingsChange, title: "",                            color: "text-blue-600"    },
            { label: "Khách hàng",      value: stats.currentCustomers,      change: stats.customersChange,title: "",                            color: "text-purple-600"  },
            { label: "Dịch vụ đã bán",  value: stats.currentItemsSold,      change: stats.itemsChange,    title: "",                            color: "text-orange-600"  },
          ].map(s => (
            <div key={s.label} className={`${CARD} !mb-0`} style={BG}>
              <div className="flex items-start justify-between mb-2">
                <div className={`text-xl font-bold ${s.color}`} title={s.title}>{s.value}</div>
                <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${badgeCls(s.change)}`}>
                  {sign(s.change)}{s.change.toFixed(2)}%
                </span>
              </div>
              <div className="text-xs text-gray-600">{s.label}</div>
              <div className="text-xs text-gray-400">So tháng trước</div>
            </div>
          ))}
        </div>

        {/* Gauge + Revenue chart */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className={`${CARD} !mb-0 md:col-span-2 flex flex-col items-center justify-center`} style={BG}>
            <div className="text-sm font-semibold text-gray-700 mb-2">Hoàn thành kế hoạch tháng</div>
            <svg viewBox="0 0 200 118" className="w-44">
              {/* Background arc */}
              <path d="M 20 100 A 80 80 0 0 1 180 100" stroke="#e5e7eb" fill="none" strokeWidth="16" strokeLinecap="round"/>
              {/* Filled arc — dùng strokeDasharray để luôn đúng ở mọi % */}
              {gp > 0 && (
                <path d="M 20 100 A 80 80 0 0 1 180 100" stroke={gaugeColor} fill="none" strokeWidth="16" strokeLinecap="round"
                  strokeDasharray={`${gp} 100`} pathLength="100" />
              )}
              <line x1="100" y1="100" x2={needleX} y2={needleY} stroke="#374151" strokeWidth="2.5" strokeLinecap="round"/>
              <circle cx="100" cy="100" r="4.5" fill="#374151"/>
              <text x="100" y="82" textAnchor="middle" fontSize="17" fontWeight="bold" fill="#374151">{stats.planPercent}%</text>
              <text x="22"  y="114" fontSize="8.5" fill="#9ca3af">0%</text>
              <text x="167" y="114" fontSize="8.5" fill="#9ca3af">100%</text>
            </svg>
            <div className="text-xs text-gray-500 text-center mt-1">
              Kế hoạch: <span className="font-semibold text-gray-700">{fmtM(stats.planRevenue)}</span>
            </div>
            <div className="text-xs text-gray-400 mt-0.5 text-center">{stats.planNote || "(Cùng kỳ năm trước)"}</div>
          </div>

          <div className={`${CARD} !mb-0 md:col-span-3`} style={BG}>
            <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
              <span className="text-sm font-semibold text-gray-700">Doanh thu theo tháng / quý</span>
              <div className="flex gap-2 flex-wrap">
                <PillGroup value={revMode} onChange={v => setRevMode(v as any)} opts={VIEW_OPTS} />
                <PillGroup value={revCmp}  onChange={v => setRevCmp(v as any)}  opts={CMP_OPTS}  />
              </div>
            </div>
            <canvas ref={revRef}></canvas>
          </div>
        </div>

        {/* Booking trend + Facility ranking */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className={`${CARD} !mb-0`} style={BG}>
            <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
              <span className="text-sm font-semibold text-gray-700">Xu hướng đặt sân</span>
              <div className="flex gap-2 flex-wrap">
                <PillGroup value={bkMode} onChange={v => setBkMode(v as any)} opts={VIEW_OPTS} />
                <PillGroup value={bkCmp}  onChange={v => setBkCmp(v as any)}  opts={CMP_OPTS}  />
              </div>
            </div>
            <canvas ref={bkRef}></canvas>
          </div>

          <div className={`${CARD} !mb-0`} style={BG}>
            <div className="text-sm font-semibold text-gray-700 mb-2">Xếp hạng cơ sở theo doanh thu năm</div>
            {stats.revenueByFacility?.length > 0
              ? <canvas ref={facRef}></canvas>
              : <div className="text-gray-400 text-sm text-center py-10">Chưa có dữ liệu cơ sở</div>}
          </div>
        </div>

        {/* Customer charts — 2 biểu đồ riêng */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className={`${CARD} !mb-0`} style={BG}>
            <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
              <span className="text-sm font-semibold text-gray-700">Số lượng khách hàng</span>
              <PillGroup value={custCmp} onChange={v => setCustCmp(v as any)} opts={CMP_OPTS} />
            </div>
            <canvas ref={custRef}></canvas>
          </div>
          <div className={`${CARD} !mb-0`} style={BG}>
            <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
              <span className="text-sm font-semibold text-gray-700">Tỷ lệ tăng trưởng khách hàng</span>
              <PillGroup value={custCmp} onChange={v => setCustCmp(v as any)} opts={CMP_OPTS} />
            </div>
            <canvas ref={growthRef}></canvas>
          </div>
        </div>

        {/* Profit chart */}
        <div className={`${CARD} !mb-0`} style={BG}>
          <div className="text-sm font-semibold text-gray-700 mb-2">
            Biểu đồ lợi nhuận — {year}
            <span className="text-xs font-normal text-gray-400 ml-2">(Doanh thu − Chi phí [Lương + Giá vốn])</span>
          </div>
          <canvas ref={profitRef}></canvas>
        </div>

        {/* Top 10 courts */}
        {stats.topCourts?.length > 0 && (
          <div className={`${CARD} !mb-0`} style={BG}>
            <div className="text-sm font-semibold text-gray-700 mb-3">
              Top sân doanh thu cao nhất — {MONTH_NAMES[month - 1]} {year}
            </div>
            <div className="space-y-2.5">
              {stats.topCourts.map((ct: any, i: number) => {
                const maxVal = stats.topCourts[0]?.total || 1;
                const pct    = Math.max(Math.round((ct.total / maxVal) * 100), 2);
                return (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="w-4 shrink-0 text-gray-400 font-medium text-right">{i + 1}</span>
                    <div className="w-32 shrink-0">
                      <div className="font-medium text-gray-700 truncate">{ct.name}</div>
                      <div className="text-gray-400 truncate">{ct.facilityName}</div>
                    </div>
                    <div className="flex-1 bg-gray-200 rounded-full h-3 overflow-hidden">
                      <div className={`${BAR_COLORS[i % BAR_COLORS.length]} h-3 rounded-full transition-all`} style={{ width: `${pct}%` }}></div>
                    </div>
                    <span className="w-16 shrink-0 text-right font-semibold text-gray-700">{fmtM(ct.total)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Right filter panel */}
      <div className="w-52 shrink-0 hidden md:block">
        <div className={`${CARD} sticky top-4 !mb-0`} style={BG}>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Năm hiển thị</label>
              <select value={year} onChange={e => setYear(Number(e.target.value))} className={INPUT + " text-xs"}>
                {[yearNow, yearNow - 1, yearNow - 2, yearNow - 3].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Tháng (KPI cards)</label>
              <select value={month} onChange={e => setMonth(Number(e.target.value))} className={INPUT + " text-xs"}>
                {MONTH_NAMES.map((name, i) => (
                  <option key={i + 1} value={i + 1}>{name}</option>
                ))}
              </select>
            </div>
            <div className="border-t border-gray-200 pt-3">
              <div className="text-xs text-gray-500 font-medium mb-2">Thống kê nhanh</div>
              <div className="space-y-2 text-xs">
                {[
                  { label: "Cơ sở",     value: stats.facilityCount,        color: "text-emerald-600" },
                  { label: "Nhân viên",  value: stats.staffCount,           color: "text-blue-600"    },
                  { label: "Doanh thu",  value: fmtM(stats.currentRevenue), color: "text-orange-600"  },
                  { label: "Lượt đặt",   value: stats.currentBookings,      color: "text-purple-600"  },
                  { label: "Khách hàng", value: stats.currentCustomers,     color: "text-pink-600"    },
                ].map(item => (
                  <div key={item.label} className="flex justify-between items-center">
                    <span className="text-gray-500">{item.label}</span>
                    <span className={`font-semibold ${item.color}`}>{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="border-t border-gray-200 pt-3">
              <div className="text-xs text-gray-400 leading-relaxed">
                Mẹo: Bấm <strong>So sánh</strong> trên biểu đồ để đối chiếu {year} vs {year - 1}. Chọn <strong>Quý</strong> để gom theo quý.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Facilities Tab ──────────────────────────────────────────────────────────
function FacilitiesTab() {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [sports, setSports] = useState<{ id: number; name: string }[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: "", address: "", description: "", sportIds: [] as number[], latitude: "", longitude: "", imageUrl: "" });
  const [facilityImgUploading, setFacilityImgUploading] = useState(false);
  const [courtForm, setCourtForm] = useState({ name: "", categoryId: "", weekdayPrice: "", weekendPrice: "", peakPrice: "" });
  const [facilityId, setFacilityId] = useState<number | null>(null);
  const [courts, setCourts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  // Quản lý chi tiết sân (giá, lịch, khoá)
  const [managingCourtId, setManagingCourtId] = useState<number | null>(null);
  const [managingTab, setManagingTab] = useState<"pricing" | "schedule" | "lock">("pricing");
  const [pricingRules, setPricingRules] = useState<PricingRule[]>([]);
  const [courtOpenTime, setCourtOpenTime] = useState("06:00");
  const [courtCloseTime, setCourtCloseTime] = useState("22:00");
  const [courtMinRental, setCourtMinRental] = useState<number>(60);
  const [courtMinRentalCustom, setCourtMinRentalCustom] = useState(false);
  const [savingPricing, setSavingPricing] = useState(false);
  const [scheduleData, setScheduleData] = useState<any>(null);
  const [scheduleDate, setScheduleDate] = useState(() => { const d = new Date(); return d.toISOString().substring(0,10); });
  const [courtLocks, setCourtLocks] = useState<CourtLock[]>([]);
  const [lockForm, setLockForm] = useState({ reason: "INCIDENT", note: "", startDate: "", endDate: "", notifyCustomers: true });
  const [regeocoding, setRegeocoding] = useState(false);
  const [regeocodeResult, setRegeocodeResult] = useState<{ ok: number; failed: number; total: number } | null>(null);
  const [qrUploading, setQrUploading] = useState(false);
  const [qrSaving, setQrSaving] = useState<number | null>(null);
  const [facilityReports, setFacilityReports] = useState<StaffReport[]>([]);
  const [showResolvedReports, setShowResolvedReports] = useState(false);

  useEffect(() => {
    fetch("/api/owner/facilities").then(r => r.json()).then(setFacilities);
    fetch("/api/sports").then(r => r.json()).then(setSports);
  }, []);

  async function regeocodeAll() {
    if (!confirm("Hệ thống sẽ tự động cập nhật tọa độ chính xác cho TẤT CẢ cơ sở (~1 giây/sân). Tiếp tục?")) return;
    setRegeocoding(true);
    setRegeocodeResult(null);
    try {
      const res = await fetch("/api/admin/re-geocode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ onlyMissing: false }),
      });
      const data = await res.json();
      setRegeocodeResult({ ok: data.ok, failed: data.failed, total: data.total });
    } catch {
      alert("Lỗi khi re-geocode. Vui lòng thử lại.");
    }
    setRegeocoding(false);
  }

  const loadCourts = useCallback(async (fid: number) => {
    const [data, reports] = await Promise.all([
      fetch(`/api/facilities/${fid}`).then(r => r.json()),
      fetch(`/api/owner/facilities/${fid}/reports`).then(r => r.json()),
    ]);
    setCourts(data.courts || []);
    setFacilityReports(Array.isArray(reports) ? reports : []);
    setFacilityId(fid);
    setExpandedId(fid);
    setShowResolvedReports(false);
  }, []);

  async function openCourtManage(courtId: number, tab: "pricing" | "schedule" | "lock") {
    setManagingCourtId(courtId);
    setManagingTab(tab);
    if (tab === "pricing") {
      const court = courts.find((c: any) => c.id === courtId);
      if (court?.pricingRules) {
        setPricingRules(court.pricingRules.map((r: any) => ({
          id: r.id,
          startTime: new Date(r.startTime).toISOString().substring(11,16),
          endTime: new Date(r.endTime).toISOString().substring(11,16),
          pricePerHour: Number(r.pricePerHour),
          dayType: r.dayType,
          isPeak: r.isPeak || false,
          priority: r.priority || 0,
        })));
      } else {
        setPricingRules([]);
      }
      // Tải giờ mở/đóng sân và thời gian thuê tối thiểu
      setCourtOpenTime(court?.openTime ? new Date(court.openTime).toISOString().substring(11,16) : "06:00");
      setCourtCloseTime(court?.closeTime ? new Date(court.closeTime).toISOString().substring(11,16) : "22:00");
      const min = court?.minRentalMinutes ?? 60;
      const presets = [30, 60, 90, 120, 150];
      setCourtMinRentalCustom(!presets.includes(min));
      setCourtMinRental(min);
    } else if (tab === "schedule") {
      await loadSchedule(courtId);
    } else if (tab === "lock") {
      await loadLocks(courtId);
    }
  }

  async function loadSchedule(courtId: number) {
    const endDate = new Date(); endDate.setDate(endDate.getDate() + 30);
    const res = await fetch(`/api/owner/courts/${courtId}/schedule?startDate=${scheduleDate}&endDate=${endDate.toISOString().substring(0,10)}`);
    const data = await res.json();
    setScheduleData(data);
  }

  async function loadLocks(courtId: number) {
    const res = await fetch(`/api/owner/courts/${courtId}/lock`);
    const data = await res.json();
    setCourtLocks(Array.isArray(data) ? data : []);
  }

  async function savePricingRules() {
    if (!managingCourtId) return;
    setSavingPricing(true);
    await fetch(`/api/owner/courts/${managingCourtId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pricingRules, openTime: courtOpenTime, closeTime: courtCloseTime, minRentalMinutes: courtMinRental }),
    });
    setSavingPricing(false);
    alert("Đã lưu khung giờ & giá!");
    if (facilityId) loadCourts(facilityId);
  }

  async function applyPricingToSameSport() {
    if (!managingCourtId || !facilityId) return;
    const managingCourt = courts.find((c: any) => c.id === managingCourtId);
    if (!managingCourt) return;
    const sameSportCourts = courts.filter((c: any) => c.categoryId === managingCourt.categoryId && c.id !== managingCourtId);
    if (sameSportCourts.length === 0) { alert("Không có sân cùng môn thể thao nào khác."); return; }
    if (!confirm(`Áp dụng khung giờ & giá cho ${sameSportCourts.length} sân ${managingCourt.category?.name} còn lại?`)) return;
    setSavingPricing(true);
    await Promise.all(sameSportCourts.map((c: any) =>
      fetch(`/api/owner/courts/${c.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pricingRules, openTime: courtOpenTime, closeTime: courtCloseTime, minRentalMinutes: courtMinRental }),
      })
    ));
    setSavingPricing(false);
    alert(`Đã áp dụng cho ${sameSportCourts.length} sân cùng môn!`);
    loadCourts(facilityId);
  }

  function addPricingRule() {
    setPricingRules(prev => [...prev, { startTime: "06:00", endTime: "17:00", pricePerHour: 0, dayType: "WEEKDAY", isPeak: false, priority: 0 }]);
  }

  function removePricingRule(idx: number) {
    setPricingRules(prev => prev.filter((_, i) => i !== idx));
  }

  async function addLock() {
    if (!managingCourtId || !lockForm.startDate || !lockForm.endDate) { alert("Vui lòng điền đầy đủ thông tin"); return; }
    const res = await fetch(`/api/owner/courts/${managingCourtId}/lock`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(lockForm),
    });
    if (res.ok) {
      setLockForm({ reason: "INCIDENT", note: "", startDate: "", endDate: "", notifyCustomers: true });
      await loadLocks(managingCourtId);
    } else { const d = await res.json(); alert(d.error); }
  }

  async function resolveReport(reportId: number) {
    if (!facilityId) return;
    await fetch(`/api/owner/facilities/${facilityId}/reports`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reportId }),
    });
    const reports = await fetch(`/api/owner/facilities/${facilityId}/reports`).then(r => r.json());
    setFacilityReports(Array.isArray(reports) ? reports : []);
  }

  async function removeLock(lockId: number) {
    if (!managingCourtId) return;
    if (!confirm("Mở khóa sân này?")) return;
    await fetch(`/api/owner/courts/${managingCourtId}/lock?lockId=${lockId}`, { method: "DELETE" });
    await loadLocks(managingCourtId);
  }

  async function saveQrCode(facilityId: number, qrUrl: string) {
    setQrSaving(facilityId);
    await fetch(`/api/owner/facilities/${facilityId}/qr`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ defaultQrUrl: qrUrl }),
    });
    setQrSaving(null);
    fetch("/api/owner/facilities").then(r => r.json()).then(d => setFacilities(Array.isArray(d) ? d : []));
  }

  async function uploadQrFile(facilityId: number, file: File) {
    setQrUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload/qr", { method: "POST", body: fd });
      if (res.ok) {
        const { url } = await res.json();
        await saveQrCode(facilityId, url);
      } else {
        const d = await res.json();
        alert(d.error || "Upload QR thất bại");
      }
    } finally {
      setQrUploading(false);
    }
  }

  async function createFacility() {
    setLoading(true);
    const res = await fetch("/api/owner/facilities", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    setLoading(false);
    if (res.ok) {
      setShowForm(false);
      setForm({ name: "", address: "", description: "", sportIds: [], latitude: "", longitude: "", imageUrl: "" });
      fetch("/api/owner/facilities").then(r => r.json()).then(setFacilities);
    } else { const d = await res.json(); alert(d.error); }
  }

  async function addCourt() {
    if (!facilityId) return;
    setLoading(true);
    const res = await fetch("/api/owner/courts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      ...courtForm,
      facilityId,
      weekdayPrice: Number(courtForm.weekdayPrice) * 1000,
      weekendPrice: Number(courtForm.weekendPrice) * 1000,
      peakPrice:    Number(courtForm.peakPrice)    * 1000,
    }) });
    setLoading(false);
    if (res.ok) {
      setCourtForm({ name: "", categoryId: "", weekdayPrice: "", weekendPrice: "", peakPrice: "" });
      loadCourts(facilityId);
    } else { const d = await res.json(); alert(d.error); }
  }

  async function deleteCourt(courtId: number) {
    if (!confirm("Xóa sân này?")) return;
    await fetch(`/api/owner/courts/${courtId}`, { method: "DELETE" });
    if (facilityId) loadCourts(facilityId);
  }

  const toggleSport = (id: number) => setForm(f => ({
    ...f, sportIds: f.sportIds.includes(id) ? f.sportIds.filter(x => x !== id) : [...f.sportIds, id]
  }));


  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="font-semibold text-black">Danh sách cơ sở ({facilities.length})</h2>
        <div className="flex gap-2">
          <button
            onClick={regeocodeAll}
            disabled={regeocoding}
            title="Cập nhật tọa độ GPS chính xác cho tất cả sân"
            className="bg-blue-500 hover:bg-blue-400 disabled:opacity-40 text-white px-3 py-2 rounded-xl text-xs font-medium transition-colors"
          >
            {regeocoding ? "⏳ Đang cập nhật tọa độ..." : "📍 Cập nhật tọa độ tất cả sân"}
          </button>
          <button onClick={() => setShowForm(!showForm)} className={BTN_G}>+ Thêm cơ sở</button>
        </div>
      </div>
      {regeocodeResult && (
        <div className={`mb-3 px-4 py-2.5 rounded-xl text-xs border ${regeocodeResult.failed === 0 ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-amber-50 border-amber-200 text-amber-700"}`}>
          Cập nhật tọa độ: ✓ {regeocodeResult.ok}/{regeocodeResult.total} sân thành công
          {regeocodeResult.failed > 0 && ` · ✗ ${regeocodeResult.failed} sân không tìm thấy (địa chỉ không đủ chi tiết)`}
          <button onClick={() => setRegeocodeResult(null)} className="ml-3 opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      {showForm && (
        <div className={CARD} style={BG}>
          <h3 className="font-semibold text-black mb-3">Đăng ký cơ sở mới</h3>
          <div className="space-y-2.5">
            <input className={INPUT} placeholder="Tên cơ sở *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            <div>
              <p className="text-xs text-gray-500 mb-1.5">Địa chỉ *</p>
              <VietnamAddressInput
                key={showForm ? "open" : "closed"}
                onChange={address => setForm(f => ({ ...f, address }))}
                onGeocoded={(lat, lng) => setForm(f => ({ ...f, latitude: lat, longitude: lng }))}
              />
            </div>
            {/* Hiển thị tọa độ đã lấy tự động */}
            {form.latitude && form.longitude && (
              <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                <p className="text-xs text-emerald-700">
                  Tọa độ: {Number(form.latitude).toFixed(6)}, {Number(form.longitude).toFixed(6)}
                </p>
                <a
                  href={`https://www.openstreetmap.org/?mlat=${form.latitude}&mlon=${form.longitude}&zoom=16`}
                  target="_blank" rel="noopener noreferrer"
                  className="text-xs text-blue-500 hover:underline ml-3 shrink-0"
                >
                  Kiểm tra bản đồ 
                </a>
              </div>
            )}
            <textarea className={INPUT} rows={2} placeholder="Mô tả" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            <div className="border border-gray-200 rounded-xl p-3 bg-white/50">
              <p className="text-xs text-gray-500 font-medium mb-2">Ảnh cơ sở</p>
              <ImageUpload
                value={form.imageUrl}
                onChange={url => setForm(f => ({ ...f, imageUrl: url }))}
                uploading={facilityImgUploading}
                setUploading={setFacilityImgUploading}
              />
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1.5">Môn thể thao:</p>
              <div className="flex flex-wrap gap-2">
                {sports.map(s => (
                  <button key={s.id} onClick={() => toggleSport(s.id)}
                    className={`px-3 py-1 rounded-full text-xs border transition-colors ${form.sportIds.includes(s.id) ? "bg-emerald-500 text-white border-emerald-500" : "bg-white text-gray-600 border-gray-300"}`}>
                    {s.name}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowForm(false)} className={BTN_W}>Hủy</button>
              <button onClick={createFacility} disabled={loading} className={BTN_G}>{loading ? "Đang lưu..." : "Tạo cơ sở"}</button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {facilities.map(f => (
          <div key={f.id} className={CARD} style={BG}>
            <div className="flex justify-between items-start gap-3">
              {f.imageUrl && (
                <div className="w-16 h-16 rounded-xl overflow-hidden border border-gray-200 shrink-0">
                  <img src={f.imageUrl} alt={f.name} className="w-full h-full object-cover" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-black">{f.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">{f.address}</p>
                <div className="flex gap-2 mt-1.5 flex-wrap">
                  <span className="text-xs bg-white border border-gray-200 rounded-full px-2 py-0.5">{f.courtCount} sân</span>
                  <span className="text-xs bg-white border border-gray-200 rounded-full px-2 py-0.5">{f.staffCount} NV</span>
                  {f.sports.map(s => <span key={s.id} className="text-xs bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-full px-2 py-0.5">{s.name}</span>)}
                </div>
              </div>
              <button onClick={() => expandedId === f.id ? setExpandedId(null) : loadCourts(f.id)}
                className={BTN_W + " text-xs"}>
                {expandedId === f.id ? "Đóng" : "Quản lý sân ▸"}
              </button>
            </div>

            {expandedId === f.id && (
              <div className="mt-4 border-t border-gray-200 pt-4">
                {/* ─── Incident Reports Panel ─── */}
                {(() => {
                  const openReports = facilityReports.filter(r => r.status === "OPEN");
                  const resolvedReports = facilityReports.filter(r => r.status === "RESOLVED");
                  const TYPE_LABEL: Record<string, string> = {
                    FACILITY: "Sự cố sân",
                    EQUIPMENT: "Thiết bị hỏng",
                    INVENTORY_DAMAGE: "Hàng hóa hỏng",
                  };
                  const TYPE_COLOR: Record<string, string> = {
                    FACILITY: "bg-red-100 text-red-700 border-red-200",
                    EQUIPMENT: "bg-orange-100 text-orange-700 border-orange-200",
                    INVENTORY_DAMAGE: "bg-yellow-100 text-yellow-700 border-yellow-200",
                  };
                  if (facilityReports.length === 0) return null;
                  return (
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-semibold text-red-700">⚠️ Báo cáo sự cố từ nhân viên</h4>
                          {openReports.length > 0 && (
                            <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{openReports.length} chưa giải quyết</span>
                          )}
                        </div>
                        {resolvedReports.length > 0 && (
                          <button onClick={() => setShowResolvedReports(v => !v)} className="text-xs text-gray-500 hover:text-gray-700 underline">
                            {showResolvedReports ? "Ẩn đã giải quyết" : `Xem ${resolvedReports.length} đã giải quyết`}
                          </button>
                        )}
                      </div>
                      <div className="space-y-2">
                        {openReports.map(r => (
                          <div key={r.id} className="bg-red-50 border border-red-200 rounded-xl p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${TYPE_COLOR[r.type] || "bg-gray-100 text-gray-600 border-gray-200"}`}>
                                    {TYPE_LABEL[r.type] || r.type}
                                  </span>
                                  <span className="text-xs text-gray-500">{r.staff.fullName}</span>
                                  <span className="text-xs text-gray-400">{new Date(r.createdAt).toLocaleString("vi-VN")}</span>
                                </div>
                                <p className="text-sm font-semibold text-gray-800">{r.title}</p>
                                <p className="text-xs text-gray-600 mt-0.5 whitespace-pre-wrap">{r.description}</p>
                              </div>
                              <button onClick={() => resolveReport(r.id)}
                                className="shrink-0 bg-emerald-500 hover:bg-emerald-400 text-white px-2.5 py-1 rounded-lg text-xs transition-colors whitespace-nowrap">
                                ✓ Đã giải quyết
                              </button>
                            </div>
                          </div>
                        ))}
                        {showResolvedReports && resolvedReports.map(r => (
                          <div key={r.id} className="bg-gray-50 border border-gray-200 rounded-xl p-3 opacity-70">
                            <div className="flex items-start gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                  <span className="text-xs font-medium px-2 py-0.5 rounded-full border bg-green-100 text-green-700 border-green-200">✓ Đã giải quyết</span>
                                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${TYPE_COLOR[r.type] || "bg-gray-100 text-gray-600 border-gray-200"}`}>
                                    {TYPE_LABEL[r.type] || r.type}
                                  </span>
                                  <span className="text-xs text-gray-500">{r.staff.fullName}</span>
                                  <span className="text-xs text-gray-400">{new Date(r.createdAt).toLocaleString("vi-VN")}</span>
                                </div>
                                <p className="text-sm font-medium text-gray-700">{r.title}</p>
                                <p className="text-xs text-gray-500 mt-0.5 whitespace-pre-wrap">{r.description}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
                <h4 className="text-sm font-semibold text-black mb-3">Danh sách sân con</h4>
                {courts.length === 0 ? <p className="text-xs text-gray-400">Chưa có sân nào</p> : (
                  <div className="space-y-2 mb-4">
                    {courts.map((c: any) => (
                      <div key={c.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-2.5">
                          <div>
                            <p className="text-sm font-medium text-black">{c.name}</p>
                            <p className="text-xs text-gray-500">{c.category?.name}</p>
                          </div>
                          <div className="flex gap-1.5">
                            <button onClick={() => openCourtManage(c.id, "pricing")}
                              className="bg-blue-500 hover:bg-blue-400 text-white px-2.5 py-1 rounded-lg text-xs transition-colors">
                              Khung giờ & giá
                            </button>
                            <button onClick={() => openCourtManage(c.id, "schedule")}
                              className="bg-purple-500 hover:bg-purple-400 text-white px-2.5 py-1 rounded-lg text-xs transition-colors">
                              Lịch sân
                            </button>
                            <button onClick={() => openCourtManage(c.id, "lock")}
                              className="bg-orange-500 hover:bg-orange-400 text-white px-2.5 py-1 rounded-lg text-xs transition-colors">
                              Khóa sân
                            </button>
                            <button onClick={() => deleteCourt(c.id)} className={BTN_R}>Xóa</button>
                          </div>
                        </div>

                        {/* Court management panel */}
                        {managingCourtId === c.id && (
                          <div className="border-t border-gray-100 bg-gray-50 p-4">
                            <div className="flex gap-1 mb-3">
                              {(["pricing", "schedule", "lock"] as const).map(t => (
                                <button key={t} onClick={() => { setManagingTab(t); if(t==="schedule") loadSchedule(c.id); if(t==="lock") loadLocks(c.id); }}
                                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors border ${managingTab === t ? "bg-emerald-500 text-white border-emerald-500" : "bg-white text-gray-600 border-gray-300"}`}>
                                  {t === "pricing" ? "Khung giờ & Giá" : t === "schedule" ? "Lịch hiện tại" : "Khóa sân"}
                                </button>
                              ))}
                              <button onClick={() => setManagingCourtId(null)} className="ml-auto text-gray-400 hover:text-gray-600 text-xs">✕ Đóng</button>
                            </div>

                            {/* Pricing tab */}
                            {managingTab === "pricing" && (
                              <div>
                                {/* Giờ mở/đóng cửa & thuê tối thiểu */}
                                <div className="bg-white border border-gray-200 rounded-xl p-3 mb-3">
                                  <p className="text-xs font-semibold text-gray-600 mb-2">Giờ hoạt động & thời gian thuê tối thiểu</p>
                                  <div className="grid grid-cols-2 gap-2 mb-2">
                                    <div>
                                      <p className="text-xs text-gray-500 mb-1">Giờ mở cửa</p>
                                      <input type="time" className={INPUT + " text-xs py-1"} value={courtOpenTime}
                                        onChange={e => setCourtOpenTime(e.target.value)} />
                                    </div>
                                    <div>
                                      <p className="text-xs text-gray-500 mb-1">Giờ đóng cửa</p>
                                      <input type="time" className={INPUT + " text-xs py-1"} value={courtCloseTime}
                                        onChange={e => setCourtCloseTime(e.target.value)} />
                                    </div>
                                  </div>
                                  <div>
                                    <p className="text-xs text-gray-500 mb-1">Thời gian thuê tối thiểu</p>
                                    <div className="flex gap-1.5 flex-wrap">
                                      {[30, 60, 90, 120, 150].map(m => (
                                        <button key={m} type="button"
                                          onClick={() => { setCourtMinRental(m); setCourtMinRentalCustom(false); }}
                                          className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${!courtMinRentalCustom && courtMinRental === m ? "bg-emerald-500 text-white border-emerald-500" : "bg-white text-gray-600 border-gray-300 hover:border-emerald-400"}`}>
                                          {m < 60 ? `${m} phút` : m === 60 ? "1 giờ" : m === 90 ? "1g30" : m === 120 ? "2 giờ" : "2g30"}
                                        </button>
                                      ))}
                                      <button type="button"
                                        onClick={() => setCourtMinRentalCustom(true)}
                                        className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${courtMinRentalCustom ? "bg-emerald-500 text-white border-emerald-500" : "bg-white text-gray-600 border-gray-300 hover:border-emerald-400"}`}>
                                        Khác
                                      </button>
                                    </div>
                                    {courtMinRentalCustom && (
                                      <div className="flex items-center gap-2 mt-2">
                                        <input type="number" min={15} step={15} className={INPUT + " text-xs py-1 w-32"}
                                          value={courtMinRental}
                                          onChange={e => setCourtMinRental(Number(e.target.value))}
                                          placeholder="Số phút" />
                                        <span className="text-xs text-gray-500">phút</span>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Khung giờ giá */}
                                <p className="text-xs font-semibold text-gray-600 mb-2">Khung giờ & Giá</p>
                                <div className="space-y-2 mb-3">
                                  {pricingRules.map((rule, idx) => (
                                    <div key={idx} className="grid grid-cols-6 gap-1.5 items-center bg-white p-2 rounded-lg border border-gray-200">
                                      <select className={INPUT + " text-xs py-1"} value={rule.dayType}
                                        onChange={e => setPricingRules(prev => prev.map((r,i) => i===idx ? {...r, dayType: e.target.value as any} : r))}>
                                        <option value="WEEKDAY">Ngày thường</option>
                                        <option value="WEEKEND">Cuối tuần</option>
                                        <option value="HOLIDAY">Ngày lễ</option>
                                      </select>
                                      <input type="time" className={INPUT + " text-xs py-1"} value={rule.startTime}
                                        onChange={e => setPricingRules(prev => prev.map((r,i) => i===idx ? {...r, startTime: e.target.value} : r))} />
                                      <input type="time" className={INPUT + " text-xs py-1"} value={rule.endTime}
                                        onChange={e => setPricingRules(prev => prev.map((r,i) => i===idx ? {...r, endTime: e.target.value} : r))} />
                                      <input type="number" placeholder="Giá/giờ (đ)" className={INPUT + " text-xs py-1"} value={rule.pricePerHour}
                                        onChange={e => setPricingRules(prev => prev.map((r,i) => i===idx ? {...r, pricePerHour: Number(e.target.value)} : r))} />
                                      <label className="flex items-center gap-1 text-xs cursor-pointer">
                                        <input type="checkbox" checked={rule.isPeak}
                                          onChange={e => setPricingRules(prev => prev.map((r,i) => i===idx ? {...r, isPeak: e.target.checked, priority: e.target.checked ? 1 : 0} : r))} />
                                        <span className={rule.isPeak ? "text-amber-600 font-semibold" : "text-gray-500"}>Cao điểm</span>
                                      </label>
                                      <button onClick={() => removePricingRule(idx)} className="text-red-400 hover:text-red-600 text-xs">✕ Xóa</button>
                                    </div>
                                  ))}
                                </div>
                                <div className="flex gap-2 flex-wrap">
                                  <button onClick={addPricingRule} className={BTN_W + " text-xs py-1.5"}>+ Thêm khung giờ</button>
                                  <button onClick={savePricingRules} disabled={savingPricing} className={BTN_G + " text-xs py-1.5"}>{savingPricing ? "Đang lưu..." : "Lưu"}</button>
                                  <button onClick={applyPricingToSameSport} disabled={savingPricing}
                                    className="bg-blue-500 hover:bg-blue-400 disabled:opacity-50 text-white px-3 py-1.5 rounded-xl text-xs font-medium transition-colors">
                                    Áp dụng cho tất cả sân cùng môn
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* Schedule tab */}
                            {managingTab === "schedule" && (
                              <div>
                                <div className="flex gap-2 mb-3 items-center">
                                  <input type="date" className={INPUT + " w-44 text-xs py-1"} value={scheduleDate}
                                    onChange={e => setScheduleDate(e.target.value)} />
                                  <button onClick={() => loadSchedule(c.id)} className={BTN_G + " text-xs py-1.5"}>Xem</button>
                                </div>
                                {scheduleData && (
                                  <div className="space-y-1 max-h-60 overflow-y-auto">
                                    {scheduleData.locks?.length > 0 && (
                                      <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-xs text-red-700 mb-2">
                                        🔒 Sân đang bị khóa ({scheduleData.locks.map((l: any) => `${new Date(l.startDate).toLocaleDateString("vi-VN")} - ${new Date(l.endDate).toLocaleDateString("vi-VN")}`).join(", ")})
                                      </div>
                                    )}
                                    {[...scheduleData.bookings || [], ...scheduleData.guestBookings || []].length === 0 ? (
                                      <p className="text-xs text-gray-400 py-2">Không có lịch đặt</p>
                                    ) : [...scheduleData.bookings || [], ...scheduleData.guestBookings || []].sort((a: any, b: any) => new Date(a.bookingDate).getTime() - new Date(b.bookingDate).getTime()).map((b: any, idx: number) => (
                                      <div key={idx} className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs flex justify-between">
                                        <div>
                                          <span className="font-medium">{new Date(b.bookingDate).toLocaleDateString("vi-VN")}</span>
                                          <span className="ml-2 text-gray-500">{new Date(b.startTime).toISOString().substring(11,16)} – {new Date(b.endTime).toISOString().substring(11,16)}</span>
                                        </div>
                                        <div className="text-right">
                                          <p className="font-medium">{b.customer?.fullName || b.guestName || b.walkInName || "Khách vãng lai"}</p>
                                          <p className="text-gray-400">{b.customer?.phone || b.guestPhone || ""}</p>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Lock tab */}
                            {managingTab === "lock" && (
                              <div>
                                {/* Existing locks */}
                                {courtLocks.length > 0 && (
                                  <div className="mb-3 space-y-1">
                                    <p className="text-xs font-semibold text-gray-600 mb-1">Đang khóa:</p>
                                    {courtLocks.map(lock => (
                                      <div key={lock.id} className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex justify-between items-center text-xs">
                                        <div>
                                          <span className="font-medium text-red-700">{lock.reason === "INCIDENT" ? "Sự cố" : lock.reason === "MONTHLY_RENTAL" ? "Thuê tháng" : lock.reason === "ANNUAL_RENTAL" ? "Thuê năm" : "Bảo trì"}</span>
                                          <span className="ml-2 text-gray-500">{new Date(lock.startDate).toLocaleDateString("vi-VN")} – {new Date(lock.endDate).toLocaleDateString("vi-VN")}</span>
                                          {lock.note && <p className="text-gray-400 mt-0.5">{lock.note}</p>}
                                        </div>
                                        <button onClick={() => removeLock(lock.id)} className="text-gray-400 hover:text-red-500 transition-colors">Mở khóa</button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {/* Add lock form */}
                                <div className="bg-white border border-gray-200 rounded-lg p-3 space-y-2">
                                  <p className="text-xs font-semibold text-gray-600">Thêm lịch khóa sân:</p>
                                  <select className={INPUT + " text-xs py-1"} value={lockForm.reason}
                                    onChange={e => setLockForm(f => ({ ...f, reason: e.target.value }))}>
                                    <option value="INCIDENT">Sự cố / Hỏng hóc</option>
                                    <option value="MAINTENANCE">Bảo trì</option>
                                    <option value="MONTHLY_RENTAL">Cho thuê bao tháng</option>
                                    <option value="ANNUAL_RENTAL">Cho thuê bao năm</option>
                                  </select>
                                  <div className="grid grid-cols-2 gap-2">
                                    <div>
                                      <p className="text-xs text-gray-500 mb-1">Từ ngày</p>
                                      <input type="date" className={INPUT + " text-xs py-1"} value={lockForm.startDate}
                                        onChange={e => setLockForm(f => ({ ...f, startDate: e.target.value }))} />
                                    </div>
                                    <div>
                                      <p className="text-xs text-gray-500 mb-1">Đến ngày</p>
                                      <input type="date" className={INPUT + " text-xs py-1"} value={lockForm.endDate}
                                        onChange={e => setLockForm(f => ({ ...f, endDate: e.target.value }))} />
                                    </div>
                                  </div>
                                  <input className={INPUT + " text-xs py-1"} placeholder="Ghi chú (tùy chọn)" value={lockForm.note}
                                    onChange={e => setLockForm(f => ({ ...f, note: e.target.value }))} />
                                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                                    <input type="checkbox" checked={lockForm.notifyCustomers}
                                      onChange={e => setLockForm(f => ({ ...f, notifyCustomers: e.target.checked }))} />
                                    Gửi thông báo đến khách hàng có lịch đặt
                                  </label>
                                  <button onClick={addLock} className={BTN_G + " text-xs py-1.5 w-full"}>Khóa sân</button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Mã QR mặc định */}
                <div className="bg-white rounded-xl p-4 border border-emerald-200 mt-3">
                  <p className="text-sm font-semibold text-black mb-2">Mã QR thanh toán mặc định</p>
                  <p className="text-xs text-gray-500 mb-3">Khách vãng lai sẽ thấy mã QR này sau khi đặt sân. Tiền sẽ vào ví kinh doanh của bạn.</p>
                  <div className="flex items-start gap-4">
                    <div className="w-24 h-24 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 flex items-center justify-center overflow-hidden shrink-0">
                      {f.defaultQrUrl ? (
                        <img src={f.defaultQrUrl} alt="QR" className="w-full h-full object-contain" />
                      ) : (
                        <span className="text-gray-400 text-xs text-center px-2">Chưa có QR</span>
                      )}
                    </div>
                    <div className="flex-1">
                      <label className={`cursor-pointer inline-flex items-center gap-1.5 text-xs bg-emerald-500 hover:bg-emerald-400 text-white px-3 py-2 rounded-xl transition-colors ${qrUploading ? "opacity-50 pointer-events-none" : ""}`}>
                        {qrUploading ? "Đang tải..." : f.defaultQrUrl ? "Đổi mã QR" : "Tải mã QR lên"}
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="hidden"
                          onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadQrFile(f.id, file); e.target.value = ""; }}
                          disabled={qrUploading}
                        />
                      </label>
                      {f.defaultQrUrl && (
                        <button
                          onClick={() => saveQrCode(f.id, "")}
                          disabled={qrSaving === f.id}
                          className="ml-2 text-xs text-red-500 hover:text-red-700 transition-colors"
                        >
                          Xóa QR
                        </button>
                      )}
                      <p className="text-xs text-gray-400 mt-2">Ảnh QR ngân hàng/ví điện tử của bạn (JPG, PNG, WebP)</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl p-4 border border-gray-200 mt-3">
                  <p className="text-sm font-semibold text-black mb-3">+ Thêm sân mới</p>
                  <div className="grid grid-cols-2 gap-2">
                    <input className={INPUT} placeholder="Tên sân *" value={courtForm.name} onChange={e => setCourtForm(f => ({ ...f, name: e.target.value }))} />
                    <select className={INPUT} value={courtForm.categoryId} onChange={e => setCourtForm(f => ({ ...f, categoryId: e.target.value }))}>
                      <option value="">-- Môn thể thao --</option>
                      {sports.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    <input className={INPUT} placeholder="Giá ngày thường (nghìn đ/giờ)" type="number" value={courtForm.weekdayPrice} onChange={e => setCourtForm(f => ({ ...f, weekdayPrice: e.target.value }))} />
                    <input className={INPUT} placeholder="Giá cuối tuần (nghìn đ/giờ)" type="number" value={courtForm.weekendPrice} onChange={e => setCourtForm(f => ({ ...f, weekendPrice: e.target.value }))} />
                    <input className={INPUT} placeholder="Giá cao điểm 17-21h (nghìn đ/giờ)" type="number" value={courtForm.peakPrice} onChange={e => setCourtForm(f => ({ ...f, peakPrice: e.target.value }))} />
                    <button onClick={addCourt} disabled={loading} className={BTN_G + " h-full"}>{loading ? "..." : "Thêm sân"}</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Vouchers Tab ────────────────────────────────────────────────────────────
function VouchersTab({ facilities }: { facilities: Facility[] }) {
  const [vouchers, setVouchers] = useState<OwnerVoucher[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    code: "", name: "", discountType: "PERCENT", discountValue: "",
    minOrderValue: "", maxDiscount: "", startDate: "", endDate: "",
    usageLimit: "100", facilityId: "", requiredMembershipTier: "",
  });

  useEffect(() => {
    fetch("/api/owner/vouchers").then(r => r.ok ? r.json() : Promise.reject(r.status)).then(d => { if (Array.isArray(d)) setVouchers(d); }).catch(() => {});
  }, []);

  async function createVoucher() {
    if (!form.code || !form.discountValue || !form.startDate || !form.endDate) {
      alert("Vui lòng điền đầy đủ thông tin bắt buộc"); return;
    }
    setSaving(true);
    const res = await fetch("/api/owner/vouchers", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        facilityId: form.facilityId ? Number(form.facilityId) : null,
      }),
    });
    setSaving(false);
    if (res.ok) {
      const data = await res.json();
      setVouchers(prev => [data, ...prev]);
      setShowForm(false);
      setForm({ code: "", name: "", discountType: "PERCENT", discountValue: "", minOrderValue: "", maxDiscount: "", startDate: "", endDate: "", usageLimit: "100", facilityId: "", requiredMembershipTier: "" });
    } else {
      const d = await res.json(); alert(d.error || "Tạo voucher thất bại");
    }
  }

  async function toggleActive(v: OwnerVoucher) {
    const res = await fetch(`/api/owner/vouchers/${v.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !v.isActive }),
    });
    if (res.ok) setVouchers(prev => prev.map(x => x.id === v.id ? { ...x, isActive: !v.isActive } : x));
  }

  async function deleteVoucher(id: number) {
    if (!confirm("Xóa voucher này?")) return;
    await fetch(`/api/owner/vouchers/${id}`, { method: "DELETE" });
    setVouchers(prev => prev.filter(v => v.id !== id));
  }

  const now = new Date();

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-black">Voucher & Mã giảm giá ({vouchers.length})</h2>
        <button onClick={() => setShowForm(!showForm)} className={BTN_G}>+ Tạo voucher</button>
      </div>

      {showForm && (
        <div className="border border-gray-300 rounded-2xl p-5 mb-4" style={{ background: "#E0EEE0" }}>
          <h3 className="font-semibold text-black mb-4">Tạo voucher mới</h3>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-xs text-gray-600 mb-1 block">Mã voucher *</label>
              <input className={INPUT} placeholder="VD: SUMMER20" value={form.code}
                onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} />
            </div>
            <div>
              <label className="text-xs text-gray-600 mb-1 block">Tên / mô tả</label>
              <input className={INPUT} placeholder="VD: Khuyến mãi hè 2026" value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-gray-600 mb-1 block">Loại giảm giá *</label>
              <select className={INPUT} value={form.discountType}
                onChange={e => setForm(f => ({ ...f, discountType: e.target.value }))}>
                <option value="PERCENT">Phần trăm (%)</option>
                <option value="FIXED_AMOUNT">Số tiền cố định (đ)</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-600 mb-1 block">
                Giá trị giảm * {form.discountType === "PERCENT" ? "(%)" : "(đ)"}
              </label>
              <input type="number" className={INPUT} placeholder={form.discountType === "PERCENT" ? "VD: 20" : "VD: 50000"} value={form.discountValue}
                onChange={e => setForm(f => ({ ...f, discountValue: e.target.value }))} />
            </div>
            {form.discountType === "PERCENT" && (
              <div>
                <label className="text-xs text-gray-600 mb-1 block">Giảm tối đa (đ)</label>
                <input type="number" className={INPUT} placeholder="VD: 100000 (bỏ trống = không giới hạn)" value={form.maxDiscount}
                  onChange={e => setForm(f => ({ ...f, maxDiscount: e.target.value }))} />
              </div>
            )}
            <div>
              <label className="text-xs text-gray-600 mb-1 block">Đơn tối thiểu (đ)</label>
              <input type="number" className={INPUT} placeholder="0 = không yêu cầu" value={form.minOrderValue}
                onChange={e => setForm(f => ({ ...f, minOrderValue: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-gray-600 mb-1 block">Số lượt dùng *</label>
              <input type="number" className={INPUT} value={form.usageLimit}
                onChange={e => setForm(f => ({ ...f, usageLimit: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-gray-600 mb-1 block">Cơ sở áp dụng</label>
              <select className={INPUT} value={form.facilityId}
                onChange={e => setForm(f => ({ ...f, facilityId: e.target.value }))}>
                <option value="">Tất cả cơ sở</option>
                {facilities.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-600 mb-1 block">Đối tượng hội viên</label>
              <select className={INPUT} value={form.requiredMembershipTier}
                onChange={e => setForm(f => ({ ...f, requiredMembershipTier: e.target.value }))}>
                <option value="">Tất cả khách hàng</option>
                <option value="SILVER">Hội viên SILVER trở lên</option>
                <option value="GOLD">Hội viên GOLD trở lên</option>
                <option value="PLATINUM">Hội viên PLATINUM</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-600 mb-1 block">Từ ngày *</label>
              <input type="date" className={INPUT} value={form.startDate}
                onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-gray-600 mb-1 block">Đến ngày *</label>
              <input type="date" className={INPUT} value={form.endDate}
                onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={createVoucher} disabled={saving} className={BTN_G}>{saving ? "Đang tạo..." : "Tạo voucher"}</button>
            <button onClick={() => setShowForm(false)} className={BTN_W}>Hủy</button>
          </div>
        </div>
      )}

      {vouchers.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-sm">Chưa có voucher nào. Tạo voucher để khuyến khích khách đặt sân!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {vouchers.map(v => {
            const expired = new Date(v.endDate) < now;
            const notStarted = new Date(v.startDate) > now;
            const statusLabel = expired ? "Hết hạn" : notStarted ? "Chưa bắt đầu" : v.isActive ? "Đang hoạt động" : "Tắt";
            const statusColor = expired ? "text-gray-400" : notStarted ? "text-yellow-600" : v.isActive ? "text-emerald-600" : "text-red-500";
            return (
              <div key={v.id} className="border border-gray-300 rounded-2xl p-4" style={{ background: "#E0EEE0" }}>
                <div className="flex items-start justify-between flex-wrap gap-2">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-black text-base tracking-wide">{v.code}</span>
                      {v.name && <span className="text-xs text-gray-500">— {v.name}</span>}
                      <span className={`text-xs font-medium ${statusColor}`}>● {statusLabel}</span>
                    </div>
                    <p className="text-sm text-gray-700">
                      {v.discountType === "PERCENT"
                        ? `Giảm ${v.discountValue}%${v.maxDiscount ? ` (tối đa ${Number(v.maxDiscount).toLocaleString("vi-VN")}đ)` : ""}`
                        : `Giảm ${Number(v.discountValue).toLocaleString("vi-VN")}đ`}
                      {Number(v.minOrderValue) > 0 && ` · Đơn từ ${Number(v.minOrderValue).toLocaleString("vi-VN")}đ`}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {new Date(v.startDate).toLocaleDateString("vi-VN")} – {new Date(v.endDate).toLocaleDateString("vi-VN")}
                      {" · "}Đã dùng: {v.usedCount}/{v.usageLimit}
                      {v.facility && ` · ${v.facility.name}`}
                      {v.requiredMembershipTier && ` · Yêu cầu: ${v.requiredMembershipTier}+`}
                    </p>
                  </div>
                  <div className="flex gap-1.5">
                    {!expired && (
                      <button onClick={() => toggleActive(v)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${v.isActive ? "bg-white text-gray-600 border-gray-300 hover:bg-gray-50" : "bg-emerald-500 text-white border-emerald-500 hover:bg-emerald-400"}`}>
                        {v.isActive ? "Tắt" : "Bật"}
                      </button>
                    )}
                    <button onClick={() => deleteVoucher(v.id)} className={BTN_R}>Xóa</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Staff Tab ───────────────────────────────────────────────────────────────
function StaffTab({ facilities }: { facilities: Facility[] }) {
  const [staff, setStaff] = useState<StaffRecord[]>([]);
  const [selectedFacility, setSelectedFacility] = useState<string>("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    facilityId: "", fullName: "", email: "", phone: "", password: "", role: "STAFF",
    employmentType: "PARTTIME", wageRate: "",
  });
  const [viewStaff, setViewStaff] = useState<StaffRecord | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({ fullName: "", phone: "", role: "STAFF", employmentType: "PARTTIME", wageRate: "" });
  const [loading, setLoading] = useState(false);

  const loadStaff = useCallback((fid?: string) => {
    const q = fid ? `?facilityId=${fid}` : "";
    fetch(`/api/owner/staff${q}`).then(r => r.json()).then(d => setStaff(Array.isArray(d) ? d : []));
  }, []);

  useEffect(() => { loadStaff(); }, [loadStaff]);

  async function createStaff() {
    setLoading(true);
    const wageType = form.employmentType === "PARTTIME" ? "HOURLY" : "DAILY";
    const res = await fetch("/api/owner/staff", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, wageType, wageRate: form.wageRate ? Number(form.wageRate) * 1000 : 0 }),
    });
    setLoading(false);
    if (res.ok) {
      setShowForm(false);
      setForm({ facilityId: "", fullName: "", email: "", phone: "", password: "", role: "STAFF", employmentType: "PARTTIME", wageRate: "" });
      loadStaff(selectedFacility || undefined);
    } else { const d = await res.json(); alert(d.error); }
  }

  async function saveEditStaff() {
    if (!viewStaff) return;
    setLoading(true);
    const wageType = editForm.employmentType === "PARTTIME" ? "HOURLY" : "DAILY";
    const res = await fetch(`/api/owner/staff/${viewStaff.staffRecordId}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: editForm.fullName,
        phone: editForm.phone,
        role: editForm.role,
        wageType,
        wageRate: editForm.wageRate ? Number(editForm.wageRate) * 1000 : 0,
      }),
    });
    setLoading(false);
    if (res.ok) {
      const result = await res.json();
      setEditMode(false);
      setViewStaff(null);
      loadStaff(selectedFacility || undefined);
      if (result.deferred && result.effectiveFrom) {
        const effDate = new Date(result.effectiveFrom);
        const label = `${effDate.getMonth() + 1}/${effDate.getFullYear()}`;
        alert(`✅ Đã lưu!\nThay đổi lương / phân loại sẽ có hiệu lực từ tháng ${label}.`);
      }
    } else { const d = await res.json(); alert(d.error); }
  }

  async function toggleLockStaff(recordId: number, isLocked: boolean) {
    if (!confirm(`${isLocked ? "Mở khóa" : "Khóa"} tài khoản nhân viên này?`)) return;
    await fetch(`/api/owner/staff/${recordId}`, { method: "PATCH" });
    loadStaff(selectedFacility || undefined);
  }

  function openView(s: StaffRecord, startEdit = false) {
    const cfg = s.wageConfig;
    setEditForm({
      fullName: s.user.fullName,
      phone: s.user.phone,
      role: s.role,
      employmentType: cfg?.wageType === "DAILY" ? "FULLTIME" : "PARTTIME",
      wageRate: cfg ? String(cfg.wageRate / 1000) : "",
    });
    setViewStaff(s);
    setEditMode(startEdit);
  }

  const filtered = selectedFacility ? staff.filter(s => s.facilityId === Number(selectedFacility)) : staff;

  const ROLE_LABEL: Record<string, string> = { STAFF: "Nhân viên", WAREHOUSE_MANAGER: "Quản lý kho" };
  const WAGE_LABEL: Record<string, string> = { HOURLY: "Theo giờ", DAILY: "Theo ngày" };

  return (
    <div>
      {/* Modal xem / sửa nhân viên */}
      {viewStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-gray-900">{viewStaff.user.fullName}</h3>
                <p className="text-xs text-gray-400 mt-0.5">{viewStaff.facilityName} · Từ {new Date(viewStaff.joinedAt).toLocaleDateString("vi-VN")}</p>
              </div>
              <div className="flex gap-2">
                {!editMode && (
                  <button onClick={() => setEditMode(true)}
                    className="bg-blue-500 hover:bg-blue-400 text-white px-3 py-1.5 rounded-lg text-xs transition-colors">
                    Chỉnh sửa
                  </button>
                )}
                <button onClick={() => { setViewStaff(null); setEditMode(false); }}
                  className="text-gray-400 hover:text-gray-600 text-lg leading-none px-2">✕</button>
              </div>
            </div>

            {/* Read-only info */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-gray-50 rounded-xl p-3">
                <div className="text-[10px] text-gray-400 mb-0.5">Email</div>
                <div className="text-sm text-gray-700 font-medium break-all">{viewStaff.user.email}</div>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <div className="text-[10px] text-gray-400 mb-0.5">Trạng thái</div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${viewStaff.user.isLocked ? "bg-red-100 text-red-600" : "bg-emerald-100 text-emerald-700"}`}>
                  {viewStaff.user.isLocked ? "Đã khóa" : "Hoạt động"}
                </span>
              </div>
              <div className="col-span-2 bg-gray-50 rounded-xl p-3">
                <div className="text-[10px] text-gray-400 mb-0.5">Ví SportHub</div>
                {viewStaff.user.wallet
                  ? <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-emerald-600">{Number(viewStaff.user.wallet.balance).toLocaleString("vi-VN")}đ</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${viewStaff.user.wallet.status === "ACTIVE" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                        {viewStaff.user.wallet.status === "ACTIVE" ? "Hoạt động" : "Tạm khóa"}
                      </span>
                    </div>
                  : <span className="text-xs text-orange-500 font-medium">⚠ Chưa có ví — chạy lệnh <code className="bg-orange-50 px-1 rounded">npm run sync:wallets</code> để đồng bộ</span>
                }
              </div>
            </div>

            {/* Editable fields */}
            <div className="grid grid-cols-2 gap-2.5 mb-4">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Họ và tên</label>
                <input className={INPUT + (editMode ? "" : " bg-gray-50 cursor-default")} readOnly={!editMode}
                  value={editForm.fullName} onChange={e => setEditForm(f => ({ ...f, fullName: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Số điện thoại</label>
                <input className={INPUT + (editMode ? "" : " bg-gray-50 cursor-default")} readOnly={!editMode}
                  value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Phân loại / Vai trò</label>
                {editMode ? (
                  <select className={INPUT} value={editForm.role} onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))}>
                    <option value="STAFF">Nhân viên</option>
                    <option value="WAREHOUSE_MANAGER">Quản lý kho</option>
                  </select>
                ) : (
                  <div className={INPUT + " bg-gray-50 cursor-default"}>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${editForm.role === "WAREHOUSE_MANAGER" ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"}`}>
                      {ROLE_LABEL[editForm.role] ?? editForm.role}
                    </span>
                  </div>
                )}
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Loại hợp đồng</label>
                {editMode ? (
                  <select className={INPUT} value={editForm.employmentType} onChange={e => setEditForm(f => ({ ...f, employmentType: e.target.value }))}>
                    <option value="PARTTIME">Theo giờ (Hourly)</option>
                    <option value="FULLTIME">Theo ngày (Daily)</option>
                  </select>
                ) : (
                  <div className={INPUT + " bg-gray-50 cursor-default text-gray-700"}>
                    {editForm.employmentType === "FULLTIME" ? "Theo ngày" : "Theo giờ"}
                  </div>
                )}
              </div>
              <div className="col-span-2">
                <label className="text-xs text-gray-500 mb-1 block">
                  Mức lương ({editForm.employmentType === "PARTTIME" ? "nghìn đ/giờ" : "nghìn đ/ngày"})
                </label>
                <input className={INPUT + (editMode ? "" : " bg-gray-50 cursor-default")} readOnly={!editMode}
                  type="number" min="0" value={editForm.wageRate}
                  onChange={e => setEditForm(f => ({ ...f, wageRate: e.target.value }))} />
              </div>
            </div>

            {/* Lịch sử thay đổi */}
            {viewStaff.wageHistory && viewStaff.wageHistory.length > 0 && (
              <div className="mt-2 mb-4">
                <div className="text-xs font-semibold text-gray-600 mb-2">Lịch sử thay đổi lương & phân loại</div>
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {viewStaff.wageHistory.map(h => {
                    const isPending = !h.isApplied;
                    const effDate = new Date(h.effectiveFrom);
                    const effLabel = `${effDate.getMonth() + 1}/${effDate.getFullYear()}`;
                    const changedDate = new Date(h.changedAt).toLocaleDateString("vi-VN");
                    return (
                      <div key={h.id} className={`rounded-lg px-3 py-2 text-xs ${isPending ? "bg-amber-50 border border-amber-200" : "bg-gray-50 border border-gray-100"}`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className={`font-semibold ${isPending ? "text-amber-700" : "text-gray-600"}`}>
                            {isPending ? `⏳ Chờ áp dụng — Tháng ${effLabel}` : `✅ Đã áp dụng — Tháng ${effLabel}`}
                          </span>
                          <span className="text-gray-400">{changedDate}</span>
                        </div>
                        {h.oldRole !== null && h.newRole !== null && (
                          <div className="text-gray-600">Vai trò: <span className="line-through text-red-400">{h.oldRole === "WAREHOUSE_MANAGER" ? "Quản lý kho" : "Nhân viên"}</span> → <span className="text-emerald-600 font-medium">{h.newRole === "WAREHOUSE_MANAGER" ? "Quản lý kho" : "Nhân viên"}</span></div>
                        )}
                        {h.oldWageRate !== null && h.newWageRate !== null && (
                          <div className="text-gray-600">
                            Lương: <span className="line-through text-red-400">{h.oldWageRate.toLocaleString("vi-VN")}đ/{h.oldWageType === "DAILY" ? "ngày" : "giờ"}</span> → <span className="text-emerald-600 font-medium">{h.newWageRate.toLocaleString("vi-VN")}đ/{h.newWageType === "DAILY" ? "ngày" : "giờ"}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex gap-2 justify-between">
              <button onClick={() => toggleLockStaff(viewStaff.staffRecordId, viewStaff.user.isLocked)}
                className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${viewStaff.user.isLocked ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200" : "bg-red-100 text-red-600 hover:bg-red-200"}`}>
                {viewStaff.user.isLocked ? "Mở khóa tài khoản" : "Khóa tài khoản"}
              </button>
              <div className="flex gap-2">
                <button onClick={() => { setViewStaff(null); setEditMode(false); }} className={BTN_W}>Đóng</button>
                {editMode && (
                  <button onClick={saveEditStaff} disabled={loading} className={BTN_G}>
                    {loading ? "Đang lưu..." : "Lưu thay đổi"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <select className={INPUT + " w-48"} value={selectedFacility}
          onChange={e => { setSelectedFacility(e.target.value); loadStaff(e.target.value || undefined); }}>
          <option value="">Tất cả cơ sở</option>
          {facilities.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
        <button onClick={() => setShowForm(!showForm)} className={BTN_G}>+ Thêm nhân viên</button>
      </div>

      {showForm && (
        <div className={CARD} style={BG}>
          <h3 className="font-semibold text-black mb-3">Tạo tài khoản nhân viên</h3>
          <div className="grid grid-cols-2 gap-2.5">
            <select className={INPUT} value={form.facilityId} onChange={e => setForm(f => ({ ...f, facilityId: e.target.value }))}>
              <option value="">-- Chọn cơ sở * --</option>
              {facilities.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
            <select className={INPUT} value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
              <option value="STAFF">Nhân viên</option>
              <option value="WAREHOUSE_MANAGER">Quản lý kho</option>
            </select>
            <input className={INPUT} placeholder="Họ và tên *" value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} />
            <input className={INPUT} placeholder="Email *" type="email" autoComplete="off" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            <input className={INPUT} placeholder="Số điện thoại *" type="tel" autoComplete="off" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            <input className={INPUT} placeholder="Mật khẩu *" type="password" autoComplete="new-password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
            <select className={INPUT} value={form.employmentType} onChange={e => setForm(f => ({ ...f, employmentType: e.target.value }))}>
              <option value="PARTTIME">Theo giờ (Hourly)</option>
              <option value="FULLTIME">Theo ngày (Daily)</option>
            </select>
            <input className={INPUT} type="number" min="0"
              placeholder={form.employmentType === "PARTTIME" ? "Mức lương (nghìn đ/giờ)" : "Mức lương (nghìn đ/ngày)"}
              value={form.wageRate} onChange={e => setForm(f => ({ ...f, wageRate: e.target.value }))} />
          </div>
          <div className="flex gap-2 justify-end mt-3">
            <button onClick={() => setShowForm(false)} className={BTN_W}>Hủy</button>
            <button onClick={createStaff} disabled={loading} className={BTN_G}>{loading ? "Đang tạo..." : "Tạo tài khoản"}</button>
          </div>
        </div>
      )}

      <div className="overflow-auto rounded-2xl border border-gray-300" style={BG}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50/60">
              <th className="text-left px-4 py-3 font-semibold text-gray-700 align-top">Họ tên</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-700 align-top">Email / SĐT</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-700 align-top">Vai trò</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-700 align-top">Loại hợp đồng</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-700 align-top">Cơ sở</th>
              <th className="px-4 py-3 align-top text-right font-semibold text-gray-700 text-xs">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-8 text-gray-400">Chưa có nhân viên</td></tr>
            ) : filtered.map(s => (
              <tr key={s.staffRecordId} className={`border-t border-gray-100 hover:bg-white/50 ${s.user.isLocked ? "opacity-60" : ""}`}>
                <td className="px-4 py-3 font-medium text-black">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span>{s.user.fullName}</span>
                    {s.user.isLocked && <span className="text-xs text-red-500 font-normal">(Đã khóa)</span>}
                  </div>
                  {s.user.wallet
                    ? <span className="text-xs text-emerald-600 font-normal">💳 {Number(s.user.wallet.balance).toLocaleString("vi-VN")}đ</span>
                    : <span className="text-xs text-orange-500 font-normal">⚠ Chưa có ví</span>
                  }
                </td>
                <td className="px-4 py-3 text-gray-600 text-xs">
                  <p className="text-sm">{s.user.email}</p>
                  <p>{s.user.phone}</p>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${s.role === "WAREHOUSE_MANAGER" ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"}`}>
                    {ROLE_LABEL[s.role] ?? s.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-gray-600">
                  {s.wageConfig ? (
                    <div>
                      <span className={`px-2 py-0.5 rounded-full ${s.wageConfig.wageType === "DAILY" ? "bg-purple-100 text-purple-700" : "bg-sky-100 text-sky-700"}`}>
                        {WAGE_LABEL[s.wageConfig.wageType] ?? s.wageConfig.wageType}
                      </span>
                      <p className="text-gray-500 mt-0.5">
                        {Number(s.wageConfig.wageRate).toLocaleString("vi-VN")}đ/{s.wageConfig.wageType === "DAILY" ? "ngày" : "giờ"}
                      </p>
                    </div>
                  ) : <span className="text-gray-400">Chưa cấu hình</span>}
                </td>
                <td className="px-4 py-3 text-gray-600 text-xs">{s.facilityName}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => openView(s, false)}
                      className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg text-xs transition-colors">
                      Xem
                    </button>
                    <button onClick={() => openView(s, true)}
                      className="bg-blue-500 hover:bg-blue-400 text-white px-3 py-1.5 rounded-lg text-xs transition-colors">
                      Sửa
                    </button>
                    <button onClick={() => toggleLockStaff(s.staffRecordId, s.user.isLocked)}
                      className={s.user.isLocked ? BTN_G + " text-xs py-1.5 px-3" : BTN_R}>
                      {s.user.isLocked ? "Mở khóa" : "Khóa"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Attendance Tab ──────────────────────────────────────────────────────────
function AttendanceTab({ facilities }: { facilities: Facility[] }) {
  const now = new Date();
  const [facilityId, setFacilityId] = useState<string>("");
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [data, setData] = useState<AttendanceStaff[]>([]);
  const [expandedStaff, setExpandedStaff] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [viewMode, setViewMode] = useState<"month" | "day">("month");
  const [selectedDate, setSelectedDate] = useState(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`);

  async function load() {
    if (!facilityId) { alert("Vui lòng chọn cơ sở"); return; }
    const params = viewMode === "day"
      ? `facilityId=${facilityId}&viewMode=day&date=${selectedDate}`
      : `facilityId=${facilityId}&viewMode=month&month=${month}&year=${year}`;
    const res = await fetch(`/api/owner/attendance?${params}`);
    const d = await res.json();
    setData(d);
    setLoaded(true);
  }

  const STATUS_LABEL: Record<string, string> = { WORKING: "Đang làm", COMPLETED: "Hoàn thành", ABSENT: "Vắng" };

  return (
    <div>
      <div className={CARD} style={BG}>
        <div className="flex gap-1 mb-3">
          {(["month", "day"] as const).map(v => (
            <button key={v} onClick={() => setViewMode(v)}
              className={`px-4 py-1.5 rounded-xl text-sm font-medium transition-colors border ${viewMode === v ? "bg-emerald-500 text-white border-emerald-500" : "bg-white text-gray-600 border-gray-300 hover:border-emerald-300"}`}>
              {v === "month" ? "Theo tháng" : "Theo ngày"}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <p className="text-xs text-gray-500 mb-1">Cơ sở</p>
            <select className={INPUT + " w-48"} value={facilityId} onChange={e => setFacilityId(e.target.value)}>
              <option value="">-- Chọn cơ sở --</option>
              {facilities.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>
          {viewMode === "month" ? (
            <>
              <div>
                <p className="text-xs text-gray-500 mb-1">Tháng</p>
                <select className={INPUT + " w-28"} value={month} onChange={e => setMonth(Number(e.target.value))}>
                  {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>Tháng {i + 1}</option>)}
                </select>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Năm</p>
                <select className={INPUT + " w-28"} value={year} onChange={e => setYear(Number(e.target.value))}>
                  {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </>
          ) : (
            <div>
              <p className="text-xs text-gray-500 mb-1">Ngày</p>
              <input type="date" className={INPUT + " w-44"} value={selectedDate}
                onChange={e => { setSelectedDate(e.target.value); }} />
            </div>
          )}
          <button onClick={load} className={BTN_G}>Xem</button>
        </div>
      </div>

      {loaded && data.map(staff => (
        <div key={staff.userId} className={CARD} style={BG}>
          <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpandedStaff(expandedStaff === staff.userId ? null : staff.userId)}>
            <div>
              <p className="font-semibold text-black">{staff.fullName}</p>
              <p className="text-xs text-gray-500">{staff.role === "WAREHOUSE_MANAGER" ? "Quản lý kho" : "Nhân viên"}{staff.wageType === "DAILY" ? " · Toàn thời gian" : ""}</p>
            </div>
            <div className="flex gap-3 text-right text-sm flex-wrap justify-end">
              <div><p className="font-bold text-emerald-600">{staff.presentDays}</p><p className="text-xs text-gray-500">ngày</p></div>
              {staff.totalHours !== null && (
                <div><p className="font-bold text-blue-600">{staff.totalHours}h</p><p className="text-xs text-gray-500">giờ</p></div>
              )}
              {staff.lateDays > 0 && (
                <div><p className="font-bold text-orange-500">{staff.lateDays}</p><p className="text-xs text-gray-500">trễ</p></div>
              )}
              {staff.forgotCheckInCount > 0 && (
                <div><p className="font-bold text-red-500">{staff.forgotCheckInCount}</p><p className="text-xs text-gray-500">quên vào</p></div>
              )}
              {staff.forgotCheckOutCount > 0 && (
                <div><p className="font-bold text-red-500">{staff.forgotCheckOutCount}</p><p className="text-xs text-gray-500">quên ra</p></div>
              )}
              {staff.overtimeTotalMinutes > 0 && (
                <div><p className="font-bold text-purple-600">{Math.round(staff.overtimeTotalMinutes / 60 * 10) / 10}h</p><p className="text-xs text-gray-500">tăng ca</p></div>
              )}
              <span className="text-gray-400">{expandedStaff === staff.userId ? "▲" : "▼"}</span>
            </div>
          </div>

          {expandedStaff === staff.userId && (
            <div className="mt-3 overflow-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-3 font-semibold text-gray-600">Ngày</th>
                    {viewMode === "day" && <th className="text-left py-2 px-3 font-semibold text-gray-600">Ca làm</th>}
                    {viewMode === "day" && <th className="text-left py-2 px-3 font-semibold text-gray-600">Bắt đầu ca</th>}
                    <th className="text-left py-2 px-3 font-semibold text-gray-600">Check-in</th>
                    <th className="text-left py-2 px-3 font-semibold text-gray-600">Check-out</th>
                    {viewMode === "day" && <th className="text-left py-2 px-3 font-semibold text-gray-600">Kết thúc ca</th>}
                    {staff.totalHours !== null && <th className="text-left py-2 px-3 font-semibold text-gray-600">Giờ</th>}
                    <th className="text-left py-2 px-3 font-semibold text-gray-600">Nhãn</th>
                    <th className="text-left py-2 px-3 font-semibold text-gray-600">Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {staff.records.length === 0 ? (
                    <tr><td colSpan={8} className="py-4 text-center text-gray-400">Không có dữ liệu</td></tr>
                  ) : staff.records.map(r => (
                    <tr key={r.id} className="border-t border-gray-100">
                      <td className="py-2 px-3">{new Date(r.date).toLocaleDateString("vi-VN")}</td>
                      {viewMode === "day" && (
                        <td className="py-2 px-3 text-blue-600 font-medium">{r.shift?.name ?? "—"}</td>
                      )}
                      {viewMode === "day" && (
                        <td className="py-2 px-3 text-gray-500">{r.shift ? new Date(r.shift.startTime).toISOString().substring(11,16) : "—"}</td>
                      )}
                      <td className={`py-2 px-3 ${r.isLate ? "text-red-500 font-semibold" : ""}`}>
                        {r.checkIn ? new Date(r.checkIn).toISOString().substring(11,16) : (r.forgotCheckIn ? <span className="text-red-400 italic">Quên</span> : "—")}
                      </td>
                      <td className={`py-2 px-3 ${r.forgotCheckOut ? "text-orange-500" : ""}`}>
                        {r.checkOut ? new Date(r.checkOut).toISOString().substring(11,16) : (r.forgotCheckOut ? <span className="text-orange-400 italic">Quên</span> : "—")}
                      </td>
                      {viewMode === "day" && (
                        <td className="py-2 px-3 text-gray-500">{r.shift ? new Date(r.shift.endTime).toISOString().substring(11,16) : "—"}</td>
                      )}
                      {staff.totalHours !== null && (
                        <td className="py-2 px-3 font-medium">{r.totalHours ?? "—"}</td>
                      )}
                      <td className="py-2 px-3">
                        <div className="flex flex-wrap gap-1">
                          {r.isLate && <span className="px-1.5 py-0.5 rounded bg-orange-100 text-orange-600">Trễ</span>}
                          {r.forgotCheckIn && <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-600">Quên check-in</span>}
                          {r.forgotCheckOut && <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-600">Quên check-out</span>}
                          {r.overtimeMinutes > 0 && <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-600">+{Math.round(r.overtimeMinutes/60*10)/10}h TC</span>}
                        </div>
                      </td>
                      <td className="py-2 px-3">
                        <span className={`px-2 py-0.5 rounded-full ${r.status === "ABSENT" ? "bg-red-100 text-red-600" : r.status === "WORKING" ? "bg-yellow-100 text-yellow-700" : "bg-emerald-100 text-emerald-700"}`}>
                          {STATUS_LABEL[r.status] || r.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Salary Tab ──────────────────────────────────────────────────────────────
function SalaryTab({ facilities }: { facilities: Facility[] }) {
  const now = new Date();
  const [facilityId, setFacilityId] = useState<string>("");
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [staffData, setStaffData] = useState<SalaryStaffRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [bonusInputs, setBonusInputs] = useState<Record<number, string>>({});
  const [overtimeInputs, setOvertimeInputs] = useState<Record<number, string>>({});
  const [penaltyInputs, setPenaltyInputs] = useState<Record<number, string>>({});
  const [savingId, setSavingId] = useState<number | null>(null);

  async function load() {
    if (!facilityId) return;
    const res = await fetch(`/api/owner/salary?facilityId=${facilityId}&month=${month}&year=${year}`);
    if (res.ok) {
      const d = await res.json();
      setStaffData(d.staffData || []);
      const initBonus: Record<number, string> = {};
      const initOvertime: Record<number, string> = {};
      const initPenalty: Record<number, string> = {};
      (d.staffData || []).forEach((s: SalaryStaffRow) => {
        initBonus[s.userId] = s.salaryRecord ? String(s.salaryRecord.bonus / 1000) : "0";
        initOvertime[s.userId] = s.salaryRecord ? String(s.salaryRecord.overtimePay / 1000) : "0";
        initPenalty[s.userId] = s.salaryRecord ? String(s.salaryRecord.penaltyAmount / 1000) : "0";
      });
      setBonusInputs(initBonus);
      setOvertimeInputs(initOvertime);
      setPenaltyInputs(initPenalty);
      setLoaded(true);
    }
  }

  async function saveSalary(row: SalaryStaffRow) {
    if (!row.wageConfig) { alert("Nhân viên chưa có cấu hình lương. Vào tab Nhân viên để cài đặt."); return; }
    setSavingId(row.userId);
    const bonus = Number(bonusInputs[row.userId] || 0) * 1000;
    const overtimePay = Number(overtimeInputs[row.userId] || 0) * 1000;
    const penaltyAmount = Number(penaltyInputs[row.userId] || 0) * 1000;
    const res = await fetch("/api/owner/salary", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        facilityId: Number(facilityId), staffId: row.userId, month, year,
        wageType: row.wageConfig.wageType, wageRate: row.wageConfig.wageRate,
        bonus, overtimePay, penaltyAmount,
      }),
    });
    setSavingId(null);
    if (res.ok) load();
    else { const d = await res.json(); alert(d.error); }
  }

  async function paySalary(recordId: number) {
    if (!confirm("Xác nhận thanh toán lương?")) return;
    const res = await fetch("/api/owner/salary/pay", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ salaryRecordId: recordId }),
    });
    if (res.ok) load();
    else { const d = await res.json(); alert(d.error); }
  }

  function calcSalary(row: SalaryStaffRow) {
    if (!row.wageConfig) return null;
    const { wageType, wageRate } = row.wageConfig;
    const base = wageType === "HOURLY"
      ? (row.attendance.totalHours ?? 0) * wageRate
      : row.attendance.presentDays * wageRate;
    const bonus = Number(bonusInputs[row.userId] || 0) * 1000;
    const overtime = Number(overtimeInputs[row.userId] || 0) * 1000;
    const penalty = Number(penaltyInputs[row.userId] || 0) * 1000;
    return { base, bonus, overtime, penalty, total: base + bonus + overtime - penalty };
  }

  const savedRows   = staffData.filter(s => s.salaryRecord);
  const totalPaid   = savedRows.filter(s => s.salaryRecord?.isPaid).reduce((a, s) => a + (s.salaryRecord?.finalSalary ?? 0), 0);
  const totalUnpaid = savedRows.filter(s => !s.salaryRecord?.isPaid).reduce((a, s) => a + (s.salaryRecord?.finalSalary ?? 0), 0);

  function exportSalaryExcel() {
    const cell = (v: string | number, type: "String" | "Number" = "String") =>
      `<Cell><Data ss:Type="${type}">${String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;")}</Data></Cell>`;
    const xmlRow = (...cells: string[]) => `<Row>${cells.join("")}</Row>`;
    const sheet = `<Worksheet ss:Name="Bảng lương T${month}-${year}"><Table>
      ${xmlRow(cell("Họ tên"), cell("Chức danh"), cell("Ngày làm"), cell("Giờ làm"), cell("Lương cơ bản (đ)"), cell("Thưởng (đ)"), cell("Tăng ca (h)"), cell("Lương tăng ca (đ)"), cell("Tiền phạt (đ)"), cell("Trễ (ngày)"), cell("Quên check-out"), cell("Tổng lương (đ)"), cell("Trạng thái"))}
      ${staffData.map(r => {
        const calc = calcSalary(r);
        const sal = r.salaryRecord;
        return xmlRow(
          cell(r.fullName),
          cell(r.role === "WAREHOUSE_MANAGER" ? "Quản lý kho" : "Nhân viên"),
          cell(r.attendance.presentDays, "Number"),
          cell(r.attendance.totalHours ?? 0, "Number"),
          cell(calc ? Number(calc.base) : sal ? Number(sal.baseSalary) : 0, "Number"),
          cell(sal ? Number(sal.bonus) : Number(bonusInputs[r.userId] || 0) * 1000, "Number"),
          cell(r.attendance.overtimeHours, "Number"),
          cell(sal ? Number(sal.overtimePay) : Number(overtimeInputs[r.userId] || 0) * 1000, "Number"),
          cell(sal ? Number(sal.penaltyAmount) : Number(penaltyInputs[r.userId] || 0) * 1000, "Number"),
          cell(r.attendance.lateDays ?? 0, "Number"),
          cell(r.attendance.forgotCheckOutCount ?? 0, "Number"),
          cell(calc ? Number(calc.total) : sal ? Number(sal.finalSalary) : 0, "Number"),
          cell(sal?.isPaid ? "Đã trả" : "Chưa trả"),
        );
      }).join("\n")}
    </Table></Worksheet>`;
    const xml = `<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">${sheet}</Workbook>`;
    const blob = new Blob([xml], { type: "application/vnd.ms-excel" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `bang-luong-T${month}-${year}.xls`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      {/* Header + bộ lọc */}
      <div className={CARD} style={BG}>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <p className="text-xs text-gray-500 mb-1">Cơ sở</p>
            <select className={INPUT + " w-48"} value={facilityId} onChange={e => setFacilityId(e.target.value)}>
              <option value="">-- Chọn cơ sở --</option>
              {facilities.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Tháng</p>
            <select className={INPUT + " w-24"} value={month} onChange={e => setMonth(Number(e.target.value))}>
              {Array.from({ length: 12 }, (_, i) => <option key={i+1} value={i+1}>T{i+1}</option>)}
            </select>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Năm</p>
            <select className={INPUT + " w-24"} value={year} onChange={e => setYear(Number(e.target.value))}>
              {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <button onClick={load} className={BTN_G}>Xem</button>
          {loaded && staffData.length > 0 && (
            <button onClick={exportSalaryExcel} className={BTN_W + " flex items-center gap-1.5"}>
              ⬇ Xuất Excel
            </button>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-2">Ngày trả lương mặc định: <span className="font-semibold text-gray-600">mùng 10 hằng tháng</span></p>
      </div>

      {loaded && (
        <>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-black">Bảng lương tháng {month}/{year}</h3>
            <span className="text-xs text-gray-500">{staffData.length} nhân viên</span>
          </div>

          <div className="overflow-auto rounded-2xl border border-gray-300 mb-4" style={BG}>
            <table className="w-full text-sm min-w-max">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">Họ tên</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">Chức danh</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-700">Ngày làm</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-700">Giờ làm</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-700">Lương CB</th>
                  <th className="text-center px-4 py-3 font-semibold text-amber-600">Thưởng (nghìn)</th>
                  <th className="text-center px-4 py-3 font-semibold text-purple-600">Tăng ca (h)</th>
                  <th className="text-center px-4 py-3 font-semibold text-purple-600">Lương TC (nghìn)</th>
                  <th className="text-center px-4 py-3 font-semibold text-red-500">Tiền phạt (nghìn)</th>
                  <th className="text-right px-4 py-3 font-semibold text-orange-500">Trễ / Q.CO</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-700">Tổng lương</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {staffData.length === 0 && (
                  <tr><td colSpan={12} className="text-center py-8 text-gray-400">Chưa có nhân viên trong cơ sở này</td></tr>
                )}
                {staffData.map(row => {
                  const calc = calcSalary(row);
                  const sal = row.salaryRecord;
                  return (
                    <tr key={row.userId} className="border-t border-gray-100 hover:bg-white/50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-black">{row.fullName}</p>
                        {row.wageConfig ? (
                          <p className="text-xs text-gray-400">{Number(row.wageConfig.wageRate).toLocaleString("vi-VN")}đ/{row.wageConfig.wageType === "DAILY" ? "ngày" : "giờ"}</p>
                        ) : (
                          <p className="text-xs text-amber-500">Chưa cấu hình lương</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">{row.role === "WAREHOUSE_MANAGER" ? "Quản lý kho" : "Nhân viên"}</td>
                      <td className="px-4 py-3 text-right font-medium">{row.attendance.presentDays}</td>
                      <td className="px-4 py-3 text-right font-medium">{row.attendance.totalHours !== null ? `${row.attendance.totalHours}h` : "—"}</td>
                      <td className="px-4 py-3 text-right font-medium text-blue-600">
                        {calc ? Number(calc.base).toLocaleString("vi-VN") + "đ" : "—"}
                      </td>
                      {/* Thưởng */}
                      <td className="px-4 py-3 text-center">
                        {sal?.isPaid ? (
                          <span className="text-gray-600">{Number(sal.bonus).toLocaleString("vi-VN")}đ</span>
                        ) : (
                          <input type="number" min="0" placeholder="0"
                            className={INPUT + " max-w-[80px] py-1 text-xs text-center"}
                            value={bonusInputs[row.userId] ?? "0"}
                            onChange={e => setBonusInputs(prev => ({ ...prev, [row.userId]: e.target.value }))}
                          />
                        )}
                      </td>
                      {/* Tăng ca */}
                      <td className="px-4 py-3 text-center text-purple-600 font-medium">
                        {row.attendance.overtimeHours > 0 ? `${row.attendance.overtimeHours}h` : "—"}
                      </td>
                      {/* Lương tăng ca */}
                      <td className="px-4 py-3 text-center">
                        {sal?.isPaid ? (
                          <span className="text-purple-600">{Number(sal.overtimePay).toLocaleString("vi-VN")}đ</span>
                        ) : (
                          <input type="number" min="0" placeholder="0"
                            className={INPUT + " max-w-[80px] py-1 text-xs text-center"}
                            value={overtimeInputs[row.userId] ?? "0"}
                            onChange={e => setOvertimeInputs(prev => ({ ...prev, [row.userId]: e.target.value }))}
                          />
                        )}
                      </td>
                      {/* Tiền phạt */}
                      <td className="px-4 py-3 text-center">
                        {sal?.isPaid ? (
                          <span className="text-red-500">{Number(sal.penaltyAmount) > 0 ? `-${Number(sal.penaltyAmount).toLocaleString("vi-VN")}đ` : "—"}</span>
                        ) : (
                          <input type="number" min="0" placeholder="0"
                            className={INPUT + " max-w-[80px] py-1 text-xs text-center"}
                            value={penaltyInputs[row.userId] ?? "0"}
                            onChange={e => setPenaltyInputs(prev => ({ ...prev, [row.userId]: e.target.value }))}
                          />
                        )}
                      </td>
                      {/* Trễ / Quên check-out */}
                      <td className="px-4 py-3 text-right text-xs">
                        {(row.attendance.lateDays ?? 0) > 0 && (
                          <span className="text-orange-500 font-semibold block">{row.attendance.lateDays} trễ</span>
                        )}
                        {(row.attendance.forgotCheckOutCount ?? 0) > 0 && (
                          <span className="text-red-500 font-semibold block">{row.attendance.forgotCheckOutCount} Q.CO</span>
                        )}
                        {!(row.attendance.lateDays ?? 0) && !(row.attendance.forgotCheckOutCount ?? 0) && (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-600">
                        {calc ? Number(calc.total).toLocaleString("vi-VN") + "đ" : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {sal?.isPaid ? (
                          <div>
                            <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full">Đã trả</span>
                            <p className="text-xs text-gray-400 mt-0.5">{sal.paidAt ? new Date(sal.paidAt).toLocaleDateString("vi-VN") : ""}</p>
                          </div>
                        ) : (
                          <div className="flex gap-1 justify-end">
                            <button onClick={() => saveSalary(row)} disabled={savingId === row.userId || !row.wageConfig}
                              className={BTN_G + " text-xs py-1 px-2"}>
                              {savingId === row.userId ? "..." : sal ? "Cập nhật" : "Lưu"}
                            </button>
                            {sal && !sal.isPaid && (
                              <button onClick={() => paySalary(sal.id)}
                                className="bg-amber-500 hover:bg-amber-400 text-white px-2 py-1 rounded-lg text-xs">
                                Trả
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Tổng kết */}
          {savedRows.length > 0 && (
            <div className="flex gap-3 flex-wrap">
              <div className="bg-white rounded-xl px-4 py-2.5 border border-red-200 flex-1 text-center">
                <p className="text-xs text-gray-500">Chưa thanh toán</p>
                <p className="font-bold text-red-500">{totalUnpaid.toLocaleString("vi-VN")}đ</p>
                <p className="text-xs text-gray-400">{savedRows.filter(s => !s.salaryRecord?.isPaid).length} nhân viên</p>
              </div>
              <div className="bg-white rounded-xl px-4 py-2.5 border border-emerald-200 flex-1 text-center">
                <p className="text-xs text-gray-500">Đã thanh toán</p>
                <p className="font-bold text-emerald-600">{totalPaid.toLocaleString("vi-VN")}đ</p>
                <p className="text-xs text-gray-400">{savedRows.filter(s => s.salaryRecord?.isPaid).length} nhân viên</p>
              </div>
              <div className="bg-white rounded-xl px-4 py-2.5 border border-blue-200 flex-1 text-center">
                <p className="text-xs text-gray-500">Tổng bảng lương</p>
                <p className="font-bold text-blue-600">{(totalPaid + totalUnpaid).toLocaleString("vi-VN")}đ</p>
                <p className="text-xs text-gray-400">{savedRows.length} nhân viên đã lưu</p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}


// ─── Work Shifts Tab ─────────────────────────────────────────────────────────
const DOW_LABELS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

function WorkShiftsTab({ facilities }: { facilities: Facility[] }) {
  const now = new Date();
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay() + 1);
  const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6);
  const fmt = (d: Date) => d.toISOString().substring(0, 10);

  const [facilityId, setFacilityId] = useState<string>("");
  const [viewStart, setViewStart] = useState(fmt(weekStart));
  const [viewEnd, setViewEnd] = useState(fmt(weekEnd));
  const [shifts, setShifts] = useState<WorkShift[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [expandedShift, setExpandedShift] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "Ca sáng",
    fromDate: fmt(weekStart),
    toDate: fmt(weekEnd),
    daysOfWeek: [1, 2, 3, 4, 5] as number[], // T2-T6 mặc định
    startTime: "06:00",
    endTime: "14:00",
    maxStaff: "5",
    note: "",
    applyToAll: true,
    selectedFacilityIds: [] as number[],
  });
  const [saving, setSaving] = useState(false);
  const [facilityStaff, setFacilityStaff] = useState<{ userId: number; fullName: string }[]>([]);

  async function load() {
    if (!facilityId) { alert("Vui lòng chọn cơ sở"); return; }
    try {
      const res = await fetch(`/api/owner/work-shifts?facilityId=${facilityId}&startDate=${viewStart}&endDate=${viewEnd}`);
      const data = await res.json();
      if (!res.ok) { alert(data.error || "Lỗi tải ca làm"); return; }
      setShifts(Array.isArray(data) ? data : []);
      setLoaded(true);
      const staffRes = await fetch(`/api/owner/staff?facilityId=${facilityId}`);
      const staffData = await staffRes.json();
      setFacilityStaff(Array.isArray(staffData) ? staffData.map((s: any) => ({ userId: s.user.id, fullName: s.user.fullName })) : []);
    } catch {
      alert("Lỗi kết nối máy chủ. Vui lòng thử lại.");
    }
  }

  function toggleDow(d: number) {
    setForm(f => ({
      ...f,
      daysOfWeek: f.daysOfWeek.includes(d) ? f.daysOfWeek.filter(x => x !== d) : [...f.daysOfWeek, d],
    }));
  }

  // Tính preview số ca sẽ tạo
  function previewCount() {
    if (!form.fromDate || !form.toDate || form.daysOfWeek.length === 0) return 0;
    const from = new Date(form.fromDate);
    const to = new Date(form.toDate);
    let count = 0;
    const cur = new Date(from);
    while (cur <= to) {
      if (form.daysOfWeek.includes(cur.getDay())) count++;
      cur.setDate(cur.getDate() + 1);
    }
    return count;
  }

  async function createShifts() {
    if (form.daysOfWeek.length === 0) { alert("Vui lòng chọn ít nhất một ngày trong tuần"); return; }
    const targetIds: number[] = form.applyToAll
      ? facilities.map(f => f.id)
      : form.selectedFacilityIds;
    if (targetIds.length === 0) { alert("Vui lòng chọn ít nhất một cơ sở"); return; }
    const count = previewCount();
    const facilityNames = form.applyToAll
      ? "tất cả cơ sở"
      : facilities.filter(f => targetIds.includes(f.id)).map(f => f.name).join(", ");
    if (!confirm(`Sẽ tạo ${count} ca làm × ${targetIds.length} cơ sở cho "${form.name}". Áp dụng cho: ${facilityNames}. Xác nhận?`)) return;
    setSaving(true);
    let totalCreated = 0;
    const errors: string[] = [];
    for (const fid of targetIds) {
      const res = await fetch("/api/owner/work-shifts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, facilityId: fid, maxStaff: Number(form.maxStaff) }),
      });
      const d = await res.json();
      if (res.ok) totalCreated += d.created ?? 0;
      else errors.push(`${facilities.find(f => f.id === fid)?.name ?? fid}: ${d.error}`);
    }
    setSaving(false);
    if (errors.length > 0) alert(`Lỗi tạo ca ở một số cơ sở:\n${errors.join("\n")}`);
    else {
      alert(`Đã tạo ${totalCreated} ca làm thành công cho ${targetIds.length} cơ sở!`);
      setShowForm(false);
      setViewStart(form.fromDate);
      setViewEnd(form.toDate);
      if (facilityId) setTimeout(load, 100);
    }
  }

  async function deleteBulkShifts(name: string) {
    if (!facilityId) return;
    if (!confirm(`Xóa tất cả ca "${name}" trong khoảng ${viewStart} – ${viewEnd}?`)) return;
    await fetch(`/api/owner/work-shifts?facilityId=${facilityId}&fromDate=${viewStart}&toDate=${viewEnd}&name=${encodeURIComponent(name)}`, { method: "DELETE" });
    load();
  }

  async function deleteShift(shiftId: number) {
    if (!confirm("Xóa ca này?")) return;
    await fetch(`/api/owner/work-shifts/${shiftId}`, { method: "DELETE" });
    load();
  }

  async function approveReg(shiftId: number, registrationId: number, action: "approve" | "reject") {
    await fetch(`/api/owner/work-shifts/${shiftId}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, registrationId }),
    });
    load();
  }

  async function assignStaff(shiftId: number, staffId: number) {
    await fetch(`/api/owner/work-shifts/${shiftId}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "assign", staffId }),
    });
    load();
  }

  async function closeShift(shiftId: number) {
    await fetch(`/api/owner/work-shifts/${shiftId}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "CLOSED" }),
    });
    load();
  }

  const REG_STATUS: Record<string, { label: string; color: string }> = {
    PENDING:  { label: "Chờ duyệt", color: "bg-yellow-100 text-yellow-700" },
    APPROVED: { label: "Đã duyệt",  color: "bg-emerald-100 text-emerald-700" },
    REJECTED: { label: "Từ chối",   color: "bg-red-100 text-red-600" },
  };

  // Nhóm ca làm theo tên để thực hiện thao tác hàng loạt
  const shiftGroups = shifts.reduce<Record<string, WorkShift[]>>((acc, s) => {
    if (!acc[s.name]) acc[s.name] = [];
    acc[s.name].push(s);
    return acc;
  }, {});

  return (
    <div>
      {/* Filter / view header */}
      <div className={CARD} style={BG}>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <p className="text-xs text-gray-500 mb-1">Cơ sở</p>
            <select className={INPUT + " w-48"} value={facilityId} onChange={e => setFacilityId(e.target.value)}>
              <option value="">-- Chọn cơ sở --</option>
              {facilities.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Xem từ ngày</p>
            <input type="date" className={INPUT + " w-40"} value={viewStart} onChange={e => setViewStart(e.target.value)} />
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Đến ngày</p>
            <input type="date" className={INPUT + " w-40"} value={viewEnd} onChange={e => setViewEnd(e.target.value)} />
          </div>
          <button onClick={load} className={BTN_G}>Xem</button>
          <button onClick={() => setShowForm(!showForm)} className={BTN_W}>
            {showForm ? "Đóng" : "+ Tạo lịch ca"}
          </button>
        </div>
      </div>

      {/* Create shifts form */}
      {showForm && (
        <div className={CARD} style={BG}>
          <h3 className="font-semibold text-black mb-4">Tạo lịch ca theo khoảng ngày</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {/* Tên ca */}
            <div>
              <p className="text-xs text-gray-500 mb-1">Tên ca *</p>
              <input className={INPUT} placeholder="Ca sáng / Ca chiều / Ca tối..." value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            {/* Số NV tối đa */}
            <div>
              <p className="text-xs text-gray-500 mb-1">Số nhân viên tối đa</p>
              <input type="number" min="1" className={INPUT} value={form.maxStaff}
                onChange={e => setForm(f => ({ ...f, maxStaff: e.target.value }))} />
            </div>
            {/* Áp dụng từ ngày */}
            <div>
              <p className="text-xs text-gray-500 mb-1">Áp dụng từ ngày *</p>
              <input type="date" className={INPUT} value={form.fromDate}
                onChange={e => setForm(f => ({ ...f, fromDate: e.target.value }))} />
            </div>
            {/* Đến ngày */}
            <div>
              <p className="text-xs text-gray-500 mb-1">Đến ngày *</p>
              <input type="date" className={INPUT} value={form.toDate}
                onChange={e => setForm(f => ({ ...f, toDate: e.target.value }))} />
            </div>
            {/* Giờ bắt đầu */}
            <div>
              <p className="text-xs text-gray-500 mb-1">Giờ bắt đầu ca *</p>
              <input type="time" className={INPUT} value={form.startTime}
                onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} />
            </div>
            {/* Giờ kết thúc */}
            <div>
              <p className="text-xs text-gray-500 mb-1">Giờ kết thúc ca *</p>
              <input type="time" className={INPUT} value={form.endTime}
                onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} />
            </div>
          </div>

          {/* Chọn ngày trong tuần */}
          <div className="mt-3">
            <p className="text-xs text-gray-500 mb-2">Áp dụng vào các ngày trong tuần *</p>
            <div className="flex gap-2 flex-wrap">
              {DOW_LABELS.map((label, idx) => (
                <button key={idx} type="button" onClick={() => toggleDow(idx)}
                  className={`w-10 h-10 rounded-xl text-sm font-semibold border transition-colors ${
                    form.daysOfWeek.includes(idx)
                      ? "bg-emerald-500 text-white border-emerald-500"
                      : "bg-white text-gray-600 border-gray-300 hover:border-emerald-300"
                  }`}>
                  {label}
                </button>
              ))}
              <button type="button" onClick={() => setForm(f => ({ ...f, daysOfWeek: [1,2,3,4,5] }))}
                className="px-3 h-10 rounded-xl text-xs border border-gray-300 bg-white text-gray-600 hover:border-emerald-300 transition-colors">
                T2–T6
              </button>
              <button type="button" onClick={() => setForm(f => ({ ...f, daysOfWeek: [0,1,2,3,4,5,6] }))}
                className="px-3 h-10 rounded-xl text-xs border border-gray-300 bg-white text-gray-600 hover:border-emerald-300 transition-colors">
                Tất cả
              </button>
              <button type="button" onClick={() => setForm(f => ({ ...f, daysOfWeek: [0, 6] }))}
                className="px-3 h-10 rounded-xl text-xs border border-gray-300 bg-white text-gray-600 hover:border-emerald-300 transition-colors">
                Cuối tuần
              </button>
            </div>
          </div>

          {/* Ghi chú */}
          <div className="mt-3">
            <p className="text-xs text-gray-500 mb-1">Ghi chú</p>
            <input className={INPUT} placeholder="Ghi chú (tùy chọn)" value={form.note}
              onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
          </div>

          {/* Áp dụng cho cơ sở */}
          <div className="mt-4">
            <p className="text-xs text-gray-500 mb-2">Áp dụng cho cơ sở *</p>
            <div className="flex gap-2 mb-3">
              <button type="button"
                onClick={() => setForm(f => ({ ...f, applyToAll: true, selectedFacilityIds: [] }))}
                className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
                  form.applyToAll ? "bg-emerald-500 text-white border-emerald-500" : "bg-white text-gray-600 border-gray-300 hover:border-emerald-300"
                }`}>
                Tất cả cơ sở ({facilities.length})
              </button>
              <button type="button"
                onClick={() => setForm(f => ({ ...f, applyToAll: false, selectedFacilityIds: facilityId ? [Number(facilityId)] : [] }))}
                className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
                  !form.applyToAll ? "bg-emerald-500 text-white border-emerald-500" : "bg-white text-gray-600 border-gray-300 hover:border-emerald-300"
                }`}>
                Chọn cơ sở cụ thể
              </button>
            </div>
            {!form.applyToAll && (
              <div className="flex flex-wrap gap-2">
                {facilities.map(f => {
                  const checked = form.selectedFacilityIds.includes(f.id);
                  return (
                    <button key={f.id} type="button"
                      onClick={() => setForm(prev => ({
                        ...prev,
                        selectedFacilityIds: checked
                          ? prev.selectedFacilityIds.filter(id => id !== f.id)
                          : [...prev.selectedFacilityIds, f.id],
                      }))}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm border transition-colors ${
                        checked ? "bg-emerald-50 border-emerald-400 text-emerald-700 font-medium" : "bg-white border-gray-300 text-gray-600 hover:border-emerald-300"
                      }`}>
                      <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 ${checked ? "bg-emerald-500 border-emerald-500" : "border-gray-400"}`}>
                        {checked && <span className="text-white text-xs leading-none">✓</span>}
                      </span>
                      {f.name}
                    </button>
                  );
                })}
              </div>
            )}
            {!form.applyToAll && form.selectedFacilityIds.length === 0 && (
              <p className="text-xs text-red-500 mt-1">Chưa chọn cơ sở nào</p>
            )}
          </div>

          {/* Preview */}
          {form.fromDate && form.toDate && form.daysOfWeek.length > 0 && (
            <div className="mt-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5 text-sm text-emerald-700">
              Sẽ tạo <strong>{previewCount()} ca làm</strong> "{form.name}" từ{" "}
              {new Date(form.fromDate).toLocaleDateString("vi-VN")} đến{" "}
              {new Date(form.toDate).toLocaleDateString("vi-VN")},
              vào các ngày: {form.daysOfWeek.sort().map(d => DOW_LABELS[d]).join(", ")}{" "}
              × <strong>{form.applyToAll ? facilities.length : form.selectedFacilityIds.length} cơ sở</strong>
              {" "}= <strong>{previewCount() * (form.applyToAll ? facilities.length : form.selectedFacilityIds.length)} ca tổng</strong>
            </div>
          )}

          <div className="flex gap-2 mt-4 justify-end">
            <button onClick={() => setShowForm(false)} className={BTN_W}>Hủy</button>
            <button onClick={createShifts} disabled={saving || previewCount() === 0} className={BTN_G}>
              {saving ? "Đang tạo..." : `Tạo ${previewCount()} ca`}
            </button>
          </div>
        </div>
      )}

      {/* Shift list — grouped by name */}
      {loaded && shifts.length === 0 && (
        <div className={CARD + " text-center text-gray-400"} style={BG}>Chưa có ca làm trong khoảng thời gian này</div>
      )}

      {loaded && Object.entries(shiftGroups).map(([groupName, groupShifts]) => {
        const totalPending = groupShifts.reduce((s, sh) => s + sh.registrations.filter(r => r.status === "PENDING").length, 0);
        return (
          <div key={groupName} className={CARD} style={BG}>
            {/* Group header */}
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="font-bold text-black text-base">{groupName}</p>
                <p className="text-xs text-gray-500">
                  {groupShifts.length} ngày ·{" "}
                  {new Date(groupShifts[0].startTime).toISOString().substring(11,16)} – {new Date(groupShifts[0].endTime).toISOString().substring(11,16)}
                  {totalPending > 0 && <span className="ml-2 text-yellow-600 font-medium">{totalPending} chờ duyệt</span>}
                </p>
              </div>
              <button onClick={() => deleteBulkShifts(groupName)}
                className="text-xs text-red-400 hover:text-red-600 border border-red-200 hover:border-red-400 px-3 py-1.5 rounded-lg transition-colors">
                Xóa cả nhóm
              </button>
            </div>

            {/* Days in group */}
            <div className="space-y-1.5">
              {groupShifts.map(shift => {
                const approvedCount = shift.registrations.filter(r => r.status === "APPROVED").length;
                const pendingCount = shift.registrations.filter(r => r.status === "PENDING").length;
                const isExpanded = expandedShift === shift.id;
                return (
                  <div key={shift.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2.5 cursor-pointer"
                      onClick={() => setExpandedShift(isExpanded ? null : shift.id)}>
                      <div className="flex items-center gap-3">
                        <div>
                          <p className="text-sm font-medium text-gray-800">
                            {new Date(shift.shiftDate).toLocaleDateString("vi-VN", { weekday: "short", day: "2-digit", month: "2-digit" })}
                          </p>
                          <div className="flex gap-1.5 mt-0.5">
                            <span className={`text-xs px-1.5 py-0.5 rounded ${shift.status === "OPEN" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                              {shift.status === "OPEN" ? "Mở" : "Đóng"}
                            </span>
                            {pendingCount > 0 && (
                              <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">{pendingCount} chờ</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-sm font-bold ${approvedCount >= shift.maxStaff ? "text-emerald-600" : "text-gray-500"}`}>
                          {approvedCount}/{shift.maxStaff} NV
                        </span>
                        <span className="text-gray-400 text-xs">{isExpanded ? "▲" : "▼"}</span>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">
                        <div className="flex gap-2 mb-3 flex-wrap">
                          {shift.status === "OPEN" && (
                            <button onClick={() => closeShift(shift.id)}
                              className="bg-gray-500 hover:bg-gray-400 text-white px-3 py-1 rounded-lg text-xs">Đóng đăng ký</button>
                          )}
                          <button onClick={() => deleteShift(shift.id)} className={BTN_R}>Xóa ngày này</button>
                        </div>

                        {/* Registrations */}
                        <p className="text-xs font-semibold text-gray-600 mb-1.5">Nhân viên đăng ký:</p>
                        {shift.registrations.length === 0 ? (
                          <p className="text-xs text-gray-400 mb-3">Chưa có ai đăng ký</p>
                        ) : (
                          <div className="space-y-1 mb-3">
                            {shift.registrations.map(reg => (
                              <div key={reg.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-1.5 border border-gray-200">
                                <p className="text-xs font-medium">{reg.staff.fullName}</p>
                                <div className="flex items-center gap-1.5">
                                  <span className={`text-xs px-2 py-0.5 rounded-full ${REG_STATUS[reg.status]?.color}`}>
                                    {REG_STATUS[reg.status]?.label}
                                  </span>
                                  {reg.status === "PENDING" && (
                                    <>
                                      <button onClick={() => approveReg(shift.id, reg.id, "approve")}
                                        className="bg-emerald-500 text-white px-2 py-0.5 rounded text-xs">✓</button>
                                      <button onClick={() => approveReg(shift.id, reg.id, "reject")}
                                        className="bg-red-500 text-white px-2 py-0.5 rounded text-xs">✕</button>
                                    </>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Direct assign */}
                        <p className="text-xs font-semibold text-gray-600 mb-1.5">Giao ca trực tiếp:</p>
                        <div className="flex gap-1.5 flex-wrap">
                          {facilityStaff
                            .filter(s => !shift.registrations.some(r => r.staffId === s.userId && r.status === "APPROVED"))
                            .map(s => (
                              <button key={s.userId} onClick={() => assignStaff(shift.id, s.userId)}
                                className="bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-lg text-xs transition-colors">
                                + {s.fullName}
                              </button>
                            ))
                          }
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Bar Chart ───────────────────────────────────────────────────────────────
function BarChart({ items, labelKey, valueKey, color = "#10b981" }: {
  items: any[];
  labelKey: string;
  valueKey: string;
  color?: string;
}) {
  const max = Math.max(...items.map(i => i[valueKey]), 1);
  return (
    <div className="w-full overflow-x-auto">
      <div className="flex items-end gap-1.5 min-w-0" style={{ minHeight: 140 }}>
        {items.map((item, idx) => {
          const pct = Math.round((item[valueKey] / max) * 100);
          const barColor = item.highlight ? "#f59e0b" : color;
          return (
            <div key={idx} className="flex flex-col items-center flex-1 min-w-[28px]">
              <span className="text-xs font-semibold mb-1" style={{ color: barColor }}>
                {item[valueKey]}
              </span>
              <div className="w-full rounded-t-md transition-all" style={{
                height: `${Math.max(pct, 2)}px`,
                background: barColor,
                minHeight: 4,
                maxHeight: 100,
                opacity: pct === 0 ? 0.2 : 1,
              }} />
              <span className="text-xs text-gray-500 mt-1 truncate w-full text-center" style={{ fontSize: 10 }}>
                {item[labelKey]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Line Chart ───────────────────────────────────────────────────────────────
function LineChart({ items, labelKey, valueKey, color = "#10b981", formatValue }: {
  items: any[]; labelKey: string; valueKey: string; color?: string; formatValue?: (v: number) => string;
}) {
  if (items.length < 2) return <div className="text-center text-gray-400 py-6 text-sm">Không đủ dữ liệu</div>;
  const W = 600, H = 150, PX = 36, PY = 28;
  const values = items.map(i => Number(i[valueKey]));
  const max = Math.max(...values, 1), min = Math.min(...values, 0), range = max - min || 1;
  const pts = items.map((item, idx) => ({
    x: PX + (idx / (items.length - 1)) * (W - PX * 2),
    y: PY + (1 - (Number(item[valueKey]) - min) / range) * (H - PY * 2),
    item,
  }));
  const fmtV = formatValue || ((v: number) => v >= 1000000 ? (v / 1000000).toFixed(1) + "M" : v >= 1000 ? (v / 1000).toFixed(0) + "K" : String(v));
  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 300, height: H }}>
        {[0, 0.5, 1].map((t, i) => <line key={i} x1={PX} y1={PY + t * (H - PY * 2)} x2={W - PX} y2={PY + t * (H - PY * 2)} stroke="#e5e7eb" strokeWidth="1" />)}
        <path d={`M${pts[0].x},${H - PY} ` + pts.map(p => `L${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ") + ` L${pts[pts.length - 1].x},${H - PY} Z`} fill={color} opacity={0.08} />
        <polyline points={pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {pts.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={4} fill="white" stroke={color} strokeWidth="2" />
            <text x={p.x} y={H - 5} textAnchor="middle" fontSize={9} fill="#9ca3af">{p.item[labelKey]}</text>
            <text x={p.x} y={p.y - 8} textAnchor="middle" fontSize={9} fill={color} fontWeight="600">{fmtV(Number(p.item[valueKey]))}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

// ─── Invoices Tab ────────────────────────────────────────────────────────────
function InvoicesTab({ facilities }: { facilities: Facility[] }) {
  const now = new Date();
  const [facilityId, setFacilityId] = useState<string>("");
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [statusFilter, setStatusFilter] = useState<"all" | "ACTIVE" | "CANCELLED">("all");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [exporting, setExporting] = useState(false);

  const PM_LABEL: Record<string, string> = { CASH: "Tiền mặt", TRANSFER: "Chuyển khoản", QR: "VNPay", WALLET: "Ví SportHub" };

  async function load() {
    const params = new URLSearchParams({ month: String(month), year: String(year) });
    if (facilityId) params.set("facilityId", facilityId);
    if (statusFilter !== "all") params.set("status", statusFilter);
    const invRes = await fetch(`/api/owner/invoices?${params}`);
    const invData = await invRes.json();
    setInvoices(Array.isArray(invData) ? invData : []);
    setLoaded(true);
  }

  const activeInvoices = invoices.filter(i => i.invoiceStatus !== "CANCELLED");
  const cancelledInvoices = invoices.filter(i => i.invoiceStatus === "CANCELLED");
  const totalActive = activeInvoices.reduce((s, i) => s + Number(i.finalTotal), 0);
  const totalCancelled = cancelledInvoices.reduce((s, i) => s + Number(i.finalTotal), 0);

  function exportToExcel() {
    setExporting(true);
    const cell = (v: string | number, type: "String" | "Number" = "String") =>
      `<Cell><Data ss:Type="${type}">${String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;")}</Data></Cell>`;
    const xmlRow = (...cells: string[]) => `<Row>${cells.join("")}</Row>`;
    const sorted = [...invoices].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    const itemRows: string[] = [];
    for (const inv of sorted) {
      const dt = new Date(inv.createdAt);
      const dateStr = `${dt.getDate().toString().padStart(2,"0")}/${(dt.getMonth()+1).toString().padStart(2,"0")}/${dt.getFullYear()} ${dt.getHours().toString().padStart(2,"0")}:${dt.getMinutes().toString().padStart(2,"0")}`;
      for (const item of inv.items) {
        itemRows.push(xmlRow(
          cell(dateStr), cell(inv.facilityName), cell(inv.courtName), cell(inv.customerName),
          cell(inv.staffName), cell(item.name), cell(item.quantity, "Number"),
          cell(Number(item.price), "Number"), cell(Number(item.price) * item.quantity, "Number"),
          cell(inv.invoiceStatus === "CANCELLED" ? "Đã hủy" : "Hợp lệ"),
        ));
      }
    }
    const sheet = `<Worksheet ss:Name="Hóa đơn T${month}-${year}"><Table>
      ${xmlRow(cell("Ngày giờ"), cell("Cơ sở"), cell("Sân"), cell("Khách hàng"), cell("Nhân viên"), cell("Dịch vụ"), cell("SL"), cell("Đơn giá (đ)"), cell("Thành tiền (đ)"), cell("Trạng thái"))}
      ${itemRows.join("\n") || xmlRow(cell("Không có dữ liệu"))}
    </Table></Worksheet>`;
    const xml = `<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">${sheet}</Workbook>`;
    const blob = new Blob([xml], { type: "application/vnd.ms-excel" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `hoa-don-T${month}-${year}.xls`; a.click();
    URL.revokeObjectURL(url);
    setExporting(false);
  }

  return (
    <div>
      <div className={CARD} style={BG}>
        <div className="flex flex-wrap gap-3 items-end">
          <div><p className="text-xs text-gray-500 mb-1">Cơ sở</p>
            <select className={INPUT + " w-52"} value={facilityId} onChange={e => setFacilityId(e.target.value)}>
              <option value="">Tất cả cơ sở</option>
              {facilities.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>
          <div><p className="text-xs text-gray-500 mb-1">Tháng</p>
            <select className={INPUT + " w-28"} value={month} onChange={e => setMonth(Number(e.target.value))}>
              {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>T{i + 1}</option>)}
            </select>
          </div>
          <div><p className="text-xs text-gray-500 mb-1">Năm</p>
            <select className={INPUT + " w-24"} value={year} onChange={e => setYear(Number(e.target.value))}>
              {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <button onClick={load} className={BTN_G}>Xem</button>
          {loaded && (
            <button onClick={exportToExcel} disabled={exporting} className={BTN_W + " flex items-center gap-1.5"}>
              {exporting ? "..." : "⬇ Xuất Excel"}
            </button>
          )}
        </div>
      </div>

      {loaded && (
        <>
          {/* Tổng hợp nhanh */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="border border-emerald-200 bg-emerald-50 rounded-2xl p-4">
              <p className="text-xs text-gray-500 mb-1">Hóa đơn hợp lệ</p>
              <p className="text-lg font-bold text-emerald-600">{totalActive.toLocaleString("vi-VN")}đ</p>
              <p className="text-xs text-gray-400">{activeInvoices.length} hóa đơn</p>
            </div>
            <div className="border border-red-200 bg-red-50 rounded-2xl p-4">
              <p className="text-xs text-gray-500 mb-1">Hóa đơn đã hủy</p>
              <p className="text-lg font-bold text-red-500">{totalCancelled.toLocaleString("vi-VN")}đ</p>
              <p className="text-xs text-gray-400">{cancelledInvoices.length} hóa đơn</p>
            </div>
          </div>

          {/* Filter tabs */}
          <div className="flex gap-2 mb-4">
            {([
              { key: "all",       label: `Tất cả (${invoices.length})` },
              { key: "ACTIVE",    label: `Hợp lệ (${activeInvoices.length})` },
              { key: "CANCELLED", label: `Đã hủy (${cancelledInvoices.length})` },
            ] as const).map(f => (
              <button key={f.key} onClick={() => setStatusFilter(f.key)}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                  statusFilter === f.key
                    ? f.key === "CANCELLED"
                      ? "bg-red-100 text-red-700 border-red-300 font-medium"
                      : "bg-emerald-100 text-emerald-700 border-emerald-300 font-medium"
                    : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
                }`}>
                {f.label}
              </button>
            ))}
          </div>

          {/* Invoice list */}
          <div className="space-y-2 mb-6">
            {(() => {
              const list = statusFilter === "all" ? invoices
                : statusFilter === "CANCELLED" ? cancelledInvoices
                : activeInvoices;
              if (list.length === 0) return <p className="text-center py-10 text-gray-400">Không có hóa đơn</p>;
              return list.map(inv => {
                const isCancelled = inv.invoiceStatus === "CANCELLED";
                return (
                  <div key={inv.id}
                    className={`border rounded-2xl p-5 mb-2 cursor-pointer ${isCancelled ? "border-red-200 bg-red-50/50" : "border-gray-300"}`}
                    style={isCancelled ? {} : BG}
                    onClick={() => setExpanded(expanded === inv.id ? null : inv.id)}>
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className={`font-semibold ${isCancelled ? "text-gray-400 line-through" : "text-black"}`}>
                            #{inv.id} · {inv.courtName}
                          </p>
                          {isCancelled && (
                            <span className="text-xs bg-red-100 text-red-600 border border-red-200 rounded-full px-2 py-0.5 font-medium">Đã hủy</span>
                          )}
                        </div>
                        {facilities.length > 1 && <p className="text-xs text-gray-400">{inv.facilityName}</p>}
                        <p className="text-xs text-gray-500">{inv.customerName} · NV: {inv.staffName}</p>
                        <p className="text-xs text-gray-400">{new Date(inv.createdAt).toLocaleString("vi-VN")}</p>
                      </div>
                      <div className="text-right">
                        <p className={`font-bold ${isCancelled ? "text-red-400 line-through" : "text-emerald-600"}`}>
                          {Number(inv.finalTotal).toLocaleString("vi-VN")}đ
                        </p>
                        <span className="text-xs bg-white border border-gray-200 rounded-full px-2 py-0.5">{PM_LABEL[inv.paymentMethod] || inv.paymentMethod}</span>
                      </div>
                    </div>
                    {expanded === inv.id && (
                      <div className="mt-3 border-t border-gray-200 pt-3">
                        <table className="w-full text-xs">
                          <thead><tr className="text-gray-500"><th className="text-left py-1">Dịch vụ</th><th className="text-right py-1">SL</th><th className="text-right py-1">Giá</th></tr></thead>
                          <tbody>
                            {inv.items.map((it, i) => (
                              <tr key={i} className="border-t border-gray-100">
                                <td className="py-1">{it.name}</td>
                                <td className="py-1 text-right">{it.quantity}</td>
                                <td className="py-1 text-right font-medium">{Number(it.price).toLocaleString("vi-VN")}đ</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {isCancelled && (
                          <p className="text-xs text-red-500 mt-2 flex items-center gap-1">
                            <span>↩</span> Đã hoàn tiền về ví khách hàng
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              });
            })()}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Revenue Tab ─────────────────────────────────────────────────────────────
interface RevData {
  byDay:     { date: string; total: number }[];
  byMonth:   { month: string; total: number }[];
  byCourt:   { name: string; total: number }[];
  byService: { name: string; total: number; quantity: number; cogs: number; profit: number }[];
  slowSelling: { id: number; name: string; stockQuantity: number; soldLast7Days: number }[];
}

function RevLineChart({ data, labelFn }: { data: { label: string; value: number }[]; labelFn?: (v: number) => string }) {
  const [hovered, setHovered] = useState<number | null>(null);

  if (data.length === 0)
    return <div className="h-48 flex items-center justify-center text-gray-400 text-sm">Chưa có dữ liệu</div>;

  const max  = Math.max(...data.map(d => d.value), 1);
  const fmt  = labelFn ?? ((v: number) => v >= 1_000_000 ? (v / 1_000_000).toFixed(1) + "M" : (v / 1_000).toFixed(0) + "K");

  // SVG canvas
  const W = 520; const H = 170;
  const PAD = { top: 22, right: 12, bottom: 30, left: 48 };
  const cW = W - PAD.left - PAD.right;
  const cH = H - PAD.top  - PAD.bottom;
  const n  = data.length;

  const px = (i: number) => PAD.left + (n > 1 ? (i / (n - 1)) * cW : cW / 2);
  const py = (v: number) => PAD.top  + cH - (v / max) * cH;

  const linePath = data.map((d, i) => `${i === 0 ? "M" : "L"}${px(i).toFixed(1)},${py(d.value).toFixed(1)}`).join(" ");
  const areaPath = [
    ...data.map((d, i) => `${i === 0 ? "M" : "L"}${px(i).toFixed(1)},${py(d.value).toFixed(1)}`),
    `L${px(n - 1).toFixed(1)},${(PAD.top + cH).toFixed(1)}`,
    `L${px(0).toFixed(1)},${(PAD.top + cH).toFixed(1)}`,
    "Z",
  ].join(" ");

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(r => ({ v: r * max, y: PAD.top + cH - r * cH }));
  const xStep  = n > 24 ? 5 : n > 16 ? 4 : n > 10 ? 3 : n > 6 ? 2 : 1;

  return (
    <div className="w-full select-none">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 190 }} aria-hidden>
        <defs>
          <linearGradient id="lgRev" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#10b981" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0.01" />
          </linearGradient>
          <clipPath id="cpRev">
            <rect x={PAD.left} y={PAD.top} width={cW} height={cH} />
          </clipPath>
        </defs>

        {/* Y-axis grid + labels */}
        {yTicks.map((tk, i) => (
          <g key={i}>
            <line x1={PAD.left} y1={tk.y} x2={W - PAD.right} y2={tk.y}
              stroke="#e5e7eb" strokeWidth={i === 0 ? 1 : 0.7}
              strokeDasharray={i === 0 ? "" : "4 3"} />
            {i > 0 && (
              <text x={PAD.left - 5} y={tk.y + 3.5} textAnchor="end" fontSize={9} fill="#9ca3af">
                {fmt(tk.v)}
              </text>
            )}
          </g>
        ))}

        {/* Area fill */}
        <path d={areaPath} fill="url(#lgRev)" clipPath="url(#cpRev)" />

        {/* Line */}
        <path d={linePath} fill="none" stroke="#10b981" strokeWidth={2}
          strokeLinejoin="round" strokeLinecap="round" clipPath="url(#cpRev)" />

        {/* Hover vertical guide */}
        {hovered !== null && (
          <line x1={px(hovered)} y1={PAD.top} x2={px(hovered)} y2={PAD.top + cH}
            stroke="#10b981" strokeWidth={1} strokeDasharray="4 3" opacity={0.4} />
        )}

        {/* Dots */}
        {data.map((d, i) => {
          const cx = px(i); const cy = py(d.value);
          const active = hovered === i;
          return (
            <g key={i}>
              {active && <circle cx={cx} cy={cy} r={10} fill="#10b981" opacity={0.1} />}
              <circle cx={cx} cy={cy} r={active ? 5 : 3}
                fill={d.value > 0 ? "#10b981" : "#d1fae5"}
                stroke="white" strokeWidth={1.5}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
                style={{ cursor: "crosshair" }}
              />
              {/* Tooltip */}
              {active && d.value > 0 && (() => {
                const ttW = 64; const ttH = 20;
                const ttX = Math.min(Math.max(cx - ttW / 2, PAD.left), W - PAD.right - ttW);
                const ttY = cy - ttH - 8;
                return (
                  <g>
                    <rect x={ttX} y={ttY} width={ttW} height={ttH} rx={5} fill="#064e3b" opacity={0.92} />
                    <text x={ttX + ttW / 2} y={ttY + 13} textAnchor="middle" fontSize={9.5} fill="white" fontWeight="bold">
                      {fmt(d.value)}
                    </text>
                  </g>
                );
              })()}
            </g>
          );
        })}

        {/* X-axis labels */}
        {data.map((d, i) =>
          i % xStep === 0 ? (
            <text key={i} x={px(i)} y={H - 5} textAnchor="middle" fontSize={9} fill="#9ca3af">
              {d.label}
            </text>
          ) : null
        )}
      </svg>
    </div>
  );
}

function HBarList({ data, total }: { data: { name: string; total: number }[]; total: number }) {
  if (data.length === 0) return <p className="text-center py-6 text-gray-400 text-sm">Chưa có dữ liệu</p>;
  return (
    <div className="space-y-2">
      {data.map((d, i) => {
        const pct = total > 0 ? (d.total / total) * 100 : 0;
        return (
          <div key={i}>
            <div className="flex justify-between text-xs mb-0.5">
              <span className="text-gray-700 font-medium truncate max-w-[60%]">{d.name}</span>
              <span className="text-emerald-600 font-semibold">{Number(d.total).toLocaleString("vi-VN")}đ</span>
            </div>
            <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
              <div className="h-full rounded-full bg-emerald-400" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RevenueTab({ facilities }: { facilities: Facility[] }) {
  const [facilityId, setFacilityId] = useState("");
  const now = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [timeMode,  setTimeMode]  = useState<"day" | "month">("day");
  const [groupMode, setGroupMode] = useState<"court" | "service">("court");
  const [data, setData] = useState<RevData | null>(null);
  const [loading, setLoading] = useState(false);
  const [occupancy, setOccupancy] = useState<any>(null);
  const [monthlyStats, setMonthlyStats] = useState<any[]>([]);
  const [chartView, setChartView] = useState<"day" | "hour" | "court" | "sport" | "month">("day");

  async function load(fid: string) {
    if (!fid) return;
    setLoading(true);
    const [revRes, occRes, mRes] = await Promise.all([
      fetch(`/api/owner/revenue?facilityId=${fid}&year=${year}&month=${month}`),
      fetch(`/api/owner/occupancy?facilityId=${fid}&month=${month}&year=${year}`),
      fetch(`/api/owner/occupancy?facilityId=${fid}&year=${year}&period=year`),
    ]);
    if (revRes.ok) setData(await revRes.json());
    const occData = await occRes.json();
    const mData = await mRes.json();
    setOccupancy(occData.dailyStats ? occData : null);
    setMonthlyStats(mData.monthlyStats || []);
    setLoading(false);
  }

  const CHART_VIEWS = [
    { key: "day",   label: "Ngày" },
    { key: "hour",  label: "Giờ" },
    { key: "court", label: "Sân" },
    { key: "sport", label: "Môn" },
    { key: "month", label: "Tháng" },
  ] as const;

  function getChartItems() {
    if (!occupancy && chartView !== "month") return [];
    switch (chartView) {
      case "day":   return (occupancy?.dailyStats || []).map((d: any) => ({ label: `${d.day}`, value: d.count }));
      case "hour":  return (occupancy?.hourlyStats || []).map((h: any) => ({ label: h.hour.replace(":00", "h"), value: h.count, highlight: parseInt(h.hour) >= 7 && parseInt(h.hour) < 9 }));
      case "court": return (occupancy?.courtStats || []).map((c: any) => ({ label: c.courtName, value: c.count }));
      case "sport": return (occupancy?.sportStats || []).map((s: any) => ({ label: s.name, value: s.count }));
      case "month": return monthlyStats.map((m: any) => ({ label: `T${m.month}`, value: m.count }));
    }
  }

  function getUserHabitsInsights() {
    if (!occupancy) return null;
    const hourly = (occupancy.hourlyStats || []) as any[];
    const courts = (occupancy.courtStats || []) as any[];
    const sports = (occupancy.sportStats || []) as any[];
    const peakHour = hourly.reduce((b: any, h: any) => (!b || h.count > b.count) ? h : b, null);
    const slowHour = hourly.filter((h: any) => h.count > 0).reduce((b: any, h: any) => (!b || h.count < b.count) ? h : b, null);
    const topCourt = courts.reduce((b: any, c: any) => (!b || c.count > b.count) ? c : b, null);
    const topSport = sports.reduce((b: any, s: any) => (!b || s.count > b.count) ? s : b, null);
    const lowCourt = courts.reduce((b: any, c: any) => (!b || c.count < b.count) ? c : b, null);
    return { peakHour, slowHour, topCourt, topSport, lowCourt };
  }

  useEffect(() => { if (facilityId) load(facilityId); }, [facilityId, year, month]);

  const dayChartData = data?.byDay.map(d => ({
    label: String(Number(d.date.split("-")[2])),
    value: d.total,
  })) ?? [];

  const monthChartData = data?.byMonth.map(d => ({
    label: `T${Number(d.month.split("-")[1])}`,
    value: d.total,
  })) ?? [];

  const totalMonth  = data?.byDay.reduce((s, d) => s + d.total, 0) ?? 0;
  const totalYear   = data?.byMonth.reduce((s, d) => s + d.total, 0) ?? 0;
  const totalCourt  = data?.byCourt.reduce((s, d) => s + d.total, 0) ?? 0;
  const totalSvc    = data?.byService.reduce((s, d) => s + d.total, 0) ?? 0;

  const MONTHS = ["1","2","3","4","5","6","7","8","9","10","11","12"];
  const YEARS  = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];

  return (
    <div>
      {/* Bộ lọc */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <select className={INPUT + " w-52"} value={facilityId}
          onChange={e => { setFacilityId(e.target.value); }}>
          <option value="">-- Chọn cơ sở --</option>
          {facilities.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
        <select className={INPUT + " w-24"} value={month} onChange={e => setMonth(Number(e.target.value))}>
          {MONTHS.map(m => <option key={m} value={m}>Tháng {m}</option>)}
        </select>
        <select className={INPUT + " w-24"} value={year} onChange={e => setYear(Number(e.target.value))}>
          {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {!facilityId && (
        <p className="text-center py-12 text-gray-400 text-sm">Chọn cơ sở để xem doanh thu</p>
      )}

      {facilityId && loading && (
        <p className="text-center py-12 text-gray-400 text-sm">Đang tải...</p>
      )}

      {facilityId && !loading && data && (
        <div className="space-y-4">
          {/* Tổng quan */}
          <div className="grid grid-cols-2 gap-3">
            <div className={CARD + " !mb-0 text-center"} style={BG}>
              <p className="text-xs text-gray-500">Tháng {month}/{year}</p>
              <p className="text-xl font-bold text-emerald-600 mt-1">{totalMonth.toLocaleString("vi-VN")}đ</p>
            </div>
            <div className={CARD + " !mb-0 text-center"} style={BG}>
              <p className="text-xs text-gray-500">Cả năm {year}</p>
              <p className="text-xl font-bold text-emerald-600 mt-1">{totalYear.toLocaleString("vi-VN")}đ</p>
            </div>
          </div>

          {/* Biểu đồ theo thời gian */}
          <div className={CARD + " !mb-0"} style={BG}>
            <div className="flex items-center justify-between mb-3">
              <p className="font-semibold text-black text-sm">
                {timeMode === "day" ? `Theo ngày — Tháng ${month}/${year}` : `Theo tháng — Năm ${year}`}
              </p>
              <div className="flex gap-1">
                <button onClick={() => setTimeMode("day")}
                  className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${timeMode === "day" ? "bg-emerald-500 text-white" : "bg-white border border-gray-300 text-gray-600"}`}>
                  Theo ngày
                </button>
                <button onClick={() => setTimeMode("month")}
                  className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${timeMode === "month" ? "bg-emerald-500 text-white" : "bg-white border border-gray-300 text-gray-600"}`}>
                  Theo tháng
                </button>
              </div>
            </div>
            <RevLineChart data={timeMode === "day" ? dayChartData : monthChartData} />
          </div>

          {/* Phân tích theo sân / dịch vụ */}
          <div className={CARD + " !mb-0"} style={BG}>
            <div className="flex items-center justify-between mb-3">
              <p className="font-semibold text-black text-sm">
                {groupMode === "court" ? "Doanh thu theo sân" : "Doanh thu theo dịch vụ"}
              </p>
              <div className="flex gap-1">
                <button onClick={() => setGroupMode("court")}
                  className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${groupMode === "court" ? "bg-emerald-500 text-white" : "bg-white border border-gray-300 text-gray-600"}`}>
                  Theo sân
                </button>
                <button onClick={() => setGroupMode("service")}
                  className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${groupMode === "service" ? "bg-emerald-500 text-white" : "bg-white border border-gray-300 text-gray-600"}`}>
                  Theo dịch vụ
                </button>
              </div>
            </div>
            {groupMode === "court"
              ? <HBarList data={data.byCourt} total={totalCourt} />
              : (
                <div className="space-y-2">
                  {data.byService.length === 0
                    ? <p className="text-center py-6 text-gray-400 text-sm">Chưa có dữ liệu</p>
                    : data.byService.map((d, i) => {
                        const pct = totalSvc > 0 ? (d.total / totalSvc) * 100 : 0;
                        return (
                          <div key={i}>
                            <div className="flex justify-between text-xs mb-0.5">
                              <span className="text-gray-700 font-medium truncate max-w-[45%]">{d.name}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-gray-400">x{d.quantity}</span>
                                <span className="text-emerald-600 font-semibold">{Number(d.total).toLocaleString("vi-VN")}đ</span>
                                {d.cogs > 0 && (
                                  <span className={`font-semibold ${d.profit >= 0 ? "text-emerald-700" : "text-red-500"}`}>
                                    (Lãi: {d.profit >= 0 ? "+" : ""}{Number(d.profit).toLocaleString("vi-VN")}đ)
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
                              <div className="h-full rounded-full bg-emerald-400" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })
                  }
                </div>
              )
            }
          </div>

          {/* Tỉ lệ lấp đầy */}
          {occupancy && (
            <div className={CARD + " !mb-0"} style={BG}>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <h3 className="font-semibold text-black">Tỉ lệ lấp đầy</h3>
                <div className="flex gap-1 flex-wrap">
                  {CHART_VIEWS.map(v => (
                    <button key={v.key} onClick={() => setChartView(v.key)}
                      className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors border ${chartView === v.key ? "bg-emerald-500 text-white border-emerald-500" : "bg-white text-gray-600 border-gray-300 hover:border-emerald-300"}`}>
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>
              {occupancy && chartView !== "month" && (
                <div className="flex gap-3 mb-4 flex-wrap">
                  <div className="bg-white rounded-xl px-4 py-2 border border-gray-200 text-center">
                    <p className="text-xs text-gray-500">Tổng lượt đặt</p>
                    <p className="font-bold text-emerald-600 text-lg">{(occupancy.dailyStats || []).reduce((s: number, d: any) => s + d.count, 0)}</p>
                  </div>
                  <div className="bg-white rounded-xl px-4 py-2 border border-gray-200 text-center">
                    <p className="text-xs text-gray-500">Ngày cao nhất</p>
                    <p className="font-bold text-blue-600 text-lg">{Math.max(...(occupancy.dailyStats || [{ count: 0 }]).map((d: any) => d.count))} lượt</p>
                  </div>
                  <div className="bg-white rounded-xl px-4 py-2 border border-gray-200 text-center">
                    <p className="text-xs text-gray-500">Lấp đầy TB/ngày</p>
                    <p className="font-bold text-orange-600 text-lg">
                      {(() => { const days = occupancy.dailyStats || []; return days.length ? Math.round(days.reduce((s: number, d: any) => s + d.rate, 0) / days.length) + "%" : "0%"; })()}
                    </p>
                  </div>
                </div>
              )}
              <BarChart items={getChartItems()} labelKey="label" valueKey="value" color="#10b981" />
              {chartView === "hour" && <p className="text-xs text-gray-400 mt-2">Màu vàng = khung giờ cao điểm (7h–9h)</p>}
              {chartView === "month" && <p className="text-xs text-gray-400 mt-2">Tổng lượt đặt theo từng tháng — năm {year}</p>}
            </div>
          )}

          {/* Thói quen người dùng & Gợi ý kinh doanh */}
          {(() => {
            const h = getUserHabitsInsights();
            if (!h) return null;
            const insights: { icon: string; text: string; tip: string; color: string }[] = [];
            if (h.peakHour) insights.push({ icon: "🔥", text: `Khung giờ đông nhất: ${h.peakHour.hour}`, tip: "Tăng giá khung giờ cao điểm hoặc chạy ưu đãi combo để tối ưu doanh thu", color: "border-orange-200 bg-orange-50" });
            if (h.slowHour && h.slowHour.hour !== h.peakHour?.hour) insights.push({ icon: "📉", text: `Khung giờ vắng nhất: ${h.slowHour.hour}`, tip: "Tung voucher giảm giá cho khung giờ thấp điểm để tăng tỉ lệ lấp đầy", color: "border-blue-200 bg-blue-50" });
            if (h.topSport) insights.push({ icon: "🏆", text: `Môn thể thao phổ biến nhất: ${h.topSport.name}`, tip: "Nhập thêm thiết bị/phụ kiện cho môn này, tạo giải đấu để thu hút thêm khách", color: "border-emerald-200 bg-emerald-50" });
            if (h.topCourt) insights.push({ icon: "🎯", text: `Sân được đặt nhiều nhất: ${h.topCourt.courtName}`, tip: "Bảo trì định kỳ và nâng cấp dịch vụ tại sân này để duy trì chất lượng", color: "border-purple-200 bg-purple-50" });
            if (h.lowCourt && h.lowCourt.courtName !== h.topCourt?.courtName) insights.push({ icon: "💡", text: `Sân ít được đặt nhất: ${h.lowCourt.courtName}`, tip: "Tạo ưu đãi đặc biệt hoặc gói combo cho sân này để cân bằng tỉ lệ sử dụng", color: "border-yellow-200 bg-yellow-50" });
            if (insights.length === 0) return null;
            return (
              <div className={CARD + " !mb-0"} style={BG}>
                <h3 className="font-semibold text-black mb-3">Thói quen người dùng &amp; Gợi ý kinh doanh</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {insights.map((ins, i) => (
                    <div key={i} className={`rounded-xl border p-3.5 ${ins.color}`}>
                      <p className="font-semibold text-sm text-gray-800">{ins.icon} {ins.text}</p>
                      <p className="text-xs text-gray-500 mt-1">💬 {ins.tip}</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Cảnh báo hàng bán chậm */}
          {data.slowSelling.length > 0 && (
            <div className="border border-amber-300 bg-amber-50 rounded-2xl p-4">
              <p className="font-semibold text-amber-700 text-sm mb-2">
                Cảnh báo tồn kho — Hàng bán chậm (tháng {month}/{year})
              </p>
              <p className="text-xs text-amber-600 mb-3">
                Các mặt hàng bán chưa đạt ngưỡng trong tháng {month}/{year} — cân nhắc giảm nhập hoặc chạy khuyến mãi.
              </p>
              <div className="space-y-2">
                {data.slowSelling.map(item => {
                  const isOwnerSet = (item as any).monthlyThreshold > 0;
                  const displayThreshold = (item as any).threshold as number
                    ?? (isOwnerSet ? (item as any).monthlyThreshold : Math.max(Math.round(item.stockQuantity * 0.05), 3));
                  const ratio = item.stockQuantity > 0
                    ? Math.round((item.soldLast7Days / item.stockQuantity) * 100)
                    : 0;
                  return (
                    <div key={item.id} className="flex items-center justify-between bg-white/70 rounded-xl px-3 py-2">
                      <div>
                        <span className="text-sm font-medium text-gray-800">{item.name}</span>
                        <p className="text-xs text-gray-400 mt-0.5">
                          Tồn kho: {item.stockQuantity} · Ngưỡng:{" "}
                          <span className={isOwnerSet ? "text-emerald-600 font-medium" : ""}>{displayThreshold} sp/tháng{isOwnerSet ? " (bạn đặt)" : " (tự động)"}</span>
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-amber-600 font-semibold">
                          Đã bán: <span className="font-bold">{item.soldLast7Days}</span> / {displayThreshold} sp
                        </p>
                        <p className="text-xs text-gray-400">Tiêu thụ: {ratio}% tồn kho</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {data.slowSelling.length === 0 && (
            <div className="border border-emerald-200 bg-emerald-50 rounded-2xl px-4 py-3 text-xs text-emerald-700">
              Tất cả hàng hóa đang bán tốt trong tháng {month}/{year}.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Services Tab ────────────────────────────────────────────────────────────

/** Resize ảnh về tối đa maxDim px rồi convert sang WebP trước khi upload */
async function resizeImage(file: File, maxDim = 400): Promise<Blob> {
  return new Promise(resolve => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
      canvas.toBlob(blob => resolve(blob!), "image/webp", 0.85);
    };
    img.src = objectUrl;
  });
}

// ─── Wallet Tab ──────────────────────────────────────────────────────────────
// Danh sách ngân hàng Việt Nam phổ biến với BIN code
const VN_BANKS = [
  { bin: "970436", name: "Vietcombank (VCB)" },
  { bin: "970422", name: "MB Bank" },
  { bin: "970407", name: "Techcombank (TCB)" },
  { bin: "970418", name: "BIDV" },
  { bin: "970405", name: "Agribank" },
  { bin: "970416", name: "ACB" },
  { bin: "970432", name: "VPBank" },
  { bin: "970423", name: "TPBank" },
  { bin: "970403", name: "Sacombank" },
  { bin: "970415", name: "VietinBank" },
  { bin: "970426", name: "MSB" },
  { bin: "970431", name: "Eximbank" },
  { bin: "970454", name: "Woori Bank" },
  { bin: "970448", name: "OCB" },
  { bin: "970400", name: "Saigonbank" },
];

function WalletTab({ facilities }: { facilities: Facility[] }) {
  const now = new Date();
  const [facilityId, setFacilityId] = useState<string>("");
  const [month, setMonth] = useState(0); // 0 = tất cả
  const [year, setYear] = useState(now.getFullYear());
  const [cashflow, setCashflow] = useState<{ balance: number; walletBalance: number; totalIn: number; totalOut: number; totalRefund: number; transactions: any[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [txFilter, setTxFilter] = useState<"all" | "income" | "refund" | "withdraw">("all");
  const [quickAction, setQuickAction] = useState<"deposit" | "withdraw" | null>(null);
  const [qaAmount, setQaAmount] = useState("");
  const [qaDesc, setQaDesc] = useState("");
  const [qaLoading, setQaLoading] = useState(false);
  const [pendingBookings, setPendingBookings] = useState<any[]>([]);
  const [confirming, setConfirming] = useState<number | null>(null);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [showBankForm, setShowBankForm] = useState(false);
  const [bankForm, setBankForm] = useState({ bankBin: "", accountNumber: "", accountName: "", isDefault: true });
  const [savingBank, setSavingBank] = useState(false);

  const TX_LABEL: Record<string, string> = { DEPOSIT: "Tiền vào", REFUND: "Hoàn tiền", WITHDRAW: "Tiền ra", PAYMENT: "Thanh toán" };
  const TX_COLOR: Record<string, string> = { DEPOSIT: "text-emerald-600", REFUND: "text-blue-500", WITHDRAW: "text-orange-500", PAYMENT: "text-red-500" };
  const TX_BG:    Record<string, string> = { DEPOSIT: "bg-emerald-50 border-emerald-200", REFUND: "bg-blue-50 border-blue-200", WITHDRAW: "bg-orange-50 border-orange-200" };

  async function loadCashflow() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (month > 0) { params.set("month", String(month)); params.set("year", String(year)); }
      if (facilityId) params.set("facilityId", facilityId);
      const res = await fetch(`/api/owner/cashflow?${params}`);
      if (!res.ok) { setCashflow(null); return; }
      const data = await res.json();
      setCashflow(data);
    } catch { setCashflow(null); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    loadCashflow();
    fetch("/api/owner/guest-bookings").then(r => r.json()).then(d => setPendingBookings(Array.isArray(d) ? d : []));
    fetch("/api/owner/bank-accounts").then(r => r.json()).then(d => setBankAccounts(Array.isArray(d) ? d : []));
  }, []);

  async function confirmBooking(id: number) {
    setConfirming(id);
    await fetch("/api/owner/guest-bookings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bookingId: id, action: "confirm" }) });
    setConfirming(null);
    fetch("/api/owner/guest-bookings").then(r => r.json()).then(d => setPendingBookings(Array.isArray(d) ? d : []));
    loadCashflow();
  }
  async function cancelBooking(id: number) {
    setConfirming(id);
    await fetch("/api/owner/guest-bookings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bookingId: id, action: "cancel" }) });
    setConfirming(null);
    fetch("/api/owner/guest-bookings").then(r => r.json()).then(d => setPendingBookings(Array.isArray(d) ? d : []));
  }
  async function saveBankAccount(e: React.FormEvent) {
    e.preventDefault();
    if (!bankForm.bankBin || !bankForm.accountNumber || !bankForm.accountName) { alert("Vui lòng điền đầy đủ"); return; }
    setSavingBank(true);
    const bank = VN_BANKS.find(b => b.bin === bankForm.bankBin);
    const res = await fetch("/api/owner/bank-accounts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bankBin: bankForm.bankBin, bankLabel: bank?.name || bankForm.bankBin, accountNumber: bankForm.accountNumber, accountName: bankForm.accountName, isDefault: bankForm.isDefault }) });
    setSavingBank(false);
    if (res.ok) { setShowBankForm(false); setBankForm({ bankBin: "", accountNumber: "", accountName: "", isDefault: true }); fetch("/api/owner/bank-accounts").then(r => r.json()).then(d => setBankAccounts(Array.isArray(d) ? d : [])); }
  }
  async function deleteBankAccount(id: number) {
    await fetch("/api/owner/bank-accounts", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    fetch("/api/owner/bank-accounts").then(r => r.json()).then(d => setBankAccounts(Array.isArray(d) ? d : []));
  }
  async function submitQuickAction(e: React.FormEvent) {
    e.preventDefault();
    const amt = Number(qaAmount);
    if (!qaAmount || amt <= 0) { alert("Vui lòng nhập số tiền hợp lệ"); return; }
    setQaLoading(true);
    const type = quickAction === "deposit" ? "DEPOSIT" : "WITHDRAW";
    const defaultDesc = quickAction === "deposit" ? "Nạp tiền vào ví kinh doanh" : "Rút tiền từ ví kinh doanh";
    const res = await fetch("/api/owner/business-wallet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: amt * 1000, description: qaDesc || defaultDesc, type }),
    });
    setQaLoading(false);
    if (res.ok) {
      setQuickAction(null); setQaAmount(""); setQaDesc("");
      loadCashflow();
    } else {
      const d = await res.json(); alert(d.error || "Lỗi giao dịch");
    }
  }

  const txList = cashflow?.transactions ?? [];
  const filtered = txList.filter((t: any) => {
    if (txFilter === "income")   return t.type === "DEPOSIT";
    if (txFilter === "refund")   return t.type === "REFUND";
    if (txFilter === "withdraw") return t.type === "WITHDRAW";
    return true;
  });

  return (
    <div className="space-y-4">

      {/* Card số dư + Nạp/Rút */}
      <div className="border-2 border-emerald-300 bg-gradient-to-r from-emerald-50 to-white rounded-2xl p-5">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-xs text-gray-500 mb-1">Số thực nhận {cashflow && (month > 0 || facilityId) ? <span className="text-emerald-600">(đang lọc)</span> : "(toàn bộ)"}</p>
            <p className="text-3xl font-bold text-emerald-600">
              {cashflow ? cashflow.balance.toLocaleString("vi-VN") : "—"}đ
            </p>
            {cashflow && cashflow.walletBalance !== cashflow.balance && (
              <p className="text-xs text-gray-400 mt-1">
                Số dư tích lũy ví: <span className="font-semibold text-gray-600">{cashflow.walletBalance.toLocaleString("vi-VN")}đ</span>
              </p>
            )}
            {cashflow && cashflow.walletBalance === cashflow.balance && (
              <p className="text-xs text-gray-400 mt-1">= Tổng thu − Chi − Hoàn tiền</p>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => { setQuickAction("deposit"); setQaAmount(""); setQaDesc(""); }}
              className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-sm">
              + Nạp tiền
            </button>
            <button
              onClick={() => { setQuickAction("withdraw"); setQaAmount(""); setQaDesc(""); }}
              className="flex items-center gap-2 bg-orange-500 hover:bg-orange-400 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-sm">
              − Rút tiền
            </button>
          </div>
        </div>
      </div>

      {/* Modal Nạp / Rút */}
      {quickAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setQuickAction(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6" onClick={e => e.stopPropagation()}>
            <h3 className={`font-bold text-lg mb-4 ${quickAction === "deposit" ? "text-emerald-600" : "text-orange-500"}`}>
              {quickAction === "deposit" ? "Nạp tiền vào ví" : "Rút tiền khỏi ví"}
            </h3>
            <form onSubmit={submitQuickAction} className="space-y-4">
              <div>
                <label className="text-sm text-gray-600 font-medium block mb-1.5">Số tiền (nghìn đồng)</label>
                <div className="relative">
                  <input
                    type="number" min="1" required autoFocus
                    className={INPUT + " pr-10 text-base font-semibold"}
                    placeholder="Ví dụ: 500 = 500,000đ"
                    value={qaAmount}
                    onChange={e => setQaAmount(e.target.value)}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">nghìn đ</span>
                </div>
                {qaAmount && Number(qaAmount) > 0 && (
                  <p className="text-xs text-emerald-600 mt-1">= {(Number(qaAmount) * 1000).toLocaleString("vi-VN")}đ</p>
                )}
              </div>
              <div>
                <label className="text-sm text-gray-600 font-medium block mb-1.5">Ghi chú (tuỳ chọn)</label>
                <input
                  className={INPUT}
                  placeholder={quickAction === "deposit" ? "VD: Nạp tiền thu từ khách tháng 5" : "VD: Rút tiền trả lương nhân viên"}
                  value={qaDesc}
                  onChange={e => setQaDesc(e.target.value)}
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setQuickAction(null)} className={BTN_W + " flex-1"}>Hủy</button>
                <button type="submit" disabled={qaLoading}
                  className={`flex-1 text-white py-2 rounded-xl text-sm font-semibold transition-colors ${
                    quickAction === "deposit"
                      ? "bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-300"
                      : "bg-orange-500 hover:bg-orange-400 disabled:bg-orange-300"
                  }`}>
                  {qaLoading ? "Đang xử lý..." : quickAction === "deposit" ? "Xác nhận nạp" : "Xác nhận rút"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bộ lọc */}
      <div className={CARD} style={BG}>
        <div className="flex flex-wrap gap-3 items-end">
          <div><p className="text-xs text-gray-500 mb-1">Cơ sở</p>
            <select className={INPUT + " w-52"} value={facilityId} onChange={e => setFacilityId(e.target.value)}>
              <option value="">Tất cả cơ sở</option>
              {facilities.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>
          <div><p className="text-xs text-gray-500 mb-1">Tháng</p>
            <select className={INPUT + " w-32"} value={month} onChange={e => setMonth(Number(e.target.value))}>
              <option value={0}>Tất cả</option>
              {Array.from({ length: 12 }, (_, i) => <option key={i+1} value={i+1}>Tháng {i+1}</option>)}
            </select>
          </div>
          {month > 0 && (
            <div><p className="text-xs text-gray-500 mb-1">Năm</p>
              <select className={INPUT + " w-24"} value={year} onChange={e => setYear(Number(e.target.value))}>
                {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          )}
          <button onClick={loadCashflow} disabled={loading} className={BTN_G}>{loading ? "Đang tải..." : "Xem"}</button>
        </div>
      </div>

      {/* Tổng quan dòng tiền */}
      {cashflow && (
        <div className="grid grid-cols-3 gap-3">
          <div className="border border-emerald-200 bg-emerald-50 rounded-2xl p-4">
            <p className="text-xs text-gray-500 mb-1">Tiền vào</p>
            <p className="text-lg font-bold text-emerald-600">+{cashflow.totalIn.toLocaleString("vi-VN")}đ</p>
            <p className="text-xs text-gray-400">{txList.filter((t:any)=>t.type==="DEPOSIT").length} giao dịch</p>
          </div>
          <div className="border border-orange-200 bg-orange-50 rounded-2xl p-4">
            <p className="text-xs text-gray-500 mb-1">Tiền ra</p>
            <p className="text-lg font-bold text-orange-500">-{cashflow.totalOut.toLocaleString("vi-VN")}đ</p>
            <p className="text-xs text-gray-400">{txList.filter((t:any)=>t.type==="WITHDRAW").length} giao dịch</p>
          </div>
          <div className="border border-blue-200 bg-blue-50 rounded-2xl p-4">
            <p className="text-xs text-gray-500 mb-1">Hoàn tiền</p>
            <p className="text-lg font-bold text-blue-500">-{cashflow.totalRefund.toLocaleString("vi-VN")}đ</p>
            <p className="text-xs text-gray-400">{txList.filter((t:any)=>t.type==="REFUND").length} giao dịch</p>
          </div>
        </div>
      )}

      {/* Lịch sử giao dịch */}
      <div className={CARD} style={BG}>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="font-semibold text-black">Lịch sử giao dịch - Ví Kinh Doanh</h3>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {([
            { key: "all",      label: `Tất cả (${txList.length})` },
            { key: "income",   label: `Tiền vào (${txList.filter((t:any)=>t.type==="DEPOSIT").length})` },
            { key: "refund",   label: `Hoàn tiền (${txList.filter((t:any)=>t.type==="REFUND").length})` },
            { key: "withdraw", label: `Tiền ra (${txList.filter((t:any)=>t.type==="WITHDRAW").length})` },
          ] as const).map(f => (
            <button key={f.key} onClick={() => setTxFilter(f.key)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                txFilter === f.key
                  ? f.key === "refund"   ? "bg-blue-100 text-blue-700 border-blue-300 font-medium"
                  : f.key === "withdraw" ? "bg-orange-100 text-orange-700 border-orange-300 font-medium"
                  : "bg-emerald-100 text-emerald-700 border-emerald-300 font-medium"
                  : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
              }`}>
              {f.label}
            </button>
          ))}
        </div>

{loading ? <p className="text-gray-400 text-sm text-center py-6">Đang tải...</p>
        : filtered.length === 0 ? <p className="text-gray-400 text-sm text-center py-6">Không có giao dịch nào</p>
        : (
          <div className="space-y-2">
            {filtered.map((tx: any) => (
              <div key={tx.id} className={`flex items-center justify-between border rounded-xl px-4 py-2.5 ${TX_BG[tx.type] || "bg-white border-gray-200"}`}>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-black">{TX_LABEL[tx.type] || tx.type}</p>
                    {tx.facilityName && <span className="text-xs bg-white/70 text-gray-500 border border-gray-200 px-2 py-0.5 rounded-full">{tx.facilityName}</span>}
                  </div>
                  {tx.description && <p className="text-xs text-gray-500 mt-0.5">{tx.description}</p>}
                  <p className="text-xs text-gray-400">{new Date(tx.createdAt).toLocaleString("vi-VN")}</p>
                </div>
                <span className={`font-bold text-sm ${TX_COLOR[tx.type] || "text-gray-700"}`}>
                  {tx.type === "WITHDRAW" || tx.type === "REFUND" ? "-" : "+"}{Number(tx.amount).toLocaleString("vi-VN")}đ
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Đơn đặt khách vãng lai chờ xác nhận / đã xác nhận */}
      {pendingBookings.length > 0 && (
        <div className="border border-yellow-300 rounded-2xl overflow-hidden">
          <div className="bg-yellow-50 px-5 py-3 flex items-center gap-2 flex-wrap gap-y-1">
            <span className="text-yellow-600">⏳</span>
            <span className="font-semibold text-yellow-800 text-sm">
              {pendingBookings.filter((b:any) => b.status === "PENDING").length} chờ xác nhận
              {pendingBookings.filter((b:any) => b.status === "CONFIRMED").length > 0 &&
                ` · ${pendingBookings.filter((b:any) => b.status === "CONFIRMED").length} đã xác nhận`}
            </span>
            <span className="ml-auto text-xs text-yellow-600">Xác nhận → tự động cộng vào ví · Huỷ sau xác nhận → tự động trừ HOÀN TIỀN</span>
          </div>
          <div className="bg-white divide-y divide-gray-100">
            {pendingBookings.map((b: any) => {
              const isConfirmed = b.status === "CONFIRMED";
              return (
                <div key={b.id} className={`px-5 py-3 flex items-center justify-between gap-3 flex-wrap ${isConfirmed ? "bg-emerald-50" : ""}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-semibold text-black">#{b.id} · {b.guestName} · {b.guestPhone}</p>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${isConfirmed ? "bg-emerald-100 text-emerald-700" : "bg-yellow-100 text-yellow-700"}`}>
                        {isConfirmed ? "Đã xác nhận" : "Chờ xác nhận"}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">{b.court.facility} · {b.court.name}</p>
                    <p className="text-xs text-gray-500">{new Date(b.bookingDate).toLocaleDateString("vi-VN")} · {new Date(b.startTime).toISOString().substring(11,16)} – {new Date(b.endTime).toISOString().substring(11,16)}</p>
                    <p className="text-sm font-bold text-emerald-600">{Number(b.totalPrice).toLocaleString("vi-VN")}đ</p>
                    {isConfirmed && (
                      <p className="text-xs text-orange-500 mt-0.5">Huỷ đơn này sẽ tự động trừ hoàn tiền khỏi ví kinh doanh</p>
                    )}
                    {!isConfirmed && (
                      <p className="text-xs text-gray-400 mt-0.5">Nếu khách đã chuyển khoản, hãy xác nhận trước rồi mới huỷ để ghi nhận hoàn tiền</p>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {!isConfirmed && (
                      <button disabled={confirming === b.id} onClick={() => confirmBooking(b.id)}
                        className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors">
                        {confirming === b.id ? "..." : "Xác nhận + Cộng ví"}
                      </button>
                    )}
                    <button disabled={confirming === b.id} onClick={() => cancelBooking(b.id)}
                      className="bg-red-100 hover:bg-red-200 disabled:opacity-50 text-red-600 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors">
                      {isConfirmed ? "Huỷ + Hoàn tiền" : "Từ chối"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tài khoản ngân hàng — VietQR */}
      <div className={CARD} style={BG}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-semibold text-black">Tài khoản ngân hàng (VietQR)</h3>
            <p className="text-xs text-gray-500 mt-0.5">Khách đặt sân nhận mã QR tự động điền đúng số tiền & mã đặt</p>
          </div>
          <button onClick={() => setShowBankForm(v => !v)} className={BTN_W + " text-xs"}>{showBankForm ? "Hủy" : "+ Thêm tài khoản"}</button>
        </div>
        {showBankForm && (
          <form onSubmit={saveBankAccount} className="bg-white border border-gray-200 rounded-xl p-4 mb-4 space-y-3">
            <div>
              <label className="text-xs text-gray-600 font-medium block mb-1">Ngân hàng</label>
              <select className={INPUT + " text-sm"} value={bankForm.bankBin} onChange={e => setBankForm(f => ({ ...f, bankBin: e.target.value }))} required>
                <option value="">-- Chọn ngân hàng --</option>
                {VN_BANKS.map(b => <option key={b.bin} value={b.bin}>{b.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-600 font-medium block mb-1">Số tài khoản</label>
                <input className={INPUT + " text-sm"} placeholder="0123456789" value={bankForm.accountNumber} onChange={e => setBankForm(f => ({ ...f, accountNumber: e.target.value }))} required />
              </div>
              <div>
                <label className="text-xs text-gray-600 font-medium block mb-1">Tên chủ tài khoản</label>
                <input className={INPUT + " text-sm"} placeholder="NGUYEN VAN A" value={bankForm.accountName} onChange={e => setBankForm(f => ({ ...f, accountName: e.target.value.toUpperCase() }))} required />
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input type="checkbox" checked={bankForm.isDefault} onChange={e => setBankForm(f => ({ ...f, isDefault: e.target.checked }))} />
              Đặt làm tài khoản mặc định (dùng cho VietQR)
            </label>
            <button type="submit" disabled={savingBank} className={BTN_G + " text-xs py-1.5"}>{savingBank ? "Đang lưu..." : "Lưu tài khoản"}</button>
          </form>
        )}
        {bankAccounts.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-3">Chưa có tài khoản ngân hàng.</p>
        ) : (
          <div className="space-y-2">
            {bankAccounts.map((acc: any) => {
              const parts = (acc.bankName || "").split("|");
              const bin = parts[0]; const label = parts[1] || bin;
              return (
                <div key={acc.id} className="bg-white border border-gray-200 rounded-xl p-3 flex items-center gap-3">
                  <img src={`https://img.vietqr.io/image/${bin}-${acc.accountNumber}-compact2.png`} alt="QR" className="w-16 h-16 object-contain rounded-lg border border-gray-100 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-black">{label}</p>
                    <p className="text-xs text-gray-600">{acc.accountNumber} · {acc.accountName}</p>
                    {acc.isDefault && <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">Mặc định</span>}
                  </div>
                  <button onClick={() => deleteBankAccount(acc.id)} className="text-gray-400 hover:text-red-500 text-xs transition-colors shrink-0">Xóa</button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function ImageUpload({
  value, onChange, uploading, setUploading,
}: {
  value: string; onChange: (url: string) => void;
  uploading: boolean; setUploading: (v: boolean) => void;
}) {
  const [preview, setPreview] = useState(value);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // preview ngay lập tức
    setPreview(URL.createObjectURL(file));
    setUploading(true);
    try {
      const resized = await resizeImage(file, 400);
      const fd = new FormData();
      fd.append("file", new File([resized], file.name, { type: "image/webp" }));
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      if (res.ok) {
        const { url } = await res.json();
        setPreview(url);
        onChange(url);
      } else {
        const d = await res.json();
        alert(d.error || "Upload thất bại");
        setPreview(value);
      }
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  return (
    <div className="flex items-center gap-3">
      {/* Thumbnail preview */}
      <div className="w-14 h-14 rounded-xl border-2 border-dashed border-gray-300 bg-white flex items-center justify-center overflow-hidden shrink-0">
        {preview ? (
          <img src={preview} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="text-gray-400 text-xs text-center leading-tight px-1">Chưa có ảnh</span>
        )}
      </div>
      <div className="flex-1">
        <label className={`${uploading ? "opacity-50 pointer-events-none" : "cursor-pointer"} inline-flex items-center gap-1.5 text-xs bg-white border border-gray-300 hover:border-emerald-400 text-gray-600 px-3 py-2 rounded-xl transition-colors`}>
          {uploading ? "Đang tải..." : preview ? "Đổi ảnh" : "Tải ảnh lên"}
          <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFile} disabled={uploading} />
        </label>
        {preview && (
          <button type="button" onClick={() => { setPreview(""); onChange(""); }}
            className="text-xs text-red-400 hover:text-red-600 mt-0.5">Xóa ảnh</button>
        )}
      </div>
    </div>
  );
}

function ServicesTab({ facilities }: { facilities: Facility[] }) {
  const [facilityId, setFacilityId] = useState<string>("");
  const [services, setServices] = useState<Service[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [expandedBatches, setExpandedBatches] = useState<Set<number>>(new Set());
  const [form, setForm] = useState({ name: "", type: "PRODUCT", price: "", importPrice: "", stockQuantity: "", monthlyThreshold: "", imageUrl: "" });
  const [editForm, setEditForm] = useState<Partial<Omit<Service, "stockQuantity"|"monthlyThreshold"|"importPrice"> & { stockQuantity: string; monthlyThreshold: string; importPrice: string }>>({});
  const [loaded, setLoaded] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editUploading, setEditUploading] = useState(false);
  const [importTarget, setImportTarget] = useState<{ id: number; name: string; currentStock: number; currentImportPrice: number } | null>(null);
  const [importForm, setImportForm] = useState({ qty: "", price: "", note: "" });
  const [importing, setImporting] = useState(false);

  const loadServices = useCallback((fid: string) => {
    if (!fid) return;
    fetch(`/api/owner/services?facilityId=${fid}`).then(r => r.json()).then(d => { setServices(Array.isArray(d) ? d : []); setLoaded(true); });
  }, []);

  function toggleBatches(id: number) {
    setExpandedBatches(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function doImport() {
    if (!importTarget) return;
    const qty = Number(importForm.qty);
    if (!qty || qty <= 0) { alert("Số lượng nhập phải lớn hơn 0"); return; }
    setImporting(true);
    const res = await fetch(`/api/owner/services/${importTarget.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        importQty: qty,
        importPrice: importForm.price ? Number(importForm.price) * 1000 : null,
        note: importForm.note || null,
      }),
    });
    setImporting(false);
    if (res.ok) {
      setImportTarget(null);
      setImportForm({ qty: "", price: "", note: "" });
      loadServices(facilityId);
    } else {
      const d = await res.json();
      alert(d.error || "Lỗi khi nhập kho");
    }
  }

  async function createService() {
    const res = await fetch("/api/owner/services", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        facilityId,
        price: Number(form.price) * 1000,
        importPrice: Number(form.importPrice || 0) * 1000,
        monthlyThreshold: Number(form.monthlyThreshold || 0),
      }),
    });
    if (res.ok) {
      setShowForm(false);
      setForm({ name: "", type: "PRODUCT", price: "", importPrice: "", stockQuantity: "", monthlyThreshold: "", imageUrl: "" });
      loadServices(facilityId);
    } else { const d = await res.json(); alert(d.error); }
  }

  async function updateService() {
    if (!editing) return;
    const res = await fetch(`/api/owner/services/${editing.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...editForm,
        ...(editForm.price !== undefined && { price: Number(editForm.price) * 1000 }),
        ...(editForm.importPrice !== undefined && { importPrice: Number(editForm.importPrice) * 1000 }),
      }),
    });
    if (res.ok) { setEditing(null); loadServices(facilityId); }
    else { const d = await res.json(); alert(d.error); }
  }

  async function deleteService(id: number) {
    if (!confirm("Ẩn dịch vụ này?")) return;
    await fetch(`/api/owner/services/${id}`, { method: "DELETE" });
    loadServices(facilityId);
  }

  return (
    <div>
      {/* Modal nhập kho */}
      {importTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-base font-bold text-gray-900 mb-1">Nhập kho: {importTarget.name}</h3>
            {importTarget.currentStock > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 text-xs">
                <div className="font-semibold text-amber-700 mb-2">Kho hiện tại (trước khi nhập)</div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-white border border-amber-100 rounded-lg p-2 text-center">
                    <div className="text-gray-400">Tồn kho cũ</div>
                    <div className="font-bold text-gray-800 text-sm mt-0.5">{importTarget.currentStock} sp</div>
                  </div>
                  <div className="bg-white border border-amber-100 rounded-lg p-2 text-center">
                    <div className="text-gray-400">Giá nhập cũ</div>
                    <div className="font-bold text-red-600 text-sm mt-0.5">{importTarget.currentImportPrice.toLocaleString("vi-VN")}đ/sp</div>
                  </div>
                </div>
                <p className="text-amber-600 text-[10px] mt-2">⚠️ Còn tồn kho cũ — FIFO sẽ phân bổ lợi nhuận riêng theo từng lô nhập.</p>
              </div>
            )}
            <div className="space-y-3 mb-4">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Số lượng nhập *</label>
                <input className={INPUT} placeholder="Số lượng sp nhập vào" type="number" min={1}
                  value={importForm.qty} onChange={e => setImportForm(f => ({ ...f, qty: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Giá nhập / sp (nghìn đ) — để trống giữ nguyên giá cũ</label>
                <input className={INPUT} placeholder={`Giá hiện tại: ${(importTarget.currentImportPrice / 1000).toFixed(0)}k`} type="number" min={0}
                  value={importForm.price} onChange={e => setImportForm(f => ({ ...f, price: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Ghi chú lô hàng</label>
                <input className={INPUT} placeholder="VD: Lô tháng 4, NCC ABC..." value={importForm.note}
                  onChange={e => setImportForm(f => ({ ...f, note: e.target.value }))} />
              </div>
            </div>
            {Number(importForm.qty) > 0 && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 mb-4 text-xs">
                <div className="font-semibold text-emerald-700 mb-2">Sau khi nhập lô mới</div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-white border border-emerald-100 rounded-lg p-2 text-center">
                    <div className="text-gray-400">Tồn kho mới</div>
                    <div className="font-bold text-emerald-700 text-sm mt-0.5">{importTarget.currentStock + Number(importForm.qty)} sp</div>
                    {importTarget.currentStock > 0 && <div className="text-[10px] text-gray-400">(+{Number(importForm.qty)} sp)</div>}
                  </div>
                  <div className="bg-white border border-emerald-100 rounded-lg p-2 text-center">
                    <div className="text-gray-400">Giá nhập lô này</div>
                    <div className="font-bold text-red-600 text-sm mt-0.5">
                      {importForm.price
                        ? `${(Number(importForm.price) * 1000).toLocaleString("vi-VN")}đ/sp`
                        : `${importTarget.currentImportPrice.toLocaleString("vi-VN")}đ/sp`}
                    </div>
                    {importForm.price && importTarget.currentImportPrice > 0 && Number(importForm.price) * 1000 !== importTarget.currentImportPrice && (
                      <div className="text-[10px] text-amber-600">
                        (cũ: {importTarget.currentImportPrice.toLocaleString("vi-VN")}đ)
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setImportTarget(null); setImportForm({ qty: "", price: "", note: "" }); }} className={BTN_W}>Hủy</button>
              <button onClick={doImport} disabled={importing || !importForm.qty} className={BTN_G}>
                {importing ? "Đang nhập..." : "Xác nhận nhập kho"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <select className={INPUT + " w-56"} value={facilityId} onChange={e => { setFacilityId(e.target.value); loadServices(e.target.value); }}>
          <option value="">-- Chọn cơ sở --</option>
          {facilities.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
        {facilityId && <button onClick={() => setShowForm(!showForm)} className={BTN_G}>+ Thêm dịch vụ / hàng hóa</button>}
      </div>

      {showForm && facilityId && (
        <div className={CARD} style={BG}>
          <h3 className="font-semibold text-black mb-3">Thêm dịch vụ / hàng hóa mới</h3>
          <div className="grid grid-cols-2 gap-2.5 mb-3">
            <input className={INPUT} placeholder="Tên hàng hóa / dịch vụ *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            <select className={INPUT} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
              <option value="PRODUCT">Hàng hóa (F&B)</option>
              <option value="RENTAL">Đồ cho thuê</option>
            </select>
            <input className={INPUT} placeholder={form.type === "RENTAL" ? "Giá vốn / giá gốc đồ thuê (nghìn đ)" : "Giá nhập/sp lô đầu (nghìn đ)"} type="number" value={form.importPrice} onChange={e => setForm(f => ({ ...f, importPrice: e.target.value }))} />
            <input className={INPUT} placeholder={form.type === "RENTAL" ? "Giá thuê / lượt (nghìn đ) *" : "Giá bán / sp (nghìn đ) *"} type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} />
            <input className={INPUT} placeholder={form.type === "RENTAL" ? "Số lượng đồ sẵn có" : "Số lượng nhập lô đầu"} type="number" value={form.stockQuantity} onChange={e => setForm(f => ({ ...f, stockQuantity: e.target.value }))} />
            {form.type === "PRODUCT" && (
              <input className={INPUT} placeholder="Ngưỡng bán tối thiểu / tháng (sp)" type="number" min={0} value={form.monthlyThreshold} onChange={e => setForm(f => ({ ...f, monthlyThreshold: e.target.value }))} />
            )}
          </div>
          <div className="border border-gray-200 rounded-xl p-3 bg-white/50 mb-3">
            <p className="text-xs text-gray-500 font-medium mb-2">Hình ảnh hàng hóa</p>
            <ImageUpload
              value={form.imageUrl}
              onChange={url => setForm(f => ({ ...f, imageUrl: url }))}
              uploading={uploading}
              setUploading={setUploading}
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className={BTN_W}>Hủy</button>
            <button onClick={createService} disabled={uploading} className={BTN_G}>Thêm</button>
          </div>
        </div>
      )}

      {loaded && (
        <>
          {/* Cảnh báo tồn kho */}
          {(() => {
            const products = services.filter(s => s.type === "PRODUCT");
            const outOfStock = products.filter(s => s.stockQuantity === 0);
            const lowStockThreshold = (s: Service) => s.monthlyThreshold > 0 ? s.monthlyThreshold : 10;
            const lowStock = products.filter(s => s.stockQuantity > 0 && s.stockQuantity <= lowStockThreshold(s));
            const slowSales = products.filter(s => s.monthlyThreshold > 0 && (s.soldThisMonth ?? 0) < s.monthlyThreshold && s.stockQuantity > 0);
            if (outOfStock.length === 0 && lowStock.length === 0 && slowSales.length === 0) return null;
            return (
              <div className="flex flex-col gap-2 mb-4">
                {outOfStock.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 flex items-center gap-2">
                    <span className="text-red-500 font-bold text-lg">🚫</span>
                    <div>
                      <p className="text-xs text-red-600 font-semibold">Hết hàng ({outOfStock.length} mặt hàng)</p>
                      <p className="text-xs text-red-400">{outOfStock.map(s => s.name).join(", ")}</p>
                    </div>
                  </div>
                )}
                {lowStock.length > 0 && (
                  <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-2.5 flex items-center gap-2">
                    <span className="text-orange-500 font-bold text-lg">⚠️</span>
                    <div>
                      <p className="text-xs text-orange-600 font-semibold">Sắp hết tồn kho ({lowStock.length} mặt hàng)</p>
                      <p className="text-xs text-orange-400">{lowStock.map(s => `${s.name} (còn ${s.stockQuantity}sp)`).join(", ")}</p>
                    </div>
                  </div>
                )}
                {slowSales.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 flex items-center gap-2">
                    <span className="text-amber-500 font-bold text-lg">📉</span>
                    <div>
                      <p className="text-xs text-amber-700 font-semibold">Bán chậm tháng này ({slowSales.length} mặt hàng)</p>
                      <p className="text-xs text-amber-500">{slowSales.map(s => `${s.name} (${s.soldThisMonth ?? 0}/${s.monthlyThreshold}sp)`).join(", ")}</p>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          <div className="overflow-auto rounded-2xl border border-gray-300" style={BG}>
            <table className="w-full text-sm min-w-[980px]">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/60 text-xs">
                  <th className="w-12 px-3 py-3 align-top"></th>
                  <th className="text-left px-3 py-3 font-semibold text-gray-700 align-top">
                    Hàng hóa / Dịch vụ
                    <div className="text-[10px] font-normal text-gray-400">Loại</div>
                  </th>
                  <th className="text-right px-3 py-3 font-semibold text-gray-700 align-top">
                    Giá bán/sp
                    <div className="text-[10px] font-normal text-gray-400">Giá nhập gần nhất</div>
                  </th>
                  <th className="text-right px-3 py-3 font-semibold text-gray-700 align-top">
                    Tồn kho
                    <div className="text-[10px] font-normal text-gray-400">Hiện tại</div>
                  </th>
                  <th className="text-right px-3 py-3 font-semibold text-gray-700 align-top">
                    Đã bán (tổng)
                    <div className="text-[10px] font-normal text-gray-400">Tháng này</div>
                  </th>
                  <th className="text-right px-3 py-3 font-semibold text-gray-700 align-top">
                    Doanh thu
                    <div className="text-[10px] font-normal text-gray-400">Giá vốn · Lợi nhuận</div>
                  </th>
                  <th className="text-center px-3 py-3 font-semibold text-gray-700 align-top">
                    Lịch sử nhập
                    <div className="text-[10px] font-normal text-gray-400">Ngày · SL · Giá/sp</div>
                  </th>
                  <th className="text-center px-3 py-3 font-semibold text-gray-700 align-top">Trạng thái</th>
                  <th className="text-center px-3 py-3 font-semibold text-gray-700 align-top">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {services.length === 0 ? (
                  <tr><td colSpan={9} className="text-center py-8 text-gray-400">Chưa có hàng hóa / dịch vụ nào</td></tr>
                ) : services.map(svc => {
                  const totalSold    = svc.totalSold ?? 0;
                  const salePriceNum = Number(svc.price);
                  const batches      = svc.importBatches ?? [];
                  const hasBatches   = batches.length >= 1;
                  const isExpanded   = expandedBatches.has(svc.id);
                  const lastImportPrice = svc.lastImport?.importPrice ?? Number(svc.importPrice ?? 0);

                  // Tổng doanh thu / vốn / lãi
                  const totalRevenue = svc.totalRevenue ?? totalSold * salePriceNum;
                  const totalCogs    = svc.totalCogs ?? 0;
                  const totalProfit  = svc.totalProfit ?? totalRevenue - totalCogs;

                  // Cho thuê
                  const rentalCost      = Number(svc.importPrice ?? 0);
                  const rentalRevenue   = salePriceNum * totalSold;
                  const rentalProfit    = rentalRevenue - rentalCost;
                  const rentalRecovered = rentalCost > 0 && rentalRevenue >= rentalCost;

                  return (
                    <React.Fragment key={svc.id}>
                      <tr className="border-t border-gray-100 hover:bg-gray-50/40 transition-colors align-top">
                        {/* Ảnh */}
                        <td className="px-3 py-2.5">
                          <div className="w-10 h-10 rounded-lg overflow-hidden border border-gray-200 bg-gray-50 flex items-center justify-center">
                            {svc.imageUrl
                              ? <img src={svc.imageUrl} alt={svc.name} className="w-full h-full object-cover" />
                              : <span className="text-gray-300 text-lg">📦</span>}
                          </div>
                        </td>

                        {/* Tên + Loại */}
                        <td className="px-3 py-2.5">
                          <div className="font-medium text-black text-sm">{svc.name}</div>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full mt-1 inline-block ${svc.type === "RENTAL" ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-orange-700"}`}>
                            {svc.type === "RENTAL" ? "Cho thuê" : "F&B"}
                          </span>
                        </td>

                        {/* Giá bán / Giá nhập gần nhất */}
                        <td className="px-3 py-2.5 text-right text-xs">
                          <div className="font-semibold text-emerald-600 text-sm">{salePriceNum.toLocaleString("vi-VN")}đ</div>
                          {svc.type === "PRODUCT" && lastImportPrice > 0 && (
                            <div className="text-red-500 text-[10px] mt-0.5">{lastImportPrice.toLocaleString("vi-VN")}đ/sp nhập</div>
                          )}
                          {svc.type === "RENTAL" && rentalCost > 0 && (
                            <div className="text-red-500 text-[10px] mt-0.5">{rentalCost.toLocaleString("vi-VN")}đ vốn</div>
                          )}
                        </td>

                        {/* Tồn kho */}
                        <td className="px-3 py-2.5 text-right text-xs">
                          {svc.type === "PRODUCT" ? (
                            <div>
                              <span className={`font-semibold ${svc.stockQuantity === 0 ? "text-red-500" : svc.stockQuantity <= (svc.monthlyThreshold > 0 ? svc.monthlyThreshold : 10) ? "text-orange-500" : "text-gray-700"}`}>
                                {svc.stockQuantity}sp
                              </span>
                              {svc.stockQuantity === 0 && <span className="ml-1 bg-red-100 text-red-600 px-1 py-0.5 rounded-full text-[10px]">Hết</span>}
                              {svc.stockQuantity > 0 && svc.stockQuantity <= (svc.monthlyThreshold > 0 ? svc.monthlyThreshold : 10) && (
                                <span className="ml-1 bg-orange-100 text-orange-600 px-1 py-0.5 rounded-full text-[10px]">Sắp hết</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-700 font-medium">{svc.stockQuantity} cái</span>
                          )}
                        </td>

                        {/* Đã bán */}
                        <td className="px-3 py-2.5 text-right text-xs">
                          {svc.type === "PRODUCT" ? (
                            <div>
                              <span className={`font-semibold ${svc.monthlyThreshold > 0 && (svc.soldThisMonth ?? 0) < svc.monthlyThreshold ? "text-amber-600" : "text-gray-700"}`}>
                                {totalSold}sp
                              </span>
                              <div className="text-[10px] text-gray-400">
                                T.này: {svc.soldThisMonth ?? 0}{svc.monthlyThreshold > 0 ? `/${svc.monthlyThreshold}` : ""}sp
                              </div>
                            </div>
                          ) : (
                            <span className="font-semibold text-blue-600">{totalSold} lượt</span>
                          )}
                        </td>

                        {/* Doanh thu / Vốn / Lãi */}
                        <td className="px-3 py-2.5 text-right text-xs">
                          {svc.type === "PRODUCT" ? (
                            totalSold > 0 ? (
                              <div>
                                <div className="font-semibold text-emerald-600">{totalRevenue.toLocaleString("vi-VN")}đ</div>
                                {totalCogs > 0 && (
                                  <>
                                    <div className="text-red-500 text-[10px]">Vốn: {totalCogs.toLocaleString("vi-VN")}đ</div>
                                    <div className={`font-semibold text-[10px] ${totalProfit >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                                      Lãi: {totalProfit >= 0 ? "+" : ""}{totalProfit.toLocaleString("vi-VN")}đ
                                    </div>
                                  </>
                                )}
                              </div>
                            ) : <span className="text-gray-300">—</span>
                          ) : (
                            <div>
                              <div className="font-semibold text-emerald-600">{rentalRevenue.toLocaleString("vi-VN")}đ</div>
                              {rentalCost > 0 && (
                                rentalRecovered
                                  ? <div className="text-emerald-700 text-[10px] font-semibold">Lãi: +{rentalProfit.toLocaleString("vi-VN")}đ</div>
                                  : <div className="text-orange-500 text-[10px]">Hoàn vốn {Math.round(rentalRevenue / rentalCost * 100)}%</div>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Lịch sử nhập */}
                        <td className="px-3 py-2.5 text-center text-xs">
                          {svc.type === "PRODUCT" ? (
                            hasBatches ? (
                              <div>
                                <div className="text-gray-500">{new Date(svc.lastImport!.date).toLocaleDateString("vi-VN")}</div>
                                <div className="text-gray-700 font-medium">+{svc.lastImport!.quantity}sp</div>
                                <button onClick={() => toggleBatches(svc.id)}
                                  className="mt-1 text-[10px] bg-blue-100 hover:bg-blue-200 text-blue-700 px-2 py-0.5 rounded-full transition-colors">
                                  {isExpanded ? "▲ Ẩn" : `▼ ${batches.length} lô`}
                                </button>
                              </div>
                            ) : (
                              <span className="text-gray-300 text-[10px]">Chưa nhập kho</span>
                            )
                          ) : (
                            <span className="text-gray-400 text-[10px]">—</span>
                          )}
                        </td>

                        {/* Trạng thái */}
                        <td className="px-3 py-2.5 text-center">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${svc.isActive ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                            {svc.isActive ? "Hoạt động" : "Ẩn"}
                          </span>
                        </td>

                        {/* Thao tác */}
                        <td className="px-3 py-2.5">
                          <div className="flex flex-col gap-1.5 items-end">
                            {svc.type === "PRODUCT" && (
                              <button
                                onClick={() => setImportTarget({ id: svc.id, name: svc.name, currentStock: svc.stockQuantity, currentImportPrice: lastImportPrice })}
                                className="bg-emerald-500 hover:bg-emerald-400 text-white px-3 py-1.5 rounded-lg text-xs w-full transition-colors">
                                + Nhập hàng
                              </button>
                            )}
                            <div className="flex gap-1 w-full">
                              <button onClick={() => {
                                setEditing(svc);
                                setEditForm({
                                  name: svc.name, type: svc.type,
                                  price: String(Number(svc.price) / 1000),
                                  importPrice: String(Number(svc.importPrice ?? 0) / 1000),
                                  stockQuantity: String(svc.stockQuantity),
                                  monthlyThreshold: String(svc.monthlyThreshold ?? 0),
                                  isActive: svc.isActive, imageUrl: svc.imageUrl ?? "",
                                });
                              }} className="bg-blue-500 hover:bg-blue-400 text-white px-3 py-1.5 rounded-lg text-xs flex-1 transition-colors">Sửa</button>
                              <button onClick={() => deleteService(svc.id)} className={BTN_R + " flex-1"}>Ẩn</button>
                            </div>
                          </div>
                        </td>
                      </tr>

                      {/* Lịch sử lô nhập — FIFO breakdown */}
                      {svc.type === "PRODUCT" && isExpanded && batches.length > 0 && (
                        <tr className="bg-blue-50/60 border-t border-blue-100">
                          <td colSpan={9} className="px-6 py-3">
                            <p className="text-xs font-semibold text-blue-700 mb-2">Lịch sử nhập kho &amp; phân bổ doanh thu FIFO — {svc.name}</p>
                            <table className="w-full text-xs border-collapse">
                              <thead>
                                <tr className="bg-blue-100/60 text-blue-800">
                                  <th className="text-left px-2 py-1.5 font-semibold rounded-l">Ngày nhập · Ghi chú</th>
                                  <th className="text-right px-2 py-1.5 font-semibold">SL nhập</th>
                                  <th className="text-right px-2 py-1.5 font-semibold">Giá nhập/sp</th>
                                  <th className="text-right px-2 py-1.5 font-semibold">Tồn còn lại</th>
                                  <th className="text-right px-2 py-1.5 font-semibold">SL đã bán (FIFO)</th>
                                  <th className="text-right px-2 py-1.5 font-semibold">Doanh thu lô</th>
                                  <th className="text-right px-2 py-1.5 font-semibold">Giá vốn lô</th>
                                  <th className="text-right px-2 py-1.5 font-semibold rounded-r">Lợi nhuận lô</th>
                                </tr>
                              </thead>
                              <tbody>
                                {batches.map((b, idx) => {
                                  const remaining = b.quantity - b.soldQty;
                                  return (
                                    <tr key={b.id} className={idx % 2 === 0 ? "bg-white/60" : "bg-blue-50/40"}>
                                      <td className="px-2 py-1.5 text-gray-600">
                                        {new Date(b.date).toLocaleDateString("vi-VN")}
                                        {b.note ? <span className="text-gray-400 ml-1">· {b.note}</span> : ""}
                                        {idx === batches.length - 1 && <span className="ml-1 bg-emerald-100 text-emerald-700 text-[10px] px-1 rounded">Mới nhất</span>}
                                      </td>
                                      <td className="px-2 py-1.5 text-right font-medium text-gray-700">{b.quantity}sp</td>
                                      <td className="px-2 py-1.5 text-right text-red-600 font-medium">{b.importPrice.toLocaleString("vi-VN")}đ</td>
                                      <td className="px-2 py-1.5 text-right">
                                        <span className={remaining > 0 ? "text-emerald-600 font-medium" : "text-gray-400"}>{remaining}sp</span>
                                      </td>
                                      <td className="px-2 py-1.5 text-right text-gray-700">{b.soldQty}sp</td>
                                      <td className="px-2 py-1.5 text-right text-emerald-600 font-medium">{b.revenue.toLocaleString("vi-VN")}đ</td>
                                      <td className="px-2 py-1.5 text-right text-red-500">{b.cogs.toLocaleString("vi-VN")}đ</td>
                                      <td className={`px-2 py-1.5 text-right font-semibold ${b.profit >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                                        {b.profit >= 0 ? "+" : ""}{b.profit.toLocaleString("vi-VN")}đ
                                      </td>
                                    </tr>
                                  );
                                })}
                                <tr className="border-t border-blue-200 bg-blue-100/50 font-semibold">
                                  <td className="px-2 py-1.5 text-blue-800" colSpan={4}>Tổng cộng</td>
                                  <td className="px-2 py-1.5 text-right text-gray-700">{totalSold}sp</td>
                                  <td className="px-2 py-1.5 text-right text-emerald-700">{totalRevenue.toLocaleString("vi-VN")}đ</td>
                                  <td className="px-2 py-1.5 text-right text-red-600">{totalCogs.toLocaleString("vi-VN")}đ</td>
                                  <td className={`px-2 py-1.5 text-right ${totalProfit >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                                    {totalProfit >= 0 ? "+" : ""}{totalProfit.toLocaleString("vi-VN")}đ
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}

                      {/* Inline edit row */}
                      {editing?.id === svc.id && (
                        <tr className="bg-blue-50 border-t border-blue-200">
                          <td className="px-2 py-2 align-top">
                            <ImageUpload
                              value={editForm.imageUrl as string || ""}
                              onChange={url => setEditForm(f => ({ ...f, imageUrl: url }))}
                              uploading={editUploading}
                              setUploading={setEditUploading}
                            />
                          </td>
                          {/* Tên + Loại */}
                          <td className="px-2 py-2 align-top">
                            <input className={INPUT + " text-xs mb-1.5"} placeholder="Tên hàng hóa" value={editForm.name || ""} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
                            <select className={INPUT + " text-xs"} value={editForm.type || ""} onChange={e => setEditForm(f => ({ ...f, type: e.target.value }))}>
                              <option value="PRODUCT">F&B</option>
                              <option value="RENTAL">Cho thuê</option>
                            </select>
                          </td>
                          {/* Giá bán + Giá nhập */}
                          <td className="px-2 py-2 align-top">
                            <input className={INPUT + " text-xs text-right mb-1.5"} placeholder="Giá bán/sp (nghìn đ)" type="number" min={0} value={editForm.price || ""} onChange={e => setEditForm(f => ({ ...f, price: e.target.value }))} />
                            <input className={INPUT + " text-xs text-right"} placeholder="Giá nhập/sp (nghìn đ)" type="number" min={0} value={editForm.importPrice || ""} onChange={e => setEditForm(f => ({ ...f, importPrice: e.target.value }))} />
                            <p className="text-[10px] text-gray-400 mt-0.5 text-right">nghìn đ/sp</p>
                          </td>
                          {/* Tồn kho */}
                          <td className="px-2 py-2 align-top">
                            <input className={INPUT + " text-xs text-right"} placeholder={editForm.type === "RENTAL" ? "Số lượng đồ" : "Tồn kho hiện tại"} type="number" min={0} value={editForm.stockQuantity || ""} onChange={e => setEditForm(f => ({ ...f, stockQuantity: e.target.value }))} />
                            <p className="text-[10px] text-gray-400 mt-0.5 text-right">{editForm.type === "RENTAL" ? "cái" : "sp"}</p>
                          </td>
                          {/* Đã bán — readonly */}
                          <td className="px-2 py-2 align-top text-center">
                            <span className="text-xs text-gray-400 italic">—</span>
                          </td>
                          {/* Doanh thu col — ngưỡng */}
                          <td className="px-2 py-2 align-top">
                            {editForm.type === "PRODUCT" ? (
                              <>
                                <input className={INPUT + " text-xs text-right"} placeholder="Ngưỡng bán/tháng" type="number" min={0} value={editForm.monthlyThreshold || ""} onChange={e => setEditForm(f => ({ ...f, monthlyThreshold: e.target.value }))} />
                                <p className="text-[10px] text-gray-400 mt-0.5 text-right">sp/tháng</p>
                              </>
                            ) : <span className="text-xs text-gray-400 italic">—</span>}
                          </td>
                          {/* Lịch sử — readonly */}
                          <td className="px-2 py-2 align-top text-center">
                            <span className="text-xs text-gray-400 italic">—</span>
                          </td>
                          {/* Trạng thái */}
                          <td className="px-2 py-2 align-top">
                            <select className={INPUT + " text-xs"} value={editForm.isActive ? "true" : "false"} onChange={e => setEditForm(f => ({ ...f, isActive: e.target.value === "true" }))}>
                              <option value="true">Hoạt động</option>
                              <option value="false">Ẩn</option>
                            </select>
                          </td>
                          {/* Lưu / Hủy */}
                          <td className="px-2 py-2 align-top">
                            <div className="flex flex-col gap-1.5">
                              <button onClick={updateService} disabled={editUploading} className={BTN_G + " text-xs py-1.5 w-full"}>Lưu</button>
                              <button onClick={() => setEditing(null)} className={BTN_W + " text-xs py-1.5 w-full"}>Hủy</button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Pending Guest Bookings Widget ──────────────────────────────────────────
function PendingGuestBookingsWidget() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [confirming, setConfirming] = useState<number | null>(null);
  const [cancelTarget, setCancelTarget] = useState<{ id: number; guestName: string; guestPhone: string; guestEmail: string | null; amount: number; status: string; guestBankName: string | null; guestBankAccount: string | null } | null>(null);
  const [refundBankName, setRefundBankName] = useState("");
  const [refundAccountNumber, setRefundAccountNumber] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/owner/guest-bookings")
      .then(r => r.json())
      .then(d => { setBookings(Array.isArray(d) ? d : []); setLoading(false); });
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleConfirm(id: number) {
    setConfirming(id);
    await fetch("/api/owner/guest-bookings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingId: id, action: "confirm" }),
    });
    setConfirming(null);
    load();
  }

  async function handleCancel() {
    if (!cancelTarget) return;
    setConfirming(cancelTarget.id);
    const bankAccountInfo = [refundBankName, refundAccountNumber].filter(Boolean).join(" – ") || undefined;
    await fetch("/api/owner/guest-bookings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingId: cancelTarget.id, action: "cancel", bankAccountInfo }),
    });
    setConfirming(null);
    setCancelTarget(null);
    setRefundBankName("");
    setRefundAccountNumber("");
    load();
  }

  if (loading) return null;
  if (bookings.length === 0) return null;

  return (
    <>
      {/* Modal hoàn tiền thủ công */}
      {cancelTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-base font-bold text-gray-900 mb-1">
              {cancelTarget.status === "CONFIRMED" ? "Huỷ & Hoàn tiền" : "Từ chối"} đơn #{cancelTarget.id}
            </h3>
            <div className="text-sm text-gray-600 mb-3 space-y-0.5">
              <p>Khách: <b>{cancelTarget.guestName}</b> · {cancelTarget.guestPhone}</p>
              {cancelTarget.guestEmail && <p className="text-xs text-gray-400">{cancelTarget.guestEmail}</p>}
              <p>Số tiền cần hoàn: <b className="text-red-600">{cancelTarget.amount.toLocaleString("vi-VN")}đ</b></p>
            </div>
            {cancelTarget.status === "CONFIRMED" && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 mb-3 text-xs text-orange-700">
                Đơn đã xác nhận → ví kinh doanh sẽ bị trừ {cancelTarget.amount.toLocaleString("vi-VN")}đ (ghi nhận HOÀN TIỀN). Bạn cần chuyển khoản thủ công cho khách.
              </div>
            )}
            <p className="text-xs text-gray-600 mb-2 font-medium">Tài khoản ngân hàng của khách để chuyển hoàn tiền:</p>
            {cancelTarget.guestBankName && cancelTarget.guestBankAccount ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2.5 mb-3">
                <p className="text-xs text-gray-500 mb-0.5">Khách đã cung cấp khi đặt sân:</p>
                <p className="text-sm font-semibold text-emerald-700">{cancelTarget.guestBankName} – {cancelTarget.guestBankAccount}</p>
                <p className="text-xs text-gray-400 mt-1">Thông tin này sẽ được gửi trong email hoàn tiền tự động.</p>
              </div>
            ) : (
              <>
                <input
                  value={refundBankName}
                  onChange={e => setRefundBankName(e.target.value)}
                  placeholder="Tên ngân hàng (VD: Vietcombank)"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-2 focus:outline-none focus:border-emerald-400"
                />
                <input
                  value={refundAccountNumber}
                  onChange={e => setRefundAccountNumber(e.target.value)}
                  placeholder="Số tài khoản của khách"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-1 focus:outline-none focus:border-emerald-400"
                />
                <p className="text-xs text-gray-400 mb-3">Khách chưa cung cấp STK. Nhập để gửi email hướng dẫn hoàn tiền (tùy chọn).</p>
              </>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => { setCancelTarget(null); setRefundBankName(""); setRefundAccountNumber(""); }}
                className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg text-sm hover:bg-gray-50 transition-colors"
              >
                Huỷ bỏ
              </button>
              <button
                disabled={confirming === cancelTarget.id}
                onClick={handleCancel}
                className="flex-1 bg-red-500 hover:bg-red-400 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium transition-colors"
              >
                {confirming === cancelTarget.id ? "Đang xử lý..." : cancelTarget.status === "CONFIRMED" ? "Xác nhận huỷ & hoàn tiền" : "Xác nhận từ chối"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mb-6 border border-yellow-300 rounded-2xl overflow-hidden">
        <button
          onClick={() => setCollapsed(v => !v)}
          className="w-full flex items-center justify-between px-5 py-3 bg-yellow-50 hover:bg-yellow-100 transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="text-yellow-600 text-lg">⏳</span>
            <span className="font-semibold text-yellow-800 text-sm">
              {bookings.length} đơn đặt khách vãng lai chờ xác nhận
            </span>
          </div>
          <span className="text-yellow-600 text-xs">{collapsed ? "Mở ▼" : "Thu gọn ▲"}</span>
        </button>
        {!collapsed && (
          <div className="bg-white divide-y divide-gray-100">
            {bookings.map(b => (
              <div key={b.id} className="px-5 py-3 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-black">#{b.id} · {b.guestName} · {b.guestPhone}</p>
                  <p className="text-xs text-gray-500">{b.court.facility} · {b.court.name} · {b.court.sport}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(b.bookingDate).toLocaleDateString("vi-VN")} ·{" "}
                    {new Date(b.startTime).toISOString().substring(11,16)} – {new Date(b.endTime).toISOString().substring(11,16)}
                  </p>
                  <p className="text-xs font-bold text-emerald-600">{Number(b.totalPrice).toLocaleString("vi-VN")}đ</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    disabled={confirming === b.id}
                    onClick={() => handleConfirm(b.id)}
                    className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                  >
                    {confirming === b.id ? "..." : "Xác nhận"}
                  </button>
                  <button
                    disabled={confirming === b.id}
                    onClick={() => {
                        setCancelTarget({ id: b.id, guestName: b.guestName, guestPhone: b.guestPhone, guestEmail: b.guestEmail, amount: Number(b.totalPrice), status: b.status, guestBankName: b.guestBankName, guestBankAccount: b.guestBankAccount });
                        setRefundBankName(b.guestBankName || "");
                        setRefundAccountNumber(b.guestBankAccount || "");
                      }}
                    className="bg-red-100 hover:bg-red-200 disabled:opacity-50 text-red-600 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                  >
                    Từ chối
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function OwnerDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const t = useTranslations("owner");
  const [activeTab, setActiveTab] = useState("overview");
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const TABS = TAB_IDS.map(tab => ({ ...tab, label: t(tab.labelKey as any) }));

  useEffect(() => {
    if (status === "unauthenticated") { router.push("/login"); return; }
    if (session && (session.user as any).role !== "OWNER") { router.push("/"); return; }
  }, [session, status, router]);

  useEffect(() => {
    if (status === "authenticated") {
      fetch("/api/owner/facilities").then(r => r.json()).then(d => setFacilities(Array.isArray(d) ? d : []));
    }
  }, [status]);

  if (status === "loading") return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "linear-gradient(to right, #DDEFBB, #FFEEEE)" }}>
      <p className="text-gray-500">{t("loading")}</p>
    </div>
  );

  return (
    <div className="min-h-screen text-black" style={{ fontFamily: "Arial, sans-serif", background: "linear-gradient(to right, #DDEFBB, #FFEEEE)" }}>
      <Navbar />
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-black">{t("dashboard")}</h1>
          <p className="text-gray-500 text-sm mt-1">{t("greeting", { name: (session?.user as any)?.name })}</p>
        </div>

        {/* Đơn đặt sân khách vãng lai chờ xác nhận */}
        <PendingGuestBookingsWidget />

        {/* Tab navigation */}
        <div className="flex gap-1 flex-wrap mb-6 border-b border-gray-200 pb-2">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? "bg-emerald-500 text-white"
                  : "bg-white text-gray-600 hover:text-black border border-gray-300 hover:border-emerald-300"
              }`}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div>
          {activeTab === "overview"   && <OverviewTab />}
          {activeTab === "facilities" && <FacilitiesTab />}
          {activeTab === "vouchers"   && <VouchersTab facilities={facilities} />}
          {activeTab === "staff"      && <StaffTab facilities={facilities} />}
          {activeTab === "shifts"     && <WorkShiftsTab facilities={facilities} />}
          {activeTab === "attendance" && <AttendanceTab facilities={facilities} />}
          {activeTab === "salary"     && <SalaryTab facilities={facilities} />}
          {activeTab === "invoices"   && <InvoicesTab facilities={facilities} />}
          {activeTab === "wallet"     && <WalletTab facilities={facilities} />}
          {activeTab === "services"   && <ServicesTab facilities={facilities} />}
          {activeTab === "revenue"    && <RevenueTab facilities={facilities} />}
        </div>
      </div>
    </div>
  );
}
