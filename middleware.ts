import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const pathname = req.nextUrl.pathname;

    if (
      pathname.startsWith("/owner") &&
      token?.role !== "OWNER" &&
      token?.role !== "ADMIN"
    ) {
      return NextResponse.redirect(new URL("/", req.url));
    }

    if (
      pathname.startsWith("/staff") &&
      token?.role !== "STAFF" &&
      token?.role !== "WAREHOUSE_MANAGER" &&
      token?.role !== "ADMIN"
    ) {
      return NextResponse.redirect(new URL("/", req.url));
    }

    if (pathname.startsWith("/admin") && token?.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/", req.url));
    }

    // Nhân viên không có trang cá nhân/đặt sân của khách hàng
    const isStaffRole = token?.role === "STAFF" || token?.role === "WAREHOUSE_MANAGER";
    if (isStaffRole && (pathname.startsWith("/profile") || pathname.startsWith("/bookings"))) {
      return NextResponse.redirect(new URL("/staff/dashboard", req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  matcher: [
    "/profile/:path*",
    "/bookings/:path*",
    "/owner/:path*",
    "/staff/:path*",
    "/admin/:path*",
  ],
};