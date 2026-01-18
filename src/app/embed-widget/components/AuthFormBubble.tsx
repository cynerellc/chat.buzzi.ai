"use client";

/**
 * AuthFormBubble Component
 *
 * Displays an authentication form inline in the chat when login is required.
 * Supports multi-step authentication flows (e.g., phone + OTP).
 */

import { useState, useCallback, type FormEvent } from "react";
import { cn } from "@/lib/utils";
import type { AuthField, AuthState } from "./types";

interface AuthFormBubbleProps {
  authState: AuthState;
  sessionId: string;
  primaryColor?: string;
  onAuthSuccess?: () => void;
  onAuthError?: (error: string) => void;
  onNextStep?: (step: { stepId: string; stepName?: string; fields: AuthField[]; aiPrompt?: string }) => void;
}

export function AuthFormBubble({
  authState,
  sessionId,
  primaryColor = "#6437F3",
  onAuthSuccess,
  onAuthError,
  onNextStep,
}: AuthFormBubbleProps) {
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleInputChange = useCallback((fieldName: string, value: string) => {
    setFormValues((prev) => ({ ...prev, [fieldName]: value }));
    setLocalError(null);
  }, []);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();

      if (!authState.currentStep) return;

      // Validate required fields
      const missingFields = authState.currentStep.fields
        .filter((f) => f.required && !formValues[f.name]?.trim())
        .map((f) => f.label);

      if (missingFields.length > 0) {
        setLocalError(`Please fill in: ${missingFields.join(", ")}`);
        return;
      }

      setIsSubmitting(true);
      setLocalError(null);

      try {
        const response = await fetch(`/api/widget/${sessionId}/auth`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            stepId: authState.currentStep.stepId,
            values: formValues,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Authentication failed");
        }

        // Success - callback will handle state update
        if (data.success) {
          setFormValues({});
          if (data.authenticated) {
            // Login complete
            onAuthSuccess?.();
          } else if (data.nextStep) {
            // Multi-step: move to next step
            onNextStep?.(data.nextStep);
          }
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Authentication failed";
        setLocalError(errorMessage);
        onAuthError?.(errorMessage);
      } finally {
        setIsSubmitting(false);
      }
    },
    [authState.currentStep, formValues, sessionId, onAuthSuccess, onAuthError]
  );

  if (!authState.currentStep) {
    return null;
  }

  const { fields, aiPrompt, stepName } = authState.currentStep;
  const displayError = localError || authState.error;

  return (
    <div className="flex justify-start mb-4">
      <div className="max-w-[85%] rounded-2xl bg-white border border-gray-200 shadow-sm overflow-hidden">
        {/* Header */}
        <div
          className="px-4 py-3 border-b border-gray-100"
          style={{ backgroundColor: `${primaryColor}10` }}
        >
          <div className="flex items-center gap-2">
            <svg
              className="w-5 h-5"
              style={{ color: primaryColor }}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
            <span className="font-medium text-sm text-gray-900">
              {stepName || "Login Required"}
            </span>
          </div>
          {aiPrompt && (
            <p className="mt-1.5 text-sm text-gray-600">{aiPrompt}</p>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          {fields.map((field) => (
            <div key={field.name}>
              <label
                htmlFor={field.name}
                className="block text-xs font-medium text-gray-700 mb-1"
              >
                {field.label}
                {field.required && (
                  <span className="text-red-500 ml-0.5">*</span>
                )}
              </label>
              {renderField(field, formValues[field.name] || "", (value) =>
                handleInputChange(field.name, value)
              )}
            </div>
          ))}

          {/* Error Message */}
          {displayError && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
              <svg
                className="w-4 h-4 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span>{displayError}</span>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className={cn(
              "w-full py-2.5 px-4 rounded-lg text-sm font-medium text-white transition-all",
              "focus:outline-none focus:ring-2 focus:ring-offset-2",
              isSubmitting && "opacity-70 cursor-not-allowed"
            )}
            style={{
              backgroundColor: primaryColor,
              ["--tw-ring-color" as string]: primaryColor,
            }}
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <svg
                  className="animate-spin h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Verifying...
              </span>
            ) : (
              "Continue"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

/**
 * Render a form field based on its type
 */
function renderField(
  field: AuthField,
  value: string,
  onChange: (value: string) => void
) {
  const baseClasses =
    "w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent";

  switch (field.type) {
    case "phone":
      return (
        <input
          type="tel"
          id={field.name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder || "+1 (555) 000-0000"}
          className={baseClasses}
          minLength={field.validation?.minLength}
          maxLength={field.validation?.maxLength}
          pattern={field.validation?.pattern}
        />
      );

    case "otp":
      return (
        <input
          type="text"
          id={field.name}
          value={value}
          onChange={(e) => {
            // Only allow numbers
            const numericValue = e.target.value.replace(/\D/g, "");
            onChange(numericValue);
          }}
          placeholder={field.placeholder || "Enter code"}
          className={cn(baseClasses, "text-center tracking-widest font-mono")}
          maxLength={field.validation?.maxLength || 6}
          autoComplete="one-time-code"
        />
      );

    case "email":
      return (
        <input
          type="email"
          id={field.name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder || "you@example.com"}
          className={baseClasses}
          autoComplete="email"
        />
      );

    case "password":
      return (
        <input
          type="password"
          id={field.name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder || "Enter password"}
          className={baseClasses}
          autoComplete="current-password"
        />
      );

    case "select":
      return (
        <select
          id={field.name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={baseClasses}
        >
          <option value="">Select...</option>
          {/* Options would be provided via field config */}
        </select>
      );

    case "text":
    default:
      return (
        <input
          type="text"
          id={field.name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className={baseClasses}
          minLength={field.validation?.minLength}
          maxLength={field.validation?.maxLength}
          pattern={field.validation?.pattern}
        />
      );
  }
}
