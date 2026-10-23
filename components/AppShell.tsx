"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "./Icon";
import { Logo } from "./Logo";
import { TextSizeControl, Toggle } from "./ui";
import { updateSettings, useAppData } from "@/lib/store";

const NAV: { href: string; label: string; short: string; icon: IconName }[] = [
  { href: "/dashboard", label: "Home", short: "Home", icon: "home" },
  { href: "/scan", label: "Scan", short: "Scan", icon: "scan" },
  { href: "/medicines", label: "My medicines", short: "Medicines", icon: "pill" },
  { href: "/checker", label: "Product checker", short: "Check", icon: "shield" },
  { href: "/settings", label: "Settings", short: "Settings", icon: "gear" },
];

// Flows with their own bottom controls hide the phone tab bar.
const FLOW_ROUTES = ["/scan", "/checker"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { settings } = useAppData();
  const isActive = (href: string) => path === href || path.startsWith(href + "/");
  const showTabs = !FLOW_ROUTES.some((r) => isActive(r));

  return (
    <div className={`min-h-dvh nav:pl-[264px] ${showTabs ? "[--tabbar-offset:96px] nav:[--tabbar-offset:0px]" : ""}`}>
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[264px] flex-col border-r border-line bg-white px-5 py-6 nav:flex">
        <Link href="/" aria-label="MedLens home" className="px-2">
          <Logo size={38} />
        </Link>
        <nav className="mt-8 flex flex-col gap-1.5" aria-label="App">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              aria-current={isActive(n.href) ? "page" : undefined}
              className={`flex min-h-12 items-center gap-3 rounded-full px-4 font-bold ${
                isActive(n.href) ? "bg-mint-1 text-teal" : "text-ink hover:bg-mint-2"
              }`}
            >
              <Icon name={n.icon} />
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto rounded-[22px] bg-mint-1 p-4">
          <Toggle checked={settings.voiceMode} onChange={(v) => updateSettings({ voiceMode: v })} label="Voice mode" />
          <p className="mb-2 mt-3 text-[0.88rem] font-bold text-muted">Text size</p>
          <TextSizeControl compact />
        </div>
      </aside>

      <div className={`mx-auto w-full max-w-[1100px] px-4 pt-5 sm:px-6 nav:px-10 nav:pt-8 ${showTabs ? "pb-32 nav:pb-12" : "pb-12"}`}>{children}</div>

      {/* Phone bottom tab bar */}
      {showTabs && (
        <nav aria-label="App" className="glass fixed inset-x-3 bottom-3 z-40 rounded-[28px] bg-white/95 px-2 pb-[max(0.4rem,env(safe-area-inset-bottom))] pt-1.5 nav:hidden">
          <ul className="grid grid-cols-5 items-end">
            {[NAV[0], NAV[2], NAV[1], NAV[3], NAV[4]].map((n) =>
              n.href === "/scan" ? (
                <li key={n.href} className="flex justify-center">
                  <Link
                    href="/scan"
                    aria-label="Scan a medicine"
                    className="-mt-8 grid size-16 place-items-center rounded-full bg-teal text-white shadow-[0_8px_20px_rgba(11,92,92,0.3)] ring-[6px] ring-paper"
                  >
                    <Icon name="scan" size={28} />
                  </Link>
                </li>
              ) : (
                <li key={n.href}>
                  <Link
                    href={n.href}
                    aria-current={isActive(n.href) ? "page" : undefined}
                    className={`flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-2xl text-[0.72rem] font-bold ${
                      isActive(n.href) ? "text-teal" : "text-muted"
                    }`}
                  >
                    <span className={`grid h-8 w-12 place-items-center rounded-full ${isActive(n.href) ? "bg-mint-1" : ""}`}>
                      <Icon name={n.icon} />
                    </span>
                    {n.short}
                  </Link>
                </li>
              ),
            )}
          </ul>
        </nav>
      )}
    </div>
  );
}
