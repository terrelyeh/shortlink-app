"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/routing";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
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
    {
      href: "/dashboard",
      labelKey: "dashboard",
      icon: <LayoutDashboard className="w-5 h-5" />,
    },
    {
      href: "/links",
      labelKey: "links",
      icon: <Link2 className="w-5 h-5" />,
    },
    {
      href: "/campaigns",
      labelKey: "campaigns",
      icon: <Megaphone className="w-5 h-5" />,
    },
    {
      href: "/templates",
      labelKey: "templates",
      icon: <FileText className="w-5 h-5" />,
    },
    {
      href: "/analytics",
      labelKey: "analytics",
      icon: <BarChart3 className="w-5 h-5" />,
    },
    {
      href: "/users",
      labelKey: "users",
      icon: <Users className="w-5 h-5" />,
      roles: ["ADMIN"],
    },
    {
      href: "/audit-log",
      labelKey: "auditLog",
      icon: <ClipboardList className="w-5 h-5" />,
      roles: ["ADMIN", "MANAGER"],
    },
  ];

  const filteredItems = navItems.filter(
    (item) => !item.roles || item.roles.includes(userRole)
  );

  const NavContent = () => (
    <div className="flex flex-col h-full bg-slate-800">
      {/* Logo */}
      <div className="p-6 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-[#03A9F4] rounded-lg flex items-center justify-center">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white">EnGenius ShortLink</h1>
            <p className="text-xs text-slate-400">UTM Manager</p>
          </div>
        </div>
      </div>

      {/* Workspace Switcher */}
      <div className="px-4 pb-4">
        <WorkspaceSwitcher />
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 pb-4 space-y-0.5">
        <p className="px-3 py-2 text-xs font-medium text-slate-500 uppercase tracking-wider">
          {t("menu")}
        </p>
        {filteredItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                isActive
                  ? "bg-slate-700 text-white font-medium"
                  : "text-slate-300 hover:text-white hover:bg-slate-700/50"
              }`}
              onClick={() => setMobileOpen(false)}
            >
              <span className={isActive ? "text-[#03A9F4]" : "text-slate-400"}>
                {item.icon}
              </span>
              <span>{t(item.labelKey)}</span>
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="p-4 border-t border-slate-700">
        <div className="flex items-center gap-3 p-2 bg-slate-700/50 rounded-lg">
          {userImage ? (
            <img
              src={userImage}
              alt={userName || "User"}
              className="w-9 h-9 rounded-lg object-cover"
            />
          ) : (
            <div className="w-9 h-9 rounded-lg bg-slate-600 flex items-center justify-center">
              <span className="text-sm font-medium text-slate-300">
                {userName?.charAt(0)?.toUpperCase() || "U"}
              </span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">
              {userName}
            </p>
            <p className="text-xs text-slate-400 capitalize">
              {userRole.toLowerCase()}
            </p>
          </div>
        </div>
        <Link
          href="/settings"
          className={`flex items-center gap-2 w-full mt-2 px-3 py-2 text-sm rounded-lg transition-colors ${
            pathname === "/settings"
              ? "text-white bg-slate-700"
              : "text-slate-400 hover:text-white hover:bg-slate-700/50"
          }`}
          onClick={() => setMobileOpen(false)}
        >
          <Settings className="w-4 h-4" />
          <span>{t("settings")}</span>
        </Link>
        <button
          onClick={() => signOut({ callbackUrl: "/auth/signin" })}
          className="flex items-center gap-2 w-full mt-1 px-3 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span>{t("signOut")}</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white text-slate-600 rounded-lg shadow-sm border border-slate-200"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={`lg:hidden fixed inset-y-0 left-0 w-72 z-50 transform transition-transform duration-300 ease-out ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700 transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>
        <NavContent />
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden lg:block lg:w-64 lg:fixed lg:inset-y-0">
        <NavContent />
      </aside>
    </>
  );
}
