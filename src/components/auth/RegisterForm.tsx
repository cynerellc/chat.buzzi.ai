"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Checkbox, Input, Link } from "@heroui/react";
import { motion } from "framer-motion";
import { AlertCircle, Building2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod/v4";

import { PasswordInput } from "./PasswordInput";

const registerSchema = z
  .object({
    companyName: z.string().min(2, "Company name must be at least 2 characters"),
    fullName: z.string().min(2, "Full name must be at least 2 characters"),
    email: z.email("Please enter a valid email address"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[a-z]/, "Password must contain at least one lowercase letter")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
      .regex(/[0-9]/, "Password must contain at least one number"),
    confirmPassword: z.string(),
    acceptTerms: z.literal(true, {
      error: "You must accept the terms and conditions",
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type RegisterFormData = z.infer<typeof registerSchema>;

interface RegisterFormProps {
  onSuccess?: () => void;
}

export function RegisterForm({ onSuccess }: RegisterFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      companyName: "",
      fullName: "",
      email: "",
      password: "",
      confirmPassword: "",
      acceptTerms: false as unknown as true,
    },
  });

  const password = watch("password");
  const confirmPassword = watch("confirmPassword");

  const onSubmit = async (data: RegisterFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          companyName: data.companyName,
          fullName: data.fullName,
          email: data.email,
          password: data.password,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Registration failed");
      }

      onSuccess?.();
      router.push("/login?registered=true");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="w-full max-w-md"
    >
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-4">
          <Building2 className="w-6 h-6 text-primary" />
        </div>
        <h1 className="text-2xl font-bold">Create Your Account</h1>
        <p className="text-default-500 mt-2">
          Start your 14-day free trial. No credit card required.
        </p>
      </div>

      {error && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="mb-4 p-3 rounded-lg bg-danger-50 border border-danger-200 flex items-center gap-2 text-danger"
        >
          <AlertCircle size={18} />
          <span className="text-sm">{error}</span>
        </motion.div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          {...register("companyName")}
          label="Company Name"
          placeholder="Acme Inc."
          isRequired
          isInvalid={!!errors.companyName}
          errorMessage={errors.companyName?.message}
        />

        <Input
          {...register("fullName")}
          label="Full Name"
          placeholder="John Doe"
          isRequired
          isInvalid={!!errors.fullName}
          errorMessage={errors.fullName?.message}
          autoComplete="name"
        />

        <Input
          {...register("email")}
          type="email"
          label="Work Email"
          placeholder="john@acme.com"
          isRequired
          isInvalid={!!errors.email}
          errorMessage={errors.email?.message}
          autoComplete="email"
        />

        <PasswordInput
          {...register("password")}
          value={password}
          label="Password"
          placeholder="Create a password"
          isRequired
          isInvalid={!!errors.password}
          errorMessage={errors.password?.message}
          showStrength
        />

        <PasswordInput
          {...register("confirmPassword")}
          value={confirmPassword}
          label="Confirm Password"
          placeholder="Confirm your password"
          isRequired
          isInvalid={!!errors.confirmPassword}
          errorMessage={errors.confirmPassword?.message}
        />

        <Checkbox {...register("acceptTerms")} size="sm" isInvalid={!!errors.acceptTerms}>
          <span className="text-sm">
            I agree to the{" "}
            <Link href="/terms" size="sm">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/privacy" size="sm">
              Privacy Policy
            </Link>
          </span>
        </Checkbox>
        {errors.acceptTerms && (
          <p className="text-tiny text-danger">{errors.acceptTerms.message}</p>
        )}

        <Button
          type="submit"
          color="primary"
          className="w-full"
          isLoading={isLoading}
          size="lg"
        >
          Create Account
        </Button>
      </form>

      <p className="text-center text-sm text-default-500 mt-6">
        Already have an account?{" "}
        <Link href="/login" size="sm">
          Sign in
        </Link>
      </p>
    </motion.div>
  );
}
