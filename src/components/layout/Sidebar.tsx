"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/routing";
import { signOut } from "next-auth/react";
import {
  Link2,
  FileText,
  BarChart3,
  Settings,
  Users,
  ClipboardList,
  LogOut,
  Menu,
  X,
  Zap,
  Megaphone,
} from "lucide-react";
import { useState } from "react";
import { WorkspaceSwitcher } from "../workspace/WorkspaceSwitcher";

interface NavItem {
  href: string;
  labelKey: string;
  icon: React.ReactNode;
  roles?: string[];
}

interface SidebarProps {
  userRole: string;
  userName?: string | null;
  userImage?: string | null;
}

export function Sidebar({ userRole, userName, userImage }: SidebarProps) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems: NavItem[] = [
    { href: "/campaigns", labelKey: "campaigns", icon: <Megaphone size={15} /> },
    { href: "/links", labelKey: "links", icon: <Link2 size={15} /> },
    { href: "/analytics", labelKey: "analytics", icon: <BarChart3 size={15} /> },
    { href: "/templates", labelKey: "templates", icon: <FileText size={15} /> },
    { href: "/users", labelKey: "users", icon: <Users size={15} />, roles: ["ADMIN"] },
    {
      href: "/audit-log",
      labelKey: "auditLog",
      icon: <ClipboardList size={15} />,
      roles: ["ADMIN", "MANAGER"],
    },
  ];

  const filteredItems = navItems.filter(
    (item) => !item.roles || item.roles.includes(userRole),
  );

  const initials = (userName || "U")
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const NavContent = () => (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">
          <Zap size={18} />
        </div>
        <div className="brand-text">
          <div className="brand-name">EnGenius ShortLink</div>
          <div className="brand-sub">UTM Manager</div>
        </div>
      </div>

      <WorkspaceSwitcher />

      <div className="menu-label">{t("menu")}</div>
      {filteredItems.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`nav-item ${isActive ? "active" : ""}`}
            onClick={() => setMobileOpen(false)}
          >
            {item.icon}
            <span>{t(item.labelKey)}</span>
          </Link>
        );
      })}

      <div className="sidebar-foot">
        <div className="user-card">
          {userImage ? (
            <img
              src={userImage}
              alt={userName || "User"}
              className="user-avatar"
              style={{ backgroundImage: "none", background: "transparent" }}
            />
          ) : (
            <div className="user-avatar">{initials}</div>
          )}
          <div style={{ flex: 1, lineHeight: 1.2, minWidth: 0 }}>
            <div className="user-name" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {userName}
            </div>
            <div className="user-role" style={{ textTransform: "capitalize" }}>
              {userRole.toLowerCase()}
            </div>
          </div>
        </div>
        <Link
          href="/settings"
          className={`nav-item ${pathname === "/settings" ? "active" : ""}`}
          onClick={() => setMobileOpen(false)}
        >
          <Settings size={14} />
          <span>{t("settings")}</span>
        </Link>
        <button
          onClick={() => signOut({ callbackUrl: "/auth/signin" })}
          className="nav-item"
        >
          <LogOut size={14} />
          <span>{t("signOut")}</span>
        </button>
      </div>
    </aside>
  );

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white text-slate-600 rounded-lg shadow-sm border"
        style={{ borderColor: "var(--border)" }}
      >
        <Menu className="w-5 h-5" />
      </button>

      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <div
        className={`lg:hidden fixed inset-y-0 left-0 w-[260px] z-50 transform transition-transform duration-300 ease-out ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-lg z-10"
        >
          <X className="w-5 h-5" />
        </button>
        <NavContent />
      </div>

      <div className="hidden lg:block lg:w-[260px] lg:fixed lg:inset-y-0">
        <NavContent />
      </div>
    </>
  );
}
