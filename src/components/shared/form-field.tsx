"use client";

import { type ReactNode } from "react";
import { Controller, type Control, type FieldPath, type FieldValues } from "react-hook-form";

import { Input, Select, type SelectOption } from "../ui";

export interface FormFieldProps<T extends FieldValues> {
  name: FieldPath<T>;
  control: Control<T>;
  label: string;
  placeholder?: string;
  type?: "text" | "email" | "password" | "number" | "tel" | "url";
  description?: string;
  disabled?: boolean;
  required?: boolean;
  autoFocus?: boolean;
  className?: string;
}

export function FormField<T extends FieldValues>({
  name,
  control,
  label,
  placeholder,
  type = "text",
  description,
  disabled,
  required,
  autoFocus,
  className,
}: FormFieldProps<T>) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState: { error } }) => (
        <Input
          {...field}
          label={label}
          placeholder={placeholder}
          type={type}
          helperText={error?.message ?? description}
          isInvalid={!!error}
          isDisabled={disabled}
          isRequired={required}
          autoFocus={autoFocus}
          className={className}
        />
      )}
    />
  );
}

export interface FormSelectFieldProps<T extends FieldValues> {
  name: FieldPath<T>;
  control: Control<T>;
  label: string;
  options: SelectOption[];
  placeholder?: string;
  description?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
}

export function FormSelectField<T extends FieldValues>({
  name,
  control,
  label,
  options,
  placeholder,
  description,
  disabled,
  required,
  className,
}: FormSelectFieldProps<T>) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState: { error } }) => (
        <Select
          {...field}
          label={label}
          options={options}
          placeholder={placeholder}
          helperText={error?.message ?? description}
          isInvalid={!!error}
          isDisabled={disabled}
          isRequired={required}
          className={className}
          selectedKeys={field.value ? [field.value] : []}
          onSelectionChange={(keys) => {
            const value = Array.from(keys)[0];
            field.onChange(value);
          }}
        />
      )}
    />
  );
}

export interface FormTextareaFieldProps<T extends FieldValues> {
  name: FieldPath<T>;
  control: Control<T>;
  label: string;
  placeholder?: string;
  description?: string;
  disabled?: boolean;
  required?: boolean;
  rows?: number;
  maxLength?: number;
  className?: string;
}

export function FormTextareaField<T extends FieldValues>({
  name,
  control,
  label,
  placeholder,
  description,
  disabled,
  required,
  rows = 4,
  maxLength,
  className,
}: FormTextareaFieldProps<T>) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState: { error } }) => (
        <div className={className}>
          <label className="block text-sm font-medium text-default-700 mb-1.5">
            {label}
            {required && <span className="text-danger ml-1">*</span>}
          </label>
          <textarea
            {...field}
            placeholder={placeholder}
            disabled={disabled}
            rows={rows}
            maxLength={maxLength}
            className={`w-full px-3 py-2 text-sm bg-default-100 border rounded-lg
              placeholder:text-default-400 focus:outline-none focus:ring-2
              ${error ? "border-danger focus:ring-danger/20" : "border-transparent focus:ring-primary/20"}
              ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
          />
          {(error?.message || description) && (
            <p className={`mt-1 text-xs ${error ? "text-danger" : "text-default-500"}`}>
              {error?.message ?? description}
            </p>
          )}
          {maxLength && (
            <p className="mt-1 text-xs text-default-400 text-right">
              {field.value?.length ?? 0} / {maxLength}
            </p>
          )}
        </div>
      )}
    />
  );
}

// Generic form field wrapper for custom inputs
export interface FormFieldWrapperProps {
  label: string;
  error?: string;
  description?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}

export function FormFieldWrapper({
  label,
  error,
  description,
  required,
  children,
  className,
}: FormFieldWrapperProps) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-default-700 mb-1.5">
        {label}
        {required && <span className="text-danger ml-1">*</span>}
      </label>
      {children}
      {(error || description) && (
        <p className={`mt-1 text-xs ${error ? "text-danger" : "text-default-500"}`}>
          {error ?? description}
        </p>
      )}
    </div>
  );
}
