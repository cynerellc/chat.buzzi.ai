"use client";

import { Slider as HeroSlider, type SliderProps as HeroSliderProps } from "@heroui/react";
import { forwardRef } from "react";

import { cn } from "@/lib/utils";

export interface SliderProps extends HeroSliderProps {
  helperText?: string;
}

export const Slider = forwardRef<HTMLDivElement, SliderProps>(
  ({ helperText, className, ...props }, ref) => {
    return (
      <HeroSlider
        ref={ref}
        className={cn(className)}
        {...props}
      />
    );
  }
);

Slider.displayName = "Slider";
