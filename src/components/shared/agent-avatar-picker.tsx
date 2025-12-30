"use client";

import { Bot, Pencil } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

import { AvatarSelectorModal } from "./avatar-selector-modal";

interface AgentAvatarPickerProps {
  value?: string;
  onChange: (avatarUrl: string | undefined) => void;
  agentName?: string;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses = {
  sm: "w-10 h-10",
  md: "w-14 h-14",
  lg: "w-20 h-20",
};

const iconSizes = {
  sm: 20,
  md: 28,
  lg: 40,
};

const editButtonSizes = {
  sm: "w-5 h-5",
  md: "w-6 h-6",
  lg: "w-8 h-8",
};

const editIconSizes = {
  sm: 10,
  md: 12,
  lg: 16,
};

export function AgentAvatarPicker({
  value,
  onChange,
  agentName = "Agent",
  disabled = false,
  size = "md",
  className,
}: AgentAvatarPickerProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleSelect = (avatarUrl: string) => {
    onChange(avatarUrl || undefined);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => !disabled && setIsModalOpen(true)}
        disabled={disabled}
        className={cn(
          "relative group rounded-full overflow-hidden border-2 border-dashed border-default-300 bg-muted/30 flex items-center justify-center transition-all",
          !disabled && "hover:border-primary hover:bg-muted/50 cursor-pointer",
          disabled && "opacity-60 cursor-not-allowed",
          sizeClasses[size],
          className
        )}
        title={disabled ? "Avatar selection disabled" : "Click to change avatar"}
      >
        {value ? (
          <img
            src={value}
            alt={`${agentName} avatar`}
            className="w-full h-full object-cover"
          />
        ) : (
          <Bot size={iconSizes[size]} className="text-muted-foreground" />
        )}

        {/* Edit overlay on hover */}
        {!disabled && (
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <div
              className={cn(
                "bg-white rounded-full flex items-center justify-center",
                editButtonSizes[size]
              )}
            >
              <Pencil size={editIconSizes[size]} className="text-gray-700" />
            </div>
          </div>
        )}
      </button>

      <AvatarSelectorModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSelect={handleSelect}
        currentAvatar={value}
        agentName={agentName}
      />
    </>
  );
}
