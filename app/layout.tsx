import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible, Fraunces } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-fraunces", display: "swap" });
const atkinson = Atkinson_Hyperlegible({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-atkinson", display: "swap" });

export const metadata: Metadata = {
  title: { default: "MedLens: medicine labels in plain words", template: "%s · MedLens" },
  description: "Scan a medicine box and get the label explained in plain language, with voice mode. MedLens never replaces your doctor or pharmacist.",
  applicationName: "MedLens",
  appleWebApp: { capable: true, title: "MedLens", statusBarStyle: "default" },
  icons: { icon: "/icon.svg", apple: "/icon-192.png" },
};

export const viewport: Viewport = { themeColor: "#0B5C5C", width: "device-width", initialScale: 1 };

// Applies saved text size / contrast before first paint to avoid a flash.
const initScript = `try{var d=JSON.parse(localStorage.getItem("medlens:v1")||"{}").settings||{};var h=document.documentElement;h.dataset.size=String(d.textSize||2);h.dataset.contrast=d.highContrast?"high":"normal";if(d.language)h.lang=d.language}catch(e){}`;
const swScript = `if("serviceWorker" in navigator){window.addEventListener("load",function(){navigator.serviceWorker.register("/sw.js").catch(function(){})})}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-size="2" className={`${fraunces.variable} ${atkinson.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: initScript }} />
        {process.env.NODE_ENV === "production" && <script dangerouslySetInnerHTML={{ __html: swScript }} />}
      </head>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
