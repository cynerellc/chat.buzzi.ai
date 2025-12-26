"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error("Global error:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 mx-auto rounded-full bg-danger/10 flex items-center justify-center mb-6">
          <AlertTriangle className="w-10 h-10 text-danger" />
        </div>

        <h1 className="text-3xl font-bold mb-3">Something went wrong</h1>
        <p className="text-muted-foreground mb-6">
          An unexpected error occurred. We apologize for the inconvenience.
          Please try again or return to the home page.
        </p>

        {process.env.NODE_ENV === "development" && (
          <div className="mb-6 p-4 bg-muted rounded-lg text-left">
            <p className="text-xs font-mono text-danger break-all">
              {error.message}
            </p>
            {error.digest && (
              <p className="text-xs text-muted-foreground mt-2">
                Error ID: {error.digest}
              </p>
            )}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button startContent={<RefreshCw size={16} />} onClick={reset}>
            Try Again
          </Button>
          <Button variant="outline" asChild>
            <Link href="/">
              <Home size={16} />
              Go Home
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
