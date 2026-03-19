import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import crypto from "crypto";
import { format } from "date-fns";

function sortObject(obj: Record<string, string>) {
  return Object.keys(obj).sort().reduce((result: Record<string, string>, key) => {
    result[key] = obj[key];
    return result;
  }, {});
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

    const { amount, orderInfo, bookingData } = await req.json();
    if (!amount || amount < 1000) return NextResponse.json({ error: "Số tiền tối thiểu 1.000đ" }, { status: 400 });

    const tmnCode = process.env.VNPAY_TMN_CODE!;
    const secretKey = process.env.VNPAY_HASH_SECRET!;
    const vnpUrl = process.env.VNPAY_URL!;
    const returnUrl = process.env.VNPAY_RETURN_URL!;

    const date = new Date();
    const createDate = format(date, "yyyyMMddHHmmss");
    const txnRef = format(date, "HHmmss");

    // Lưu bookingData vào returnUrl params
    const encodedBooking = Buffer.from(JSON.stringify({
      ...bookingData,
      userId: (session.user as any).id,
    })).toString("base64");

    const vnpParams: Record<string, string> = {
      vnp_Version: "2.1.0",
      vnp_Command: "pay",
      vnp_TmnCode: tmnCode,
      vnp_Locale: "vn",
      vnp_CurrCode: "VND",
      vnp_TxnRef: txnRef,
      vnp_OrderInfo: orderInfo || "Thanh toan dat san SportHub",
      vnp_OrderType: "other",
      vnp_Amount: String(amount * 100),
      vnp_ReturnUrl: `${returnUrl}?booking=${encodedBooking}`,
      vnp_IpAddr: "127.0.0.1",
      vnp_CreateDate: createDate,
    };

    const sortedParams = sortObject(vnpParams);
    const signData = new URLSearchParams(sortedParams).toString();
    const hmac = crypto.createHmac("sha512", secretKey);
    const signed = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");

    sortedParams["vnp_SecureHash"] = signed;

    const payUrl = `${vnpUrl}?${new URLSearchParams(sortedParams).toString()}`;

    return NextResponse.json({ payUrl });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}