import type { Metadata, Viewport } from "next";
import { Lora, DM_Sans } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { AuthProvider } from "./components/AuthProvider";
import MobilePremiumBanner from "./components/MobilePremiumBanner";

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
  title: 'HanziDict — Chinese Dictionary',
  description: 'Free Chinese dictionary with 124,000 entries, stroke order animations, and example sentences. HSK 1-9 word tagging with flashcards for every level. Search by character, pinyin, or English.',
  keywords: 'Chinese dictionary, Mandarin, HSK, pinyin, hanzi, stroke order, flashcards, CC-CEDICT',
  openGraph: {
    title: 'HanziDict — Chinese Dictionary',
    description: 'Free Chinese dictionary with 124,000 entries, stroke order animations, and example sentences. HSK 1-9 word tagging with flashcards for every level. Search by character, pinyin, or English.',
    url: 'https://hanzidict.vercel.app',
    siteName: 'HanziDict',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'HanziDict — Chinese Dictionary',
    description: 'Free Chinese dictionary with 124,000 entries, stroke order animations, and example sentences. HSK 1-9 word tagging with flashcards for every level. Search by character, pinyin, or English.',
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: '/icon-192.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#faf9f6' },
    { media: '(prefers-color-scheme: dark)',  color: '#171614' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${lora.variable} ${dmSans.variable}`} suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{if(localStorage.getItem('hanzidict-dark')==='true')document.documentElement.classList.add('dark')}catch(e){}})()` }} />
        <script dangerouslySetInnerHTML={{ __html: `if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js',{scope:'/'})})}`}} />
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var s=localStorage.getItem('hanzidict-script');if(s)document.documentElement.setAttribute('data-script',s)}catch(e){}})()` }} />
        <AuthProvider>
          {children}
          <MobilePremiumBanner />
        </AuthProvider>
        {process.env.NEXT_PUBLIC_META_PIXEL_ID && (
          <Script
            id="meta-pixel"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `
                !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){
                n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};
                if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
                n.queue=[];t=b.createElement(e);t.async=!0;
                t.src=v;s=b.getElementsByTagName(e)[0];
                s.parentNode.insertBefore(t,s)}(window,document,'script',
                'https://connect.facebook.net/en_US/fbevents.js');
                fbq('init','${process.env.NEXT_PUBLIC_META_PIXEL_ID}');
                fbq('track','PageView');
              `,
            }}
          />
        )}
      </body>
    </html>
  );
}
