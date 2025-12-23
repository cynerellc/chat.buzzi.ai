"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Input, Link } from "@heroui/react";
import { motion } from "framer-motion";
import { AlertCircle, ArrowLeft, CheckCircle2, Mail } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod/v4";

const forgotPasswordSchema = z.object({
  email: z.email("Please enter a valid email address"),
});

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

export function ForgotPasswordForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    getValues,
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  const onSubmit = async (data: ForgotPasswordFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: data.email }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to send reset email");
      }

      setIsSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send reset email");
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md text-center"
      >
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-success/10 mb-6">
          <CheckCircle2 className="w-8 h-8 text-success" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Check Your Email</h1>
        <p className="text-default-500 mb-6">
          We&apos;ve sent a password reset link to{" "}
          <span className="font-medium text-foreground">{getValues("email")}</span>
        </p>
        <p className="text-sm text-default-400 mb-6">
          Didn&apos;t receive the email? Check your spam folder or try again.
        </p>
        <div className="space-y-3">
          <Button
            variant="bordered"
            className="w-full"
            onClick={() => setIsSuccess(false)}
          >
            Try another email
          </Button>
          <Link
            href="/login"
            className="inline-flex items-center gap-1 text-sm text-default-500 hover:text-primary"
          >
            <ArrowLeft size={16} />
            Back to login
          </Link>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="w-full max-w-md"
    >
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-4">
          <Mail className="w-6 h-6 text-primary" />
        </div>
        <h1 className="text-2xl font-bold">Forgot Password?</h1>
        <p className="text-default-500 mt-2">
          Enter your email and we&apos;ll send you a reset link
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
          {...register("email")}
          type="email"
          label="Email"
          placeholder="Enter your email"
          isRequired
          isInvalid={!!errors.email}
          errorMessage={errors.email?.message}
          autoComplete="email"
        />

        <Button
          type="submit"
          color="primary"
          className="w-full"
          isLoading={isLoading}
          size="lg"
        >
          Send Reset Link
        </Button>
      </form>

      <div className="text-center mt-6">
        <Link
          href="/login"
          className="inline-flex items-center gap-1 text-sm text-default-500 hover:text-primary"
        >
          <ArrowLeft size={16} />
          Back to login
        </Link>
      </div>
    </motion.div>
  );
}
