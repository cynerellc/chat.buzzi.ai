import { Suspense } from "react";

import { auth } from "@/lib/auth";
import { getDashboardUrl } from "@/lib/auth/guards";
import { redirect } from "next/navigation";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  // If user is already authenticated, redirect to dashboard
  if (session?.user) {
    redirect(getDashboardUrl(session.user.role));
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-background to-default-100 p-4">
      {/* Logo */}
      <div className="mb-8">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
            <span className="text-white font-bold text-xl">C</span>
          </div>
          <span className="text-xl font-bold">Chat Buzzi</span>
        </div>
      </div>

      {/* Auth Card */}
      <div className="w-full max-w-md">
        <div className="bg-content1 rounded-2xl shadow-lg p-8">
          <Suspense
            fallback={
              <div className="animate-pulse space-y-4">
                <div className="h-8 bg-default-200 rounded w-3/4 mx-auto" />
                <div className="h-4 bg-default-200 rounded w-1/2 mx-auto" />
                <div className="space-y-3 mt-8">
                  <div className="h-12 bg-default-200 rounded" />
                  <div className="h-12 bg-default-200 rounded" />
                  <div className="h-12 bg-default-200 rounded" />
                </div>
              </div>
            }
          >
            {children}
          </Suspense>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-8 text-center text-sm text-default-400">
        <p>&copy; {new Date().getFullYear()} Chat Buzzi. All rights reserved.</p>
      </div>
    </div>
  );
}
