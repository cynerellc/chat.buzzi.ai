"use client";

import { Badge } from "@/components/ui";
import { cn } from "@/lib/utils";

interface ModelsFiltersProps {
  selectedProvider: string;
  onProviderChange: (provider: string) => void;
  selectedModelType?: string;
  onModelTypeChange?: (modelType: string) => void;
}

const providers = [
  { key: "all", label: "All Providers" },
  { key: "openai", label: "OpenAI" },
  { key: "google", label: "Google" },
  { key: "anthropic", label: "Anthropic" },
];

const modelTypes = [
  { key: "all", label: "All Types" },
  { key: "chat", label: "Chat" },
  { key: "call", label: "Call" },
  { key: "both", label: "Both" },
];

export function ModelsFilters({
  selectedProvider,
  onProviderChange,
  selectedModelType = "all",
  onModelTypeChange,
}: ModelsFiltersProps) {
  return (
    <div className="flex flex-col gap-3 mb-6">
      {/* Provider Filter */}
      <div className="flex gap-2 flex-wrap items-center">
        <span className="text-sm text-muted-foreground mr-2">Provider:</span>
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

      {/* Model Type Filter */}
      {onModelTypeChange && (
        <div className="flex gap-2 flex-wrap items-center">
          <span className="text-sm text-muted-foreground mr-2">Type:</span>
          {modelTypes.map((type) => (
            <Badge
              key={type.key}
              variant={selectedModelType === type.key ? "info" : "default"}
              className={cn(
                "cursor-pointer transition-all",
                selectedModelType === type.key && "ring-2 ring-primary ring-offset-2"
              )}
              onClick={() => onModelTypeChange(type.key)}
            >
              {type.label}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
