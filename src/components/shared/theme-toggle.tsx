"use client";

import { useTheme } from "next-themes";
import { Moon, Sun, Monitor } from "lucide-react";
import { useSyncExternalStore } from "react";

import { Button, IconButton } from "../ui";
import { cn } from "@/lib/utils";

// Custom hook to track mounted state without useEffect + setState
function useMounted() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
}

export interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();

  if (!mounted) {
    return (
      <IconButton
        icon={Sun}
        variant="ghost"
        size="sm"
        aria-label="Toggle theme"
        className={className}
      />
    );
  }

  const toggleTheme = () => {
    if (theme === "light") {
      setTheme("dark");
    } else if (theme === "dark") {
      setTheme("system");
    } else {
      setTheme("light");
    }
  };

  const Icon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;

  return (
    <IconButton
      icon={Icon}
      variant="ghost"
      size="sm"
      aria-label={`Current theme: ${theme}. Click to toggle.`}
      onPress={toggleTheme}
      className={className}
    />
  );
}

// Full theme selector with options
export interface ThemeSelectorProps {
  className?: string;
}

export function ThemeSelector({ className }: ThemeSelectorProps) {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();

  const options = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "System", icon: Monitor },
  ] as const;

  if (!mounted) {
    return (
      <div className={cn("flex gap-1 p-1 bg-default-100 rounded-lg", className)}>
        {options.map((option) => (
          <div
            key={option.value}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md"
          >
            <option.icon size={16} />
            <span className="text-sm">{option.label}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={cn("flex gap-1 p-1 bg-default-100 rounded-lg", className)}>
      {options.map((option) => (
        <Button
          key={option.value}
          size="sm"
          variant={theme === option.value ? "default" : "ghost"}
          color={theme === option.value ? "primary" : "default"}
          leftIcon={option.icon}
          onPress={() => setTheme(option.value)}
          className="flex-1"
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}
