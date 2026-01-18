"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { motion } from "framer-motion";
import { AlertCircle, CheckCircle2, Mail, Shield, ArrowRight } from "lucide-react";

import { Button, Checkbox, Input } from "@/components/ui";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod/v4";

import { useAuth } from "@/hooks/useAuth";

import { PasswordInput } from "./PasswordInput";

const loginSchema = z.object({
  email: z.email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
  rememberMe: z.boolean().optional(),
});

type LoginFormData = z.infer<typeof loginSchema>;

interface LoginFormProps {
  onSuccess?: () => void;
}

const formItemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.1,
      duration: 0.3,
      ease: "easeOut" as const,
    },
  }),
};

export function LoginForm({ onSuccess }: LoginFormProps) {
  const { login } = useAuth();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? undefined;
  const registered = searchParams.get("registered");

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
      rememberMe: false,
    },
  });

  const password = watch("password");

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      await login(data.email, data.password, callbackUrl);
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid email or password");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="w-full max-w-md"
    >
      {/* Header */}
      <div className="text-center mb-8">
        <motion.h1
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.3 }}
          className="text-2xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text"
        >
          Welcome back
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.3 }}
          className="text-muted-foreground mt-2 text-sm"
        >
          Sign in to access your AI support dashboard
        </motion.p>
      </div>

      {/* Success message after registration */}
      {registered && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mb-5 p-4 rounded-xl bg-success/10 border border-success/20 flex items-start gap-3"
        >
          <div className="shrink-0 w-8 h-8 rounded-full bg-success/20 flex items-center justify-center">
            <CheckCircle2 className="w-4 h-4 text-success" />
          </div>
          <div>
            <p className="text-sm font-medium text-success">Account created successfully!</p>
            <p className="text-xs text-success/80 mt-0.5">Please sign in with your credentials.</p>
          </div>
        </motion.div>
      )}

      {/* Error message */}
      {error && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mb-5 p-4 rounded-xl bg-destructive/10 border border-destructive/20 flex items-start gap-3"
        >
          <div className="shrink-0 w-8 h-8 rounded-full bg-destructive/20 flex items-center justify-center">
            <AlertCircle className="w-4 h-4 text-destructive" />
          </div>
          <div>
            <p className="text-sm font-medium text-destructive">Sign in failed</p>
            <p className="text-xs text-destructive/80 mt-0.5">{error}</p>
          </div>
        </motion.div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <motion.div
          custom={0}
          variants={formItemVariants}
          initial="hidden"
          animate="visible"
        >
          <Input
            {...register("email")}
            type="email"
            label="Email address"
            placeholder="name@company.com"
            isRequired
            isInvalid={!!errors.email}
            errorMessage={errors.email?.message}
            autoComplete="email"
            startContent={<Mail className="w-4 h-4 text-muted-foreground" />}
          />
        </motion.div>

        <motion.div
          custom={1}
          variants={formItemVariants}
          initial="hidden"
          animate="visible"
        >
          <PasswordInput
            {...register("password")}
            value={password}
            label="Password"
            placeholder="Enter your password"
            isRequired
            isInvalid={!!errors.password}
            errorMessage={errors.password?.message}
          />
        </motion.div>

        <motion.div
          custom={2}
          variants={formItemVariants}
          initial="hidden"
          animate="visible"
          className="flex items-center justify-between pt-1"
        >
          <Checkbox {...register("rememberMe")} size="sm" className="text-muted-foreground">
            <span className="text-sm">Remember me</span>
          </Checkbox>
          <Link
            href="/forgot-password"
            className="text-sm text-primary hover:text-primary/80 transition-colors font-medium hover:underline underline-offset-4"
          >
            Forgot password?
          </Link>
        </motion.div>

        <motion.div
          custom={3}
          variants={formItemVariants}
          initial="hidden"
          animate="visible"
          className="pt-2"
        >
          <Button
            type="submit"
            color="primary"
            className="w-full font-medium h-11 text-base shadow-lg shadow-primary/20 hover:shadow-primary/30 hover:scale-[1.01] active:scale-[0.99] transition-all"
            isLoading={isLoading}
            size="lg"
          >
            {isLoading ? (
              "Signing in..."
            ) : (
              <span className="flex items-center gap-2">
                Sign in
                <ArrowRight className="w-4 h-4" />
              </span>
            )}
          </Button>
        </motion.div>
      </form>

      {/* Sign up link */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.3 }}
        className="text-center text-sm text-muted-foreground mt-6"
      >
        Don&apos;t have an account?{" "}
        <Link
          href="/register"
          className="text-primary hover:text-primary/80 transition-colors font-semibold hover:underline underline-offset-4"
        >
          Create account
        </Link>
      </motion.p>

      {/* Trust indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6, duration: 0.3 }}
        className="flex items-center justify-center gap-2 mt-6 text-xs text-muted-foreground/70"
      >
        <Shield className="w-3.5 h-3.5" />
        <span>Secured with enterprise-grade encryption</span>
      </motion.div>
    </motion.div>
  );
}
