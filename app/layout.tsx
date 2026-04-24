import type { Metadata, Viewport } from "next";
import { Lora, DM_Sans } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "./components/AuthProvider";

const lora = Lora({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500"],
  style: ["normal", "italic"],
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

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${lora.variable} ${dmSans.variable}`} suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{if(localStorage.getItem('hanzidict-dark')==='true')document.documentElement.classList.add('dark')}catch(e){}})()` }} />
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var s=localStorage.getItem('hanzidict-script');if(s)document.documentElement.setAttribute('data-script',s)}catch(e){}})()` }} />
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
