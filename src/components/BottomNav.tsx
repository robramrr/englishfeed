"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Upload,
  MessageCircle,
  User,
} from "lucide-react";

const iconClass = "h-5 w-5 shrink-0 stroke-[2.5] subpixel-antialiased";

const navItems: {
  href: string | null;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  disabled?: boolean;
}[] = [
  { href: "/", label: "Home", icon: Home },
  { href: null, label: "Upload", icon: Upload, disabled: true },
  { href: "/inbox", label: "Inbox", icon: MessageCircle },
  { href: "/profile", label: "Profile", icon: User },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 rounded-none border-2 border-black bg-black text-white shadow-[3px_3px_0px_black] pb-[env(safe-area-inset-bottom)] subpixel-antialiased"
      style={{ height: "calc(4rem + env(safe-area-inset-bottom, 0px))" }}
      aria-label="Main navigation"
      suppressHydrationWarning
    >
      <div className="flex h-16 items-center justify-around" suppressHydrationWarning>
        {navItems.map((item) => {
          const isActive = item.href !== null && pathname === item.href;
          const Icon = item.icon;
          if (item.disabled || item.href === null) {
            return (
              <span
                key={item.label}
                className="flex min-w-[56px] flex-col items-center gap-0.5 rounded-none border-2 border-black bg-black px-2 py-1.5 text-white shadow-[3px_3px_0px_black] cursor-not-allowed opacity-70"
                aria-disabled="true"
                title="Coming soon"
              >
                <span aria-hidden>
                  <Icon className={iconClass} />
                </span>
                <span className="text-[11px] font-normal leading-none tracking-[0.01em] text-white subpixel-antialiased">
                  {item.label}
                </span>
              </span>
            );
          }
          return (
            <Link
              key={item.label}
              href={item.href}
              className="flex min-w-[56px] flex-col items-center gap-0.5 rounded-none border-2 border-black bg-black px-2 py-1.5 text-white shadow-[3px_3px_0px_black] transition hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none active:scale-95 active:shadow-none"
              aria-current={isActive ? "page" : undefined}
            >
              <span aria-hidden>
                <Icon className={iconClass} />
              </span>
              <span className="text-[11px] font-normal leading-none tracking-[0.01em] text-white subpixel-antialiased">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
