"use client";

import { Avatar as HeroAvatar, AvatarGroup as HeroAvatarGroup, type AvatarProps as HeroAvatarProps } from "@heroui/react";

import { cn } from "@/lib/utils";

export interface AvatarProps extends Omit<HeroAvatarProps, "ref"> {
  status?: "online" | "offline" | "away" | "busy";
  showStatus?: boolean;
}

const statusColors: Record<NonNullable<AvatarProps["status"]>, string> = {
  online: "bg-success",
  offline: "bg-default-400",
  away: "bg-warning",
  busy: "bg-danger",
};

export function Avatar({ status, showStatus = false, className, ...props }: AvatarProps) {
  return (
    <div className="relative inline-block">
      <HeroAvatar className={cn(className)} {...props} />
      {showStatus && status && (
        <span
          className={cn(
            "absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-background",
            statusColors[status]
          )}
        />
      )}
    </div>
  );
}

// User avatar with name
export interface UserAvatarProps extends Omit<AvatarProps, "name"> {
  name?: string | null;
  email?: string | null;
  showInfo?: boolean;
}

export function UserAvatar({
  name,
  email,
  showInfo = false,
  src,
  className,
  ...props
}: UserAvatarProps) {
  const initials = name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="flex items-center gap-3">
      <Avatar
        src={src}
        name={initials}
        showFallback
        className={className}
        {...props}
      />
      {showInfo && (
        <div className="flex flex-col">
          {name && <span className="text-sm font-medium">{name}</span>}
          {email && <span className="text-xs text-default-500">{email}</span>}
        </div>
      )}
    </div>
  );
}

// Avatar group with +N indicator
export interface AvatarGroupProps {
  avatars: Array<{ src?: string; name?: string }>;
  max?: number;
  size?: HeroAvatarProps["size"];
  className?: string;
}

export function AvatarGroup({ avatars, max = 3, size = "sm", className }: AvatarGroupProps) {
  return (
    <HeroAvatarGroup max={max} size={size} className={className}>
      {avatars.map((avatar, index) => (
        <HeroAvatar
          key={index}
          src={avatar.src}
          name={avatar.name?.charAt(0).toUpperCase()}
          showFallback
        />
      ))}
    </HeroAvatarGroup>
  );
}
