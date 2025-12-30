import { Suspense } from "react";
import Image from "next/image";

import { auth } from "@/lib/auth";
import { getDashboardUrl } from "@/lib/auth/guards";
import { redirect } from "next/navigation";
import Link from "next/link";
import { AuthGridBackground } from "@/components/auth/AuthGridBackground";

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
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 relative overflow-hidden">
      {/* Animated grid background */}
      <AuthGridBackground />

      {/* Logo */}
      <Link href="/" className="mb-8 relative z-10 group">
        <Image
          src="/images/logo-dark.svg"
          alt="Buzzi"
          width={140}
          height={40}
          className="transition-transform group-hover:scale-[1.02]"
          priority
        />
      </Link>

      {/* Auth Card */}
      <div className="w-full max-w-md relative z-10">
        <div className="relative">
          {/* Card */}
          <div className="relative bg-card/90 backdrop-blur-xl shadow-2xl shadow-black/10 border border-border/40 p-8 sm:p-10 card-extended-corners">
            <span className="corner-extensions" />
            <Suspense
              fallback={
                <div className="animate-pulse space-y-4">
                  <div className="h-8 bg-muted rounded-lg w-3/4 mx-auto" />
                  <div className="h-4 bg-muted rounded-lg w-1/2 mx-auto" />
                  <div className="space-y-3 mt-8">
                    <div className="h-12 bg-muted rounded-lg" />
                    <div className="h-12 bg-muted rounded-lg" />
                    <div className="h-12 bg-muted rounded-lg" />
                  </div>
                </div>
              }
            >
              {children}
            </Suspense>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-8 text-center relative z-10">
        <p className="text-xs text-muted-foreground/60">
          &copy; {new Date().getFullYear()} Chat Buzzi. All rights reserved.
        </p>
      </div>
    </div>
  );
}
