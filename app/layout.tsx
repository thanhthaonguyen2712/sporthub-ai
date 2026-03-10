import type { Metadata } from "next";
import "./globals.css";
import { SessionProvider } from "./providers";

export const metadata: Metadata = {
  title: "SportHub AI",
  description: "Nền tảng đặt sân thể thao thông minh",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body><SessionProvider>{children}</SessionProvider>
        </body>
    </html>
  );
}