import type { Metadata } from "next";
import { Cairo, Amiri } from "next/font/google";
import NextTopLoader from "nextjs-toploader";
import "./globals.css";

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-cairo",
  display: "swap",
});

const amiri = Amiri({
  subsets: ["arabic", "latin"],
  weight: ["400", "700"],
  variable: "--font-amiri",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ألبان وأجبان القصر",
  description: "مصنع ألبان وأجبان القصر — إدارة الطلبات والحسابات",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={`${cairo.variable} ${amiri.variable}`}>
      <body className="font-sans">
        <NextTopLoader
          color="#2d8659"
          height={3}
          showSpinner={false}
          shadow="0 0 8px #2d8659, 0 0 4px #2d8659"
        />
        {children}
      </body>
    </html>
  );
}
