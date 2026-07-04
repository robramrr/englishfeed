import type { Metadata } from "next";
import Script from "next/script";
import { Geist, Geist_Mono } from "next/font/google";
import { AppChrome } from "@/components/AppChrome";
import { AuthProvider } from "@/lib/AuthContext";
import { LevelFilterProvider } from "@/lib/LevelFilterContext";
import { ENGLISHFEED_FAVICON_URL } from "@/lib/brand";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "EnglishFeed – Learn English in short lessons",
  description: "TikTok-style vertical feed of short English lessons.",
  icons: {
    icon: [{ url: ENGLISHFEED_FAVICON_URL, type: "image/png" }],
    shortcut: ENGLISHFEED_FAVICON_URL,
    apple: ENGLISHFEED_FAVICON_URL,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <AuthProvider>
          <LevelFilterProvider>
            <AppChrome>
            <div
              className="flex min-h-screen flex-col"
              suppressHydrationWarning
            >
              <main className="min-h-[calc(100dvh-var(--header-height))] min-w-0 overflow-hidden bg-black">
                {children}
              </main>
            </div>
            </AppChrome>
          </LevelFilterProvider>
        </AuthProvider>
        <Script id="strip-extension-attrs" strategy="beforeInteractive">
          {`(function(){var ATTRS=['bis_skin_checked','bis_register'];function strip(){ATTRS.forEach(function(n){try{document.querySelectorAll('['+n+']').forEach(function(el){el.removeAttribute(n);});}catch(e){}});}strip();if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',strip);var t0=Date.now();var mo=new MutationObserver(function(){strip();if(Date.now()-t0>8000)mo.disconnect();});try{mo.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:ATTRS});}catch(e){mo.disconnect();}})();`}
        </Script>
      </body>
    </html>
  );
}
