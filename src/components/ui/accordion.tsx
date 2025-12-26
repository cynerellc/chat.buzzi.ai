"use client";

import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { ChevronDown } from "lucide-react";
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from "react";

import { cn } from "@/lib/utils";

const AccordionRoot = AccordionPrimitive.Root;

const AccordionItem = forwardRef<
  ElementRef<typeof AccordionPrimitive.Item>,
  ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>
>(({ className, ...props }, ref) => (
  <AccordionPrimitive.Item ref={ref} className={cn("border-b", className)} {...props} />
));
AccordionItem.displayName = "AccordionItem";

const AccordionTrigger = forwardRef<
  ElementRef<typeof AccordionPrimitive.Trigger>,
  ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Header className="flex">
    <AccordionPrimitive.Trigger
      ref={ref}
      className={cn(
        "flex flex-1 items-center justify-between py-4 font-medium transition-all hover:underline [&[data-state=open]>svg]:rotate-180",
        className
      )}
      {...props}
    >
      {children}
      <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200" />
    </AccordionPrimitive.Trigger>
  </AccordionPrimitive.Header>
));
AccordionTrigger.displayName = AccordionPrimitive.Trigger.displayName;

const AccordionContent = forwardRef<
  ElementRef<typeof AccordionPrimitive.Content>,
  ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Content
    ref={ref}
    className="overflow-hidden text-sm transition-all data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down"
    {...props}
  >
    <div className={cn("pb-4 pt-0", className)}>{children}</div>
  </AccordionPrimitive.Content>
));
AccordionContent.displayName = AccordionPrimitive.Content.displayName;

// Legacy wrapper types and component
export interface AccordionItemData {
  key: string;
  title: string;
  content: React.ReactNode;
  subtitle?: string;
  startContent?: React.ReactNode;
}

export interface AccordionProps {
  items: AccordionItemData[];
  type?: "single" | "multiple";
  defaultValue?: string | string[];
  className?: string;
  variant?: "default" | "bordered" | "light" | "shadow" | "splitted";
}

export function Accordion({
  items,
  type = "single",
  defaultValue,
  className,
  variant = "default",
}: AccordionProps) {
  const variantClasses = {
    default: "",
    bordered: "border rounded-md",
    light: "border-none",
    shadow: "shadow-md rounded-md",
    splitted: "space-y-2",
  };

  const itemClasses = {
    default: "",
    bordered: "border-0 last:border-0",
    light: "border-0",
    shadow: "border-0",
    splitted: "border rounded-md px-4",
  };

  if (type === "multiple") {
    return (
      <AccordionPrimitive.Root
        type="multiple"
        defaultValue={defaultValue as string[]}
        className={cn(variantClasses[variant], className)}
      >
        {items.map((item) => (
          <AccordionItem key={item.key} value={item.key} className={itemClasses[variant]}>
            <AccordionTrigger>
              <div className="flex items-center gap-2">
                {item.startContent}
                <div className="text-left">
                  <div>{item.title}</div>
                  {item.subtitle && (
                    <div className="text-sm text-muted-foreground font-normal">{item.subtitle}</div>
                  )}
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent>{item.content}</AccordionContent>
          </AccordionItem>
        ))}
      </AccordionPrimitive.Root>
    );
  }

  return (
    <AccordionPrimitive.Root
      type="single"
      defaultValue={defaultValue as string}
      collapsible
      className={cn(variantClasses[variant], className)}
    >
      {items.map((item) => (
        <AccordionItem key={item.key} value={item.key} className={itemClasses[variant]}>
          <AccordionTrigger>
            <div className="flex items-center gap-2">
              {item.startContent}
              <div className="text-left">
                <div>{item.title}</div>
                {item.subtitle && (
                  <div className="text-sm text-muted-foreground font-normal">{item.subtitle}</div>
                )}
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent>{item.content}</AccordionContent>
        </AccordionItem>
      ))}
    </AccordionPrimitive.Root>
  );
}

// Export primitives
export { AccordionRoot, AccordionItem, AccordionTrigger, AccordionContent };
