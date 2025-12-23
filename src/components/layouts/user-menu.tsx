"use client";

import { LogOut, Settings, User } from "lucide-react";
import { type Key } from "react";

import { useAuth } from "@/hooks/useAuth";
import { getRoleDisplayName } from "@/lib/auth/role-utils";

import { Dropdown, UserAvatar, type DropdownMenuSection } from "../ui";

export function UserMenu() {
  const { user, logout } = useAuth();

  if (!user) return null;

  const sections: DropdownMenuSection[] = [
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

  const handleAction = (key: Key) => {
    switch (key) {
      case "logout":
        logout();
        break;
      case "profile":
        // Navigate to profile
        break;
      case "settings":
        // Navigate to settings
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
            src={user.image ?? undefined}
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
