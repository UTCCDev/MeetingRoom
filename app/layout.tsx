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
      <head>
        {/* Material Symbols Outlined — the DS icon set (design.md › Icons). */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=block"
        />
      </head>
      {/* Browser extensions (e.g. ColorZilla) inject attributes into <body>. */}
      <body className="bg-white text-ink-muted" suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
