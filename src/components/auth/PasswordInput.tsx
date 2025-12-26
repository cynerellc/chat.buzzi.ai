"use client";

import { Input } from "@/components/ui";
import { Eye, EyeOff, Check, X } from "lucide-react";
import { forwardRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

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
  showRequirements?: boolean;
  className?: string;
}

interface PasswordRequirement {
  label: string;
  regex: RegExp;
}

const requirements: PasswordRequirement[] = [
  { label: "At least 8 characters", regex: /.{8,}/ },
  { label: "One lowercase letter", regex: /[a-z]/ },
  { label: "One uppercase letter", regex: /[A-Z]/ },
  { label: "One number", regex: /[0-9]/ },
];

function getPasswordStrength(password: string): {
  score: number;
  label: string;
  color: "default" | "danger" | "warning" | "success";
  percentage: number;
} {
  let score = 0;

  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;

  const percentage = (score / 6) * 100;

  if (score <= 2) {
    return { score, label: "Weak", color: "danger", percentage };
  } else if (score <= 4) {
    return { score, label: "Medium", color: "warning", percentage };
  } else {
    return { score, label: "Strong", color: "success", percentage };
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
      showRequirements = false,
      className,
    },
    ref
  ) => {
    const [isVisible, setIsVisible] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    const strength = showStrength && value ? getPasswordStrength(value) : null;

    const handleFocus = () => setIsFocused(true);
    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(false);
      onBlur?.(e);
    };

    return (
      <div className={className}>
        <Input
          ref={ref}
          label={label}
          placeholder={placeholder}
          type={isVisible ? "text" : "password"}
          value={value}
          onChange={onChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          name={name}
          isRequired={isRequired}
          isInvalid={isInvalid}
          errorMessage={errorMessage}
          description={description}
          autoComplete="new-password"
          endContent={
            <button
              className="focus:outline-none p-1 rounded-md hover:bg-muted/50 transition-colors"
              type="button"
              onClick={() => setIsVisible(!isVisible)}
              aria-label={isVisible ? "Hide password" : "Show password"}
            >
              {isVisible ? (
                <EyeOff className="text-muted-foreground hover:text-foreground transition-colors" size={18} />
              ) : (
                <Eye className="text-muted-foreground hover:text-foreground transition-colors" size={18} />
              )}
            </button>
          }
        />

        <AnimatePresence>
          {showStrength && value && strength && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="mt-2 overflow-hidden"
            >
              {/* Progress bar */}
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${strength.percentage}%` }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                  className={`h-full rounded-full ${
                    strength.color === "danger"
                      ? "bg-destructive"
                      : strength.color === "warning"
                        ? "bg-warning"
                        : "bg-success"
                  }`}
                />
              </div>

              <div className="flex items-center justify-between mt-1.5">
                <span
                  className={`text-xs font-medium ${
                    strength.color === "danger"
                      ? "text-destructive"
                      : strength.color === "warning"
                        ? "text-warning"
                        : "text-success"
                  }`}
                >
                  {strength.label}
                </span>
                {showRequirements && isFocused && (
                  <span className="text-xs text-muted-foreground">
                    {requirements.filter((r) => r.regex.test(value)).length}/{requirements.length} requirements
                  </span>
                )}
              </div>

              {/* Requirements list */}
              {showRequirements && isFocused && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-2 space-y-1"
                >
                  {requirements.map((req) => {
                    const met = req.regex.test(value);
                    return (
                      <div
                        key={req.label}
                        className={`flex items-center gap-1.5 text-xs transition-colors ${
                          met ? "text-success" : "text-muted-foreground"
                        }`}
                      >
                        {met ? (
                          <Check className="w-3 h-3" />
                        ) : (
                          <X className="w-3 h-3" />
                        )}
                        <span>{req.label}</span>
                      </div>
                    );
                  })}
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }
);

PasswordInput.displayName = "PasswordInput";
