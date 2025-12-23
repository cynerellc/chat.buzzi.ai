"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Input, Link } from "@heroui/react";
import { motion } from "framer-motion";
import { AlertCircle, ArrowLeft, CheckCircle2, UserPlus } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod/v4";

import { PasswordInput } from "./PasswordInput";

const acceptInvitationSchema = z
  .object({
    fullName: z.string().min(2, "Full name must be at least 2 characters"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[a-z]/, "Password must contain at least one lowercase letter")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
      .regex(/[0-9]/, "Password must contain at least one number"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type AcceptInvitationFormData = z.infer<typeof acceptInvitationSchema>;

interface InvitationDetails {
  email: string;
  companyName: string;
  role: string;
  inviterName: string;
}

export function AcceptInvitationForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [isLoading, setIsLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [invitation, setInvitation] = useState<InvitationDetails | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<AcceptInvitationFormData>({
    resolver: zodResolver(acceptInvitationSchema),
    defaultValues: {
      fullName: "",
      password: "",
      confirmPassword: "",
    },
  });

  const password = watch("password");
  const confirmPassword = watch("confirmPassword");

  // Validate token on mount
  useEffect(() => {
    async function validateToken() {
      if (!token) {
        setError("Invalid invitation link");
        setIsValidating(false);
        return;
      }

      try {
        const response = await fetch(`/api/auth/validate-invitation?token=${token}`);

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || "Invalid invitation");
        }

        const data = await response.json();
        setInvitation(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Invalid invitation");
      } finally {
        setIsValidating(false);
      }
    }

    validateToken();
  }, [token]);

  const onSubmit = async (data: AcceptInvitationFormData) => {
    if (!token) {
      setError("Invalid invitation token");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/accept-invitation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          fullName: data.fullName,
          password: data.password,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to accept invitation");
      }

      setIsSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to accept invitation");
    } finally {
      setIsLoading(false);
    }
  };

  if (isValidating) {
    return (
      <div className="w-full max-w-md text-center">
        <div className="animate-pulse">
          <div className="w-16 h-16 bg-default-200 rounded-full mx-auto mb-6" />
          <div className="h-6 bg-default-200 rounded w-3/4 mx-auto mb-2" />
          <div className="h-4 bg-default-200 rounded w-1/2 mx-auto" />
        </div>
      </div>
    );
  }

  if (error && !invitation) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md text-center"
      >
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-danger/10 mb-6">
          <AlertCircle className="w-8 h-8 text-danger" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Invalid Invitation</h1>
        <p className="text-default-500 mb-6">{error}</p>
        <Link href="/login">
          <Button color="primary">Go to Login</Button>
        </Link>
      </motion.div>
    );
  }

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
        <h1 className="text-2xl font-bold mb-2">Welcome to the Team!</h1>
        <p className="text-default-500 mb-6">
          Your account has been created. You can now sign in to start using the
          platform.
        </p>
        <Button color="primary" onClick={() => router.push("/login")}>
          Sign In
        </Button>
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
          <UserPlus className="w-6 h-6 text-primary" />
        </div>
        <h1 className="text-2xl font-bold">Accept Invitation</h1>
        <p className="text-default-500 mt-2">
          You&apos;ve been invited to join{" "}
          <span className="font-medium text-foreground">{invitation?.companyName}</span>
        </p>
      </div>

      {invitation && (
        <div className="mb-6 p-4 rounded-lg bg-default-100">
          <p className="text-sm text-default-500">
            <span className="font-medium text-foreground">{invitation.inviterName}</span>{" "}
            has invited you as a{" "}
            <span className="font-medium text-foreground">
              {invitation.role.replace("_", " ")}
            </span>
          </p>
          <p className="text-sm text-default-400 mt-1">{invitation.email}</p>
        </div>
      )}

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
          {...register("fullName")}
          label="Full Name"
          placeholder="John Doe"
          isRequired
          isInvalid={!!errors.fullName}
          errorMessage={errors.fullName?.message}
          autoComplete="name"
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

        <Button
          type="submit"
          color="primary"
          className="w-full"
          isLoading={isLoading}
          size="lg"
        >
          Accept & Create Account
        </Button>
      </form>

      <div className="text-center mt-6">
        <Link
          href="/login"
          className="inline-flex items-center gap-1 text-sm text-default-500 hover:text-primary"
        >
          <ArrowLeft size={16} />
          Already have an account? Sign in
        </Link>
      </div>
    </motion.div>
  );
}
