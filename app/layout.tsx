import type { Metadata } from "next";
import { Noto_Serif, DM_Sans } from "next/font/google";
import "./globals.css";

const notoSerif = Noto_Serif({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const dmSans = DM_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
});

export const metadata: Metadata = {
  title: "HanziDict — Chinese Dictionary",
  description: "Open source Chinese dictionary with 124,000 entries",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${notoSerif.variable} ${dmSans.variable}`}>
      <body>{children}</body>
    </html>
  );
}