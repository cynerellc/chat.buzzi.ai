"use client";

import { Input } from "@heroui/react";
import { Eye, EyeOff } from "lucide-react";
import { forwardRef, useState } from "react";

interface PasswordInputProps {
  label?: string;
  placeholder?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  name?: string;
  isRequired?: boolean;
  isInvalid?: boolean;
  errorMessage?: string;
  description?: string;
  showStrength?: boolean;
  className?: string;
}

function getPasswordStrength(password: string): {
  score: number;
  label: string;
  color: "default" | "danger" | "warning" | "success";
} {
  let score = 0;

  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;

  if (score <= 2) {
    return { score, label: "Weak", color: "danger" };
  } else if (score <= 4) {
    return { score, label: "Medium", color: "warning" };
  } else {
    return { score, label: "Strong", color: "success" };
  }
}

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  (
    {
      label = "Password",
      placeholder = "Enter password",
      value = "",
      onChange,
      onBlur,
      name,
      isRequired,
      isInvalid,
      errorMessage,
      description,
      showStrength = false,
      className,
    },
    ref
  ) => {
    const [isVisible, setIsVisible] = useState(false);
    const strength = showStrength && value ? getPasswordStrength(value) : null;

    return (
      <div className={className}>
        <Input
          ref={ref}
          label={label}
          placeholder={placeholder}
          type={isVisible ? "text" : "password"}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          name={name}
          isRequired={isRequired}
          isInvalid={isInvalid}
          errorMessage={errorMessage}
          description={description}
          endContent={
            <button
              className="focus:outline-none"
              type="button"
              onClick={() => setIsVisible(!isVisible)}
              aria-label={isVisible ? "Hide password" : "Show password"}
            >
              {isVisible ? (
                <EyeOff className="pointer-events-none text-2xl text-default-400" size={20} />
              ) : (
                <Eye className="pointer-events-none text-2xl text-default-400" size={20} />
              )}
            </button>
          }
        />
        {showStrength && value && strength && (
          <div className="mt-2">
            <div className="flex gap-1 mb-1">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  className={`h-1 flex-1 rounded-full ${
                    i <= strength.score
                      ? strength.color === "danger"
                        ? "bg-danger"
                        : strength.color === "warning"
                          ? "bg-warning"
                          : "bg-success"
                      : "bg-default-200"
                  }`}
                />
              ))}
            </div>
            <p
              className={`text-xs ${
                strength.color === "danger"
                  ? "text-danger"
                  : strength.color === "warning"
                    ? "text-warning"
                    : "text-success"
              }`}
            >
              Password strength: {strength.label}
            </p>
          </div>
        )}
      </div>
    );
  }
);

PasswordInput.displayName = "PasswordInput";
