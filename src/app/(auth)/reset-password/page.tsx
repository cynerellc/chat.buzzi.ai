import { Suspense } from "react";

import { ResetPasswordForm } from "@/components/auth";

export const metadata = {
  title: "Reset Password | Chat Buzzi",
  description: "Set a new password for your Chat Buzzi account",
};

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<ResetPasswordFormSkeleton />}>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordFormSkeleton() {
  return (
    <div className="w-full max-w-md animate-pulse">
      <div className="text-center mb-8">
        <div className="w-12 h-12 bg-muted rounded-full mx-auto mb-4" />
        <div className="h-8 bg-muted rounded w-48 mx-auto mb-2" />
        <div className="h-4 bg-muted rounded w-64 mx-auto" />
      </div>
      <div className="space-y-4">
        <div className="h-14 bg-muted rounded" />
        <div className="h-14 bg-muted rounded" />
        <div className="h-12 bg-muted rounded" />
      </div>
    </div>
  );
}
