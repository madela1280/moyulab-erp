import "./globals.css";
import { ReactNode } from "react";

export const metadata = {
  title: "Moulab ERP",
  description: "모유랩 ERP 시스템",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  // ✅ hydration mismatch 방지: React 클라이언트 환경 확실히 지정
  if (typeof window === "undefined") {
    // 서버일 때는 간단한 placeholder만 리턴
    return (
      <html lang="ko">
        <body className="bg-gray-100">{children}</body>
      </html>
    );
  }

  return (
    <html lang="ko" suppressHydrationWarning>
      <body className="min-h-screen bg-gray-100">{children}</body>
    </html>
  );
}

