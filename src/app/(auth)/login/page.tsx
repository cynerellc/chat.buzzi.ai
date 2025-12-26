import { Suspense } from "react";

import { LoginForm } from "@/components/auth";

export const metadata = {
  title: "Sign In | Chat Buzzi",
  description: "Sign in to your Chat Buzzi account",
};

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFormSkeleton />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginFormSkeleton() {
  return (
    <div className="w-full max-w-md animate-pulse">
      <div className="text-center mb-8">
        <div className="h-8 bg-muted rounded w-48 mx-auto mb-2" />
        <div className="h-4 bg-muted rounded w-64 mx-auto" />
      </div>
      <div className="space-y-4">
        <div className="h-14 bg-muted rounded" />
        <div className="h-14 bg-muted rounded" />
        <div className="h-10 bg-muted rounded" />
        <div className="h-12 bg-muted rounded" />
      </div>
    </div>
  );
}
