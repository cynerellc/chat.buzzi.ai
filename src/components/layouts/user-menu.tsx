"use client";

import { LogOut, Settings, User } from "lucide-react";
import { useRouter, usePathname } from "next/navigation";
import { type Key } from "react";

import { useAuth } from "@/hooks/useAuth";
import { getRoleDisplayName } from "@/lib/auth/role-utils";

import { Dropdown, UserAvatar, type DropdownMenuSectionData } from "../ui";

/**
 * Get the profile page URL based on the current route context
 */
function getProfileUrl(pathname: string, isMasterAdmin: boolean): string {
  // Master admin routes
  if (isMasterAdmin || pathname.startsWith("/admin")) {
    return "/admin/profile";
  }

  // Support agent routes
  if (
    pathname.startsWith("/inbox") ||
    pathname.startsWith("/customers") ||
    pathname.startsWith("/responses") ||
    pathname.startsWith("/agent-settings")
  ) {
    return "/inbox/profile";
  }

  // Default to company admin profile
  return "/dashboard/profile";
}

export function UserMenu() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  if (!user) return null;

  const sections: DropdownMenuSectionData[] = [
    {
      key: "profile",
      items: [
        {
          key: "profile",
          label: "My Profile",
          icon: User,
        },
        {
          key: "settings",
          label: "Settings",
          icon: Settings,
        },
      ],
    },
    {
      key: "actions",
      showDivider: true,
      items: [
        {
          key: "logout",
          label: "Sign Out",
          icon: LogOut,
          isDanger: true,
        },
      ],
    },
  ];

  const isMasterAdmin = user.role === "chatapp.master_admin";

  const handleAction = (key: Key) => {
    switch (key) {
      case "logout":
        logout();
        break;
      case "profile":
        router.push(getProfileUrl(pathname, isMasterAdmin));
        break;
      case "settings":
        // Navigate to settings (TODO: implement settings page)
        break;
    }
  };

  return (
    <Dropdown
      sections={sections}
      onAction={handleAction}
      trigger={
        <button className="flex items-center gap-2 p-1 rounded-lg hover:bg-default-100 transition-colors">
          <UserAvatar
            name={user.name}
            src={user.avatarUrl ?? undefined}
            size="sm"
          />
          <div className="hidden md:block text-left">
            <p className="text-sm font-medium">{user.name}</p>
            <p className="text-xs text-default-500">{getRoleDisplayName(user.role)}</p>
          </div>
        </button>
      }
    />
  );
}
