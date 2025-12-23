"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Checkbox, Divider, Input, Link } from "@heroui/react";
import { motion } from "framer-motion";
import { Github, Mail, AlertCircle } from "lucide-react";
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

export function LoginForm({ onSuccess }: LoginFormProps) {
  const { login, loginWithGoogle, loginWithGitHub } = useAuth();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? undefined;

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

  const handleGitHubLogin = async () => {
    setIsLoading(true);
    try {
      await loginWithGitHub(callbackUrl);
    } catch {
      setError("Failed to login with GitHub");
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
        <h1 className="text-2xl font-bold">Welcome Back</h1>
        <p className="text-default-500 mt-2">Sign in to your account to continue</p>
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

        <PasswordInput
          {...register("password")}
          value={password}
          label="Password"
          placeholder="Enter your password"
          isRequired
          isInvalid={!!errors.password}
          errorMessage={errors.password?.message}
        />

        <div className="flex items-center justify-between">
          <Checkbox {...register("rememberMe")} size="sm">
            Remember me
          </Checkbox>
          <Link href="/forgot-password" size="sm">
            Forgot password?
          </Link>
        </div>

        <Button
          type="submit"
          color="primary"
          className="w-full"
          isLoading={isLoading}
          size="lg"
        >
          Sign In
        </Button>
      </form>

      <Divider className="my-6" />

      <div className="space-y-3">
        <Button
          variant="bordered"
          className="w-full"
          startContent={<Mail size={18} />}
          onClick={handleGoogleLogin}
          isDisabled={isLoading}
        >
          Continue with Google
        </Button>

        <Button
          variant="bordered"
          className="w-full"
          startContent={<Github size={18} />}
          onClick={handleGitHubLogin}
          isDisabled={isLoading}
        >
          Continue with GitHub
        </Button>
      </div>

      <p className="text-center text-sm text-default-500 mt-6">
        Don&apos;t have an account?{" "}
        <Link href="/register" size="sm">
          Sign up
        </Link>
      </p>
    </motion.div>
  );
}
