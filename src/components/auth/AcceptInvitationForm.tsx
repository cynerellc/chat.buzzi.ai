"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { motion } from "framer-motion";
import { AlertCircle, ArrowLeft, CheckCircle2, UserPlus, Users, Mail, Shield } from "lucide-react";

import { Button, Input } from "@/components/ui";
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
          <div className="w-16 h-16 bg-muted rounded-full mx-auto mb-6" />
          <div className="h-6 bg-muted rounded w-3/4 mx-auto mb-2" />
          <div className="h-4 bg-muted rounded w-1/2 mx-auto" />
        </div>
      </div>
    );
  }

  if (error && !invitation) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full max-w-md text-center"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
          className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-destructive/10 mb-6"
        >
          <AlertCircle className="w-8 h-8 text-destructive" />
        </motion.div>
        <h1 className="text-2xl font-bold tracking-tight mb-2">Invalid Invitation</h1>
        <p className="text-muted-foreground mb-6">{error}</p>
        <Link href="/login">
          <Button color="primary" className="font-medium">Go to Login</Button>
        </Link>
      </motion.div>
    );
  }

  if (isSuccess) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full max-w-md text-center"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
          className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-success/10 mb-6"
        >
          <CheckCircle2 className="w-8 h-8 text-success" />
        </motion.div>
        <h1 className="text-2xl font-bold tracking-tight mb-2">Welcome to the Team!</h1>
        <p className="text-muted-foreground mb-6">
          Your account has been created. You can now sign in to start using the
          platform.
        </p>
        <Button color="primary" className="font-medium" onClick={() => router.push("/login")}>
          Sign In
        </Button>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="w-full max-w-md"
    >
      <div className="text-center mb-6">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.3 }}
          className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-4"
        >
          <UserPlus className="w-6 h-6 text-primary" />
        </motion.div>
        <h1 className="text-2xl font-bold tracking-tight">Accept Invitation</h1>
        <p className="text-muted-foreground mt-2">
          You&apos;ve been invited to join{" "}
          <span className="font-medium text-foreground">{invitation?.companyName}</span>
        </p>
      </div>

      {invitation && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-6 p-4 rounded-xl bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20"
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">
                {invitation.inviterName} invited you
              </p>
              <div className="flex items-center gap-2 mt-1">
                <Shield className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground capitalize">
                  {invitation.role.replace("_", " ")}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground truncate">
                  {invitation.email}
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 flex items-center gap-2 text-destructive"
        >
          <AlertCircle size={18} />
          <span className="text-sm">{error}</span>
        </motion.div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
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
          className="w-full font-medium"
          isLoading={isLoading}
          size="lg"
        >
          Accept & Create Account
        </Button>
      </form>

      <div className="text-center mt-6">
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
        >
          <ArrowLeft size={16} />
          Already have an account? Sign in
        </Link>
      </div>
    </motion.div>
  );
}
