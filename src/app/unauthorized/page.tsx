"use client";

import { ShieldX } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui";
import { useAuth } from "@/hooks/useAuth";

export default function UnauthorizedPage() {
  const router = useRouter();
  const { user, logout } = useAuth();

  const handleGoBack = () => {
    router.back();
  };

  const handleGoHome = () => {
    if (user) {
      // User roles are now only master_admin or user
      // Company-specific roles (company_admin, support_agent) are in company_permissions
      if (user.role === "chatapp.master_admin") {
        router.push("/admin/dashboard");
      } else {
        // Regular users go to company selection
        router.push("/companies");
      }
    } else {
      router.push("/login");
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <div className="text-center max-w-md">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-danger/10 mb-6">
          <ShieldX className="w-10 h-10 text-danger" />
        </div>

        <h1 className="text-3xl font-bold mb-2">Access Denied</h1>
        <p className="text-muted-foreground mb-8">
          You don&apos;t have permission to access this page. Please contact your
          administrator if you believe this is an error.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button variant="outline" onClick={handleGoBack}>
            Go Back
          </Button>
          <Button color="primary" onClick={handleGoHome}>
            Go to Dashboard
          </Button>
        </div>

        {user && (
          <div className="mt-8 pt-6 border-t border-divider">
            <p className="text-sm text-muted-foreground mb-3">
              Signed in as <span className="font-medium">{user.email}</span>
            </p>
            <Button variant="ghost" size="sm" onClick={logout}>
              Sign out
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
