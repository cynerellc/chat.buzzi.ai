import { Suspense } from "react";

import { RegisterForm } from "@/components/auth";

export const metadata = {
  title: "Create Account | Chat Buzzi",
  description: "Create your Chat Buzzi account and start your free trial",
};

export default function RegisterPage() {
  return (
    <Suspense fallback={<RegisterFormSkeleton />}>
      <RegisterForm />
    </Suspense>
  );
}

function RegisterFormSkeleton() {
  return (
    <div className="w-full max-w-md animate-pulse">
      <div className="text-center mb-8">
        <div className="w-12 h-12 bg-default-200 rounded-full mx-auto mb-4" />
        <div className="h-8 bg-default-200 rounded w-48 mx-auto mb-2" />
        <div className="h-4 bg-default-200 rounded w-64 mx-auto" />
      </div>
      <div className="space-y-4">
        <div className="h-14 bg-default-200 rounded" />
        <div className="h-14 bg-default-200 rounded" />
        <div className="h-14 bg-default-200 rounded" />
        <div className="h-14 bg-default-200 rounded" />
        <div className="h-14 bg-default-200 rounded" />
        <div className="h-6 bg-default-200 rounded w-3/4" />
        <div className="h-12 bg-default-200 rounded" />
      </div>
    </div>
  );
}
