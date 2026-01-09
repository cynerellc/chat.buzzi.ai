"use client";

import { Badge } from "@/components/ui";
import { cn } from "@/lib/utils";

interface ModelsFiltersProps {
  selectedProvider: string;
  onProviderChange: (provider: string) => void;
}

const providers = [
  { key: "all", label: "All Providers" },
  { key: "openai", label: "OpenAI" },
  { key: "google", label: "Google" },
  { key: "anthropic", label: "Anthropic" },
];

export function ModelsFilters({ selectedProvider, onProviderChange }: ModelsFiltersProps) {
  return (
    <div className="flex gap-2 mb-6 flex-wrap">
      {providers.map((provider) => (
        <Badge
          key={provider.key}
          variant={selectedProvider === provider.key ? "info" : "default"}
          className={cn(
            "cursor-pointer transition-all",
            selectedProvider === provider.key && "ring-2 ring-primary ring-offset-2"
          )}
          onClick={() => onProviderChange(provider.key)}
        >
          {provider.label}
        </Badge>
      ))}
    </div>
  );
}
