"use client";

import {
  Dropdown as HeroDropdown,
  DropdownTrigger as HeroDropdownTrigger,
  DropdownMenu as HeroDropdownMenu,
  DropdownItem as HeroDropdownItem,
  DropdownSection as HeroDropdownSection,
  type DropdownProps as HeroDropdownProps,
  type DropdownMenuProps,
} from "@heroui/react";
import { type LucideIcon } from "lucide-react";
import { type Key, type ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface DropdownMenuItem {
  key: string;
  label: string;
  description?: string;
  icon?: LucideIcon;
  shortcut?: string;
  isDanger?: boolean;
  isDisabled?: boolean;
  href?: string;
}

export interface DropdownMenuSection {
  key: string;
  title?: string;
  items: DropdownMenuItem[];
  showDivider?: boolean;
}

export interface DropdownProps extends Omit<HeroDropdownProps, "children" | "trigger"> {
  trigger: ReactNode;
  items?: DropdownMenuItem[];
  sections?: DropdownMenuSection[];
  onAction?: (key: Key) => void;
  menuProps?: Partial<DropdownMenuProps>;
}

export function Dropdown({
  trigger,
  items,
  sections,
  onAction,
  menuProps,
  className,
  ...props
}: DropdownProps) {
  const renderItem = (item: DropdownMenuItem) => (
    <HeroDropdownItem
      key={item.key}
      description={item.description}
      startContent={item.icon && <item.icon size={16} />}
      shortcut={item.shortcut}
      className={cn(item.isDanger && "text-danger")}
      color={item.isDanger ? "danger" : "default"}
      isDisabled={item.isDisabled}
      href={item.href}
    >
      {item.label}
    </HeroDropdownItem>
  );

  return (
    <HeroDropdown className={cn(className)} {...props}>
      <HeroDropdownTrigger>{trigger}</HeroDropdownTrigger>
      <HeroDropdownMenu
        aria-label="Actions"
        onAction={onAction}
        {...menuProps}
      >
        {sections ? (
          sections.map((section) => (
            <HeroDropdownSection
              key={section.key}
              title={section.title}
              showDivider={section.showDivider}
            >
              {section.items.map(renderItem)}
            </HeroDropdownSection>
          ))
        ) : (
          items?.map(renderItem) ?? []
        )}
      </HeroDropdownMenu>
    </HeroDropdown>
  );
}

export {
  HeroDropdownTrigger as DropdownTrigger,
  HeroDropdownMenu as DropdownMenu,
  HeroDropdownItem as DropdownItem,
  HeroDropdownSection as DropdownSection,
};
