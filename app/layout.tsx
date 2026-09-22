import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "ระบบจองห้องประชุม",
  description: "ระบบจองห้องประชุมรวมศูนย์",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th">
      <body className="bg-white text-gray-700">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
