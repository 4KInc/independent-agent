"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Shield, ExternalLink, Sun, Moon, Monitor } from "lucide-react";
import { usePathname } from "next/navigation";

function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark" | "system">("system");
  useEffect(() => { const s = localStorage.getItem("theme") as any; if (s) setTheme(s); }, []);
  useEffect(() => {
    const root = document.documentElement; root.classList.remove("light", "dark");
    if (theme === "system") root.classList.add(window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    else root.classList.add(theme);
    localStorage.setItem("theme", theme);
  }, [theme]);
  const next = theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
  const Icon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;
  return <Button variant="ghost" size="sm" onClick={() => setTheme(next)} className="h-8 w-8 p-0"><Icon className="w-4 h-4" /></Button>;
}

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/agents", label: "Agents" },
  { href: "/resources", label: "Resources" },
  { href: "/actions", label: "Actions" },
  { href: "/policies", label: "Policies" },
  { href: "/integrations", label: "API" },
];

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
      <div className="max-w-[1440px] mx-auto flex items-center h-14 px-6 gap-4">
        <Shield className="w-5 h-5 text-primary" />
        <span className="font-semibold text-sm">Gate</span>
        <span className="text-xs text-muted-foreground hidden sm:inline">Cryptographic Governance for AI Agents</span>
        <Separator orientation="vertical" className="h-5 mx-1" />
        {NAV_ITEMS.map(({ href, label }) => (
          <a
            key={href}
            href={href}
            className={`text-sm transition-colors ${
              pathname === href
                ? "font-medium text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </a>
        ))}
        <div className="flex-1" />
        <ThemeToggle />
        <a href="https://github.com/4KInc/agent-authorization-gateway" target="_blank" rel="noopener" className="text-muted-foreground hover:text-foreground transition-colors"><ExternalLink className="w-4 h-4" /></a>
      </div>
    </header>
  );
}
