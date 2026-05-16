import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "OWNER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const ownerId = Number((session.user as any).id);
  const sp = req.nextUrl.searchParams;
  const now = new Date();
  const year  = Number(sp.get("year")  || now.getFullYear());
  const month = Number(sp.get("month") || now.getMonth() + 1);

  const facilities = await prisma.facility.findMany({
    where: { ownerId },
    select: { id: true, name: true, annualRevenuePlan: true },
  });
  const facilityIds = facilities.map((f) => f.id);
  // Tổng kế hoạch doanh thu năm từ owner-defined plan (nếu có)
  const totalAnnualPlan = facilities.reduce((s, f) => s + Number(f.annualRevenuePlan || 0), 0);

  const LABELS = ["T1","T2","T3","T4","T5","T6","T7","T8","T9","T10","T11","T12"];
  const empty12rev = LABELS.map((label, i) => ({ month: i + 1, label, actual: 0, plan: 0 }));
  const empty12cnt = LABELS.map((label, i) => ({ month: i + 1, label, count: 0 }));

  if (facilityIds.length === 0) {
    return NextResponse.json({
      facilityCount: 0, staffCount: 0,
      currentRevenue: 0, prevRevenue: 0, revenueChange: 0,
      currentBookings: 0, prevBookings: 0, bookingsChange: 0,
      currentCustomers: 0, prevCustomers: 0, customersChange: 0,
      currentItemsSold: 0, prevItemsSold: 0, itemsChange: 0,
      planRevenue: 0, planPercent: 0,
      revenueByMonth: empty12rev, bookingsByMonth: empty12cnt,
      prevYearRevenueByMonth: empty12rev, prevYearBookingsByMonth: empty12cnt,
      customersByMonth: empty12cnt, prevYearCustomersByMonth: empty12cnt,
      revenueByFacility: [], topCourts: [],
    });
  }

  // ── Date ranges ───────────────────────────────────────────────────────────
  const monthStart     = new Date(year, month - 1, 1);
  const monthEnd       = new Date(year, month, 1);
  const prevM          = month === 1 ? 12 : month - 1;
  const prevY          = month === 1 ? year - 1 : year;
  const prevMonthStart = new Date(prevY, prevM - 1, 1);
  const prevMonthEnd   = new Date(prevY, prevM, 1);
  const pyMonthStart   = new Date(year - 1, month - 1, 1);
  const pyMonthEnd     = new Date(year - 1, month, 1);
  const yearStart      = new Date(year, 0, 1);
  const yearEnd        = new Date(year + 1, 0, 1);
  const prevYearStart  = new Date(year - 1, 0, 1);
  const prevYearEnd    = new Date(year, 0, 1);

  // ── All queries in parallel ───────────────────────────────────────────────
  const [
    staffCount,
    curInvAgg, prevInvAgg, pyInvAgg,
    curDsAgg,  prevDsAgg,  pyDsAgg,
    curBookings, prevBookings,
    curCustomerRows, prevCustomerRows,
    // Dữ liệu cả năm hiện tại
    yearInvoices, yearDs,
    yearBookings,         // bao gồm customerId để tính khách theo tháng
    // Dữ liệu cả năm trước (dùng cho biểu đồ so sánh năm)
    prevYearInvoices, prevYearDs,
    prevYearBookings,     // bao gồm customerId
    // Số lượng dịch vụ đã bán
    curInvItemsAgg,  prevInvItemsAgg,
    curDsItemsAgg,   prevDsItemsAgg,
    // Xếp hạng sân trong tháng này
    monthCourtInvoices,
    // Hiệu suất nhân viên
    staffMonthInvoices,
    staffYearInvoices,
    // Lợi nhuận
    yearCogsInvItems,
    yearCogsDsItems,
    yearSalaryRecords,
    productServices,
  ] = await Promise.all([
    prisma.facilityStaff.count({ where: { facilityId: { in: facilityIds } } }),

    // Doanh thu hoá đơn: tháng hiện tại, tháng trước, cùng kỳ năm trước
    prisma.invoice.aggregate({ where: { booking: { court: { facilityId: { in: facilityIds } } }, createdAt: { gte: monthStart,     lt: monthEnd     } }, _sum: { finalTotal: true } }),
    prisma.invoice.aggregate({ where: { booking: { court: { facilityId: { in: facilityIds } } }, createdAt: { gte: prevMonthStart, lt: prevMonthEnd  } }, _sum: { finalTotal: true } }),
    prisma.invoice.aggregate({ where: { booking: { court: { facilityId: { in: facilityIds } } }, createdAt: { gte: pyMonthStart,   lt: pyMonthEnd    } }, _sum: { finalTotal: true } }),

    // Doanh thu bán trực tiếp cho cùng 3 khoảng thời gian
    prisma.directSale.aggregate({ where: { facilityId: { in: facilityIds }, createdAt: { gte: monthStart,     lt: monthEnd     } }, _sum: { finalTotal: true } }),
    prisma.directSale.aggregate({ where: { facilityId: { in: facilityIds }, createdAt: { gte: prevMonthStart, lt: prevMonthEnd  } }, _sum: { finalTotal: true } }),
    prisma.directSale.aggregate({ where: { facilityId: { in: facilityIds }, createdAt: { gte: pyMonthStart,   lt: pyMonthEnd    } }, _sum: { finalTotal: true } }),

    // Số lượt đặt sân: tháng hiện tại vs tháng trước
    prisma.booking.count({ where: { court: { facilityId: { in: facilityIds } }, createdAt: { gte: monthStart,     lt: monthEnd     } } }),
    prisma.booking.count({ where: { court: { facilityId: { in: facilityIds } }, createdAt: { gte: prevMonthStart, lt: prevMonthEnd  } } }),

    // Khách hàng không trùng: tháng hiện tại vs tháng trước (cả đăng ký + vãng lai)
    prisma.booking.findMany({ where: { court: { facilityId: { in: facilityIds } }, createdAt: { gte: monthStart,     lt: monthEnd    } }, select: { customerId: true, walkInPhone: true } }),
    prisma.booking.findMany({ where: { court: { facilityId: { in: facilityIds } }, createdAt: { gte: prevMonthStart, lt: prevMonthEnd } }, select: { customerId: true, walkInPhone: true } }),

    // Năm hiện tại: hoá đơn + bán trực tiếp + đặt sân (cả 12 tháng)
    prisma.invoice.findMany({
      where: { booking: { court: { facilityId: { in: facilityIds } } }, createdAt: { gte: yearStart, lt: yearEnd } },
      select: { finalTotal: true, createdAt: true, booking: { select: { court: { select: { id: true, name: true, facilityId: true } } } } },
    }),
    prisma.directSale.findMany({
      where: { facilityId: { in: facilityIds }, createdAt: { gte: yearStart, lt: yearEnd } },
      select: { finalTotal: true, createdAt: true, facilityId: true },
    }),
    prisma.booking.findMany({
      where: { court: { facilityId: { in: facilityIds } }, createdAt: { gte: yearStart, lt: yearEnd } },
      select: { createdAt: true, customerId: true, walkInPhone: true },
    }),

    // Năm trước: hoá đơn + bán trực tiếp + đặt sân (cả 12 tháng)
    prisma.invoice.findMany({
      where: { booking: { court: { facilityId: { in: facilityIds } } }, createdAt: { gte: prevYearStart, lt: prevYearEnd } },
      select: { finalTotal: true, createdAt: true },
    }),
    prisma.directSale.findMany({
      where: { facilityId: { in: facilityIds }, createdAt: { gte: prevYearStart, lt: prevYearEnd } },
      select: { finalTotal: true, createdAt: true },
    }),
    prisma.booking.findMany({
      where: { court: { facilityId: { in: facilityIds } }, createdAt: { gte: prevYearStart, lt: prevYearEnd } },
      select: { createdAt: true, customerId: true, walkInPhone: true },
    }),

    // Số lượng dịch vụ đã bán theo tháng
    prisma.invoiceItem.aggregate({ where: { invoice: { booking: { court: { facilityId: { in: facilityIds } } }, createdAt: { gte: monthStart,     lt: monthEnd     } }, serviceId: { not: null } }, _sum: { quantity: true } }),
    prisma.invoiceItem.aggregate({ where: { invoice: { booking: { court: { facilityId: { in: facilityIds } } }, createdAt: { gte: prevMonthStart, lt: prevMonthEnd  } }, serviceId: { not: null } }, _sum: { quantity: true } }),
    prisma.directSaleItem.aggregate({ where: { sale: { facilityId: { in: facilityIds }, createdAt: { gte: monthStart,     lt: monthEnd     } } }, _sum: { quantity: true } }),
    prisma.directSaleItem.aggregate({ where: { sale: { facilityId: { in: facilityIds }, createdAt: { gte: prevMonthStart, lt: prevMonthEnd  } } }, _sum: { quantity: true } }),

    // Top sân doanh thu cao nhất tháng này
    prisma.invoice.findMany({
      where: { booking: { court: { facilityId: { in: facilityIds } } }, createdAt: { gte: monthStart, lt: monthEnd } },
      select: { finalTotal: true, booking: { select: { court: { select: { id: true, name: true, facility: { select: { name: true } } } } } } },
    }),

    // Hoá đơn nhân viên tháng này (dùng tính hiệu suất)
    prisma.invoice.findMany({
      where: { booking: { court: { facilityId: { in: facilityIds } } }, createdAt: { gte: monthStart, lt: monthEnd }, staffId: { not: null } },
      select: { finalTotal: true, staffId: true, staff: { select: { id: true, fullName: true } } },
    }),
    // Hoá đơn nhân viên cả năm (dùng tính hiệu suất theo năm)
    prisma.invoice.findMany({
      where: { booking: { court: { facilityId: { in: facilityIds } } }, createdAt: { gte: yearStart, lt: yearEnd }, staffId: { not: null } },
      select: { finalTotal: true, staffId: true, createdAt: true, staff: { select: { id: true, fullName: true } } },
    }),
    // COGS: invoice items for current year
    prisma.invoiceItem.findMany({
      where: {
        serviceId: { not: null },
        invoice: { createdAt: { gte: yearStart, lt: yearEnd }, booking: { court: { facilityId: { in: facilityIds } } } },
      },
      select: { serviceId: true, quantity: true, invoice: { select: { createdAt: true } } },
    }),
    // COGS: direct sale items for current year
    prisma.directSaleItem.findMany({
      where: { sale: { facilityId: { in: facilityIds }, createdAt: { gte: yearStart, lt: yearEnd } } },
      select: { serviceId: true, quantity: true, sale: { select: { createdAt: true } } },
    }),
    // Bản ghi lương cả năm (bao gồm đã ghi nhận, không chỉ đã thanh toán)
    prisma.staffSalaryRecord.findMany({
      where: { facilityId: { in: facilityIds }, year },
      select: { month: true, finalSalary: true },
    }),
    // Dịch vụ kèm giá nhập để tính giá vốn hàng bán (COGS)
    prisma.service.findMany({
      where: { facilityId: { in: facilityIds } },
      select: { id: true, importPrice: true },
    }),
  ]);

  // ── KPI values ────────────────────────────────────────────────────────────
  const currentRevenue  = Number(curInvAgg._sum.finalTotal  || 0) + Number(curDsAgg._sum.finalTotal  || 0);
  const prevRevenue     = Number(prevInvAgg._sum.finalTotal || 0) + Number(prevDsAgg._sum.finalTotal || 0);
  const revenueChange   = prevRevenue  > 0 ? (currentRevenue  - prevRevenue)  / prevRevenue  * 100 : 0;
  const bookingsChange  = prevBookings > 0 ? (curBookings - prevBookings) / prevBookings * 100 : 0;
  const uniqueKey = (b: { customerId: any; walkInPhone: any }) =>
    b.customerId ? `u_${b.customerId}` : b.walkInPhone ? `p_${b.walkInPhone}` : null;
  const currentCustomers = new Set(curCustomerRows.map(uniqueKey).filter(Boolean)).size;
  const prevCustomers    = new Set(prevCustomerRows.map(uniqueKey).filter(Boolean)).size;
  const customersChange  = prevCustomers > 0 ? (currentCustomers - prevCustomers) / prevCustomers * 100 : 0;
  const currentItemsSold = (curInvItemsAgg._sum.quantity  || 0) + (curDsItemsAgg._sum.quantity  || 0);
  const prevItemsSold    = (prevInvItemsAgg._sum.quantity || 0) + (prevDsItemsAgg._sum.quantity || 0);
  const itemsChange      = prevItemsSold > 0 ? (currentItemsSold - prevItemsSold) / prevItemsSold * 100 : 0;

  // Kế hoạch = annualRevenuePlan của chủ / 12; fallback = cùng kỳ năm trước × 1.05
  const pyRevenue   = Number(pyInvAgg._sum.finalTotal || 0) + Number(pyDsAgg._sum.finalTotal || 0);
  let planRevenue: number;
  let planNote: string;
  if (totalAnnualPlan > 0) {
    planRevenue = Math.round(totalAnnualPlan / 12);
    planNote = `Kế hoạch chủ sân đặt: ${Math.round(totalAnnualPlan / 1e6)}M/năm`;
  } else if (pyRevenue > 0) {
    planRevenue = pyRevenue;
    planNote = "(Cùng kỳ năm trước)";
  } else {
    planRevenue = prevRevenue > 0 ? Math.round(prevRevenue * 1.1) : 0;
    planNote = "(Tháng trước × 110%)";
  }
  const planPercent = planRevenue > 0 ? Math.min(Math.round(currentRevenue / planRevenue * 100), 150) : 0;

  // ── Helper: group data by month index ────────────────────────────────────
  function monthlyRevenue(invRows: { finalTotal: any; createdAt: any }[], dsRows: { finalTotal: any; createdAt: any }[], y: number, plan: number) {
    return LABELS.map((label, i) => {
      const mS = new Date(y, i, 1), mE = new Date(y, i + 1, 1);
      const actual =
        invRows.filter(x => { const d = new Date(x.createdAt); return d >= mS && d < mE; }).reduce((s, x) => s + Number(x.finalTotal), 0) +
        dsRows.filter(x => { const d = new Date(x.createdAt); return d >= mS && d < mE; }).reduce((s, x) => s + Number(x.finalTotal), 0);
      return { month: i + 1, label, actual, plan };
    });
  }
  function monthlyBookings(rows: { createdAt: any }[], y: number) {
    return LABELS.map((label, i) => {
      const mS = new Date(y, i, 1), mE = new Date(y, i + 1, 1);
      const count = rows.filter(b => { const d = new Date(b.createdAt); return d >= mS && d < mE; }).length;
      return { month: i + 1, label, count };
    });
  }
  function monthlyCustomers(rows: { createdAt: any; customerId: any; walkInPhone: any }[], y: number) {
    return LABELS.map((label, i) => {
      const mS = new Date(y, i, 1), mE = new Date(y, i + 1, 1);
      const count = new Set(
        rows
          .filter(b => { const d = new Date(b.createdAt); return d >= mS && d < mE; })
          .map(b => b.customerId ? `u_${b.customerId}` : b.walkInPhone ? `p_${b.walkInPhone}` : null)
          .filter(Boolean)
      ).size;
      return { month: i + 1, label, count };
    });
  }

  // Kế hoạch năm trước: dùng trung bình tháng của năm trước làm đường kế hoạch
  const prevYearTotalRev =
    prevYearInvoices.reduce((s, x) => s + Number(x.finalTotal), 0) +
    prevYearDs.reduce((s, x) => s + Number(x.finalTotal), 0);
  const prevYearPlan = Math.round(prevYearTotalRev / 12);

  // ── Monthly arrays ────────────────────────────────────────────────────────
  const revenueByMonth         = monthlyRevenue(yearInvoices,     yearDs,     year,     planRevenue);
  const prevYearRevenueByMonth = monthlyRevenue(prevYearInvoices, prevYearDs, year - 1, prevYearPlan);
  const bookingsByMonth         = monthlyBookings(yearBookings,     year);
  const prevYearBookingsByMonth = monthlyBookings(prevYearBookings, year - 1);
  const customersByMonth         = monthlyCustomers(yearBookings,     year);
  const prevYearCustomersByMonth = monthlyCustomers(prevYearBookings, year - 1);

  // ── Revenue by facility (current year) ───────────────────────────────────
  const facilityRevMap: Record<number, { name: string; total: number }> = {};
  facilities.forEach(f => { facilityRevMap[f.id] = { name: f.name, total: 0 }; });
  yearInvoices.forEach(inv => {
    const fid = inv.booking.court.facilityId;
    if (facilityRevMap[fid]) facilityRevMap[fid].total += Number(inv.finalTotal);
  });
  yearDs.forEach(ds => {
    if (facilityRevMap[ds.facilityId]) facilityRevMap[ds.facilityId].total += Number(ds.finalTotal);
  });
  const revenueByFacility = Object.values(facilityRevMap).sort((a, b) => b.total - a.total);

  // ── Top 10 staff by revenue ───────────────────────────────────────────────
  function buildTopStaff(invoices: { finalTotal: any; staffId: any; staff: any }[]) {
    const map: Record<number, { name: string; revenue: number }> = {};
    invoices.forEach(inv => {
      if (!inv.staffId || !inv.staff) return;
      if (!map[inv.staffId]) map[inv.staffId] = { name: inv.staff.fullName, revenue: 0 };
      map[inv.staffId].revenue += Number(inv.finalTotal);
    });
    return Object.values(map).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  }
  const topStaff        = buildTopStaff(staffMonthInvoices);
  const topStaffYearly  = buildTopStaff(staffYearInvoices);

  // Nhân viên theo quý: gom hoá đơn năm theo quý rồi lấy top 10 quý hiện tại
  const curQuarter = Math.ceil(month / 3);
  const qStart = new Date(year, (curQuarter - 1) * 3, 1);
  const qEnd   = new Date(year, curQuarter * 3, 1);
  const staffQInvoices = staffYearInvoices.filter(inv => {
    const d = new Date(inv.createdAt ?? 0);
    return d >= qStart && d < qEnd;
  });
  const topStaffQuarterly = buildTopStaff(staffQInvoices.length ? staffQInvoices : staffYearInvoices);

  // ── Profit by month ──────────────────────────────────────────────────────
  const importPriceMap: Record<number, number> = {};
  productServices.forEach((s: any) => { importPriceMap[s.id] = Number(s.importPrice); });

  const cogsMap = new Array(12).fill(0);
  yearCogsInvItems.forEach((item: any) => {
    if (!item.serviceId) return;
    const m = new Date(item.invoice.createdAt).getMonth();
    cogsMap[m] += (importPriceMap[item.serviceId] ?? 0) * item.quantity;
  });
  yearCogsDsItems.forEach((item: any) => {
    const m = new Date(item.sale.createdAt).getMonth();
    cogsMap[m] += (importPriceMap[item.serviceId] ?? 0) * item.quantity;
  });

  const salaryMap = new Array(12).fill(0);
  yearSalaryRecords.forEach((rec: any) => {
    salaryMap[rec.month - 1] += Number(rec.finalSalary);
  });

  const profitByMonth = LABELS.map((label: string, i: number) => ({
    month: i + 1,
    label,
    revenue: revenueByMonth[i].actual,
    salary: salaryMap[i],
    cogs: cogsMap[i],
    profit: revenueByMonth[i].actual - salaryMap[i] - cogsMap[i],
  }));

  // ── Top 10 courts this month ──────────────────────────────────────────────
  const courtRevMap: Record<number, { name: string; facilityName: string; total: number }> = {};
  monthCourtInvoices.forEach(inv => {
    const c = inv.booking.court;
    if (!courtRevMap[c.id]) courtRevMap[c.id] = { name: c.name, facilityName: c.facility.name, total: 0 };
    courtRevMap[c.id].total += Number(inv.finalTotal);
  });
  const topCourts = Object.values(courtRevMap).sort((a, b) => b.total - a.total).slice(0, 10);

  return NextResponse.json({
    facilityCount: facilities.length,
    staffCount,
    currentRevenue,
    prevRevenue,
    revenueChange:   Math.round(revenueChange   * 100) / 100,
    currentBookings: curBookings,
    prevBookings,
    bookingsChange:  Math.round(bookingsChange  * 100) / 100,
    currentCustomers,
    prevCustomers,
    customersChange: Math.round(customersChange * 100) / 100,
    currentItemsSold,
    prevItemsSold,
    itemsChange:     Math.round(itemsChange     * 100) / 100,
    planRevenue,
    planPercent,
    planNote,
    revenueByMonth,
    prevYearRevenueByMonth,
    bookingsByMonth,
    prevYearBookingsByMonth,
    customersByMonth,
    prevYearCustomersByMonth,
    revenueByFacility,
    topCourts,
    topStaff,
    topStaffYearly,
    topStaffQuarterly,
    profitByMonth,
  });
}
