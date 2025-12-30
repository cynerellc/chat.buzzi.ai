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

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
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
  const { login, loginWithGoogle } = useAuth();
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

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      await loginWithGoogle(callbackUrl);
    } catch {
      setError("Failed to login with Google");
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

      {/* Divider */}
      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border/60" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-card px-3 text-xs text-muted-foreground uppercase tracking-wider">
            or continue with
          </span>
        </div>
      </div>

      {/* Google sign-in */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.3 }}
      >
        <Button
          variant="outline"
          className="w-full h-11 font-medium gap-3 hover:bg-muted/50 hover:border-border transition-all hover:scale-[1.01] active:scale-[0.99]"
          startContent={<GoogleIcon className="w-5 h-5" />}
          onClick={handleGoogleLogin}
          isDisabled={isLoading}
        >
          Continue with Google
        </Button>
      </motion.div>

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
