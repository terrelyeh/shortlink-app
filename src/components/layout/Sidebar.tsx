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
} from "lucide-react";
import { useState } from "react";
import { LanguageSwitcher } from "./LanguageSwitcher";

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
    {
      href: "/settings",
      labelKey: "settings",
      icon: <Settings className="w-5 h-5" />,
    },
  ];

  const filteredItems = navItems.filter(
    (item) => !item.roles || item.roles.includes(userRole)
  );

  const NavContent = () => (
    <>
      <div className="p-4 border-b border-gray-200">
        <h1 className="text-xl font-bold text-gray-900">ShortLink</h1>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {filteredItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                isActive
                  ? "bg-blue-50 text-blue-700"
                  : "text-gray-700 hover:bg-gray-100"
              }`}
              onClick={() => setMobileOpen(false)}
            >
              {item.icon}
              <span>{t(item.labelKey)}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-gray-200">
        <div className="mb-3">
          <LanguageSwitcher />
        </div>
        <div className="flex items-center gap-3 mb-3">
          {userImage ? (
            <img
              src={userImage}
              alt={userName || "User"}
              className="w-8 h-8 rounded-full"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center">
              <span className="text-sm font-medium text-gray-600">
                {userName?.charAt(0) || "U"}
              </span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {userName}
            </p>
            <p className="text-xs text-gray-500 capitalize">
              {userRole.toLowerCase()}
            </p>
          </div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/auth/signin" })}
          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span>{t("signOut") || "Sign Out"}</span>
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white rounded-lg shadow-md"
      >
        <Menu className="w-6 h-6" />
      </button>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={`lg:hidden fixed inset-y-0 left-0 w-64 bg-white z-50 transform transition-transform ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute top-4 right-4"
        >
          <X className="w-6 h-6" />
        </button>
        <div className="flex flex-col h-full">
          <NavContent />
        </div>
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-white border-r border-gray-200">
        <NavContent />
      </aside>
    </>
  );
}
