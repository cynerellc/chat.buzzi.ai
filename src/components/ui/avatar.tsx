"use client";

import * as AvatarPrimitive from "@radix-ui/react-avatar";
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from "react";

import { cn } from "@/lib/utils";

const AvatarRoot = forwardRef<
  ElementRef<typeof AvatarPrimitive.Root>,
  ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Root
    ref={ref}
    className={cn("relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full", className)}
    {...props}
  />
));
AvatarRoot.displayName = AvatarPrimitive.Root.displayName;

const AvatarImage = forwardRef<
  ElementRef<typeof AvatarPrimitive.Image>,
  ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Image
    ref={ref}
    className={cn("aspect-square h-full w-full", className)}
    {...props}
  />
));
AvatarImage.displayName = AvatarPrimitive.Image.displayName;

const AvatarFallback = forwardRef<
  ElementRef<typeof AvatarPrimitive.Fallback>,
  ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Fallback
    ref={ref}
    className={cn(
      "flex h-full w-full items-center justify-center rounded-full bg-muted text-sm font-medium",
      className
    )}
    {...props}
  />
));
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName;

// Legacy wrapper types
export interface AvatarProps {
  src?: string;
  name?: string;
  alt?: string;
  size?: "sm" | "md" | "lg" | "xl";
  status?: "online" | "offline" | "away" | "busy";
  showStatus?: boolean;
  showFallback?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-base",
  xl: "h-20 w-20 text-lg",
};

const statusColors: Record<NonNullable<AvatarProps["status"]>, string> = {
  online: "bg-success",
  offline: "bg-muted-foreground",
  away: "bg-warning",
  busy: "bg-destructive",
};

const statusSizes = {
  sm: "w-2 h-2",
  md: "w-3 h-3",
  lg: "w-3.5 h-3.5",
  xl: "w-4 h-4",
};

export function Avatar({
  src,
  name,
  alt,
  size = "md",
  status,
  showStatus = false,
  showFallback = true,
  className,
}: AvatarProps) {
  const initials = name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="relative inline-block">
      <AvatarRoot className={cn(sizeClasses[size], className)}>
        {src && <AvatarImage src={src} alt={alt || name || "Avatar"} />}
        {showFallback && (
          <AvatarFallback>{initials || name?.charAt(0)?.toUpperCase() || "?"}</AvatarFallback>
        )}
      </AvatarRoot>
      {showStatus && status && (
        <span
          className={cn(
            "absolute bottom-0 right-0 rounded-full border-2 border-background",
            statusColors[status],
            statusSizes[size]
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
  return (
    <div className="flex items-center gap-3">
      <Avatar
        src={src}
        name={name ?? undefined}
        showFallback
        className={className}
        {...props}
      />
      {showInfo && (
        <div className="flex flex-col">
          {name && <span className="text-sm font-medium">{name}</span>}
          {email && <span className="text-xs text-muted-foreground">{email}</span>}
        </div>
      )}
    </div>
  );
}

// Avatar group with +N indicator
export interface AvatarGroupProps {
  avatars: Array<{ src?: string; name?: string }>;
  max?: number;
  size?: AvatarProps["size"];
  className?: string;
}

export function AvatarGroup({ avatars, max = 3, size = "sm", className }: AvatarGroupProps) {
  const visibleAvatars = avatars.slice(0, max);
  const remaining = avatars.length - max;

  return (
    <div className={cn("flex -space-x-2", className)}>
      {visibleAvatars.map((avatar, index) => (
        <Avatar
          key={index}
          src={avatar.src}
          name={avatar.name}
          size={size}
          showFallback
          className="ring-2 ring-background"
        />
      ))}
      {remaining > 0 && (
        <div
          className={cn(
            "flex items-center justify-center rounded-full bg-muted ring-2 ring-background",
            sizeClasses[size]
          )}
        >
          <span className="text-xs font-medium">+{remaining}</span>
        </div>
      )}
    </div>
  );
}

// Export primitives
export { AvatarRoot, AvatarImage, AvatarFallback };
