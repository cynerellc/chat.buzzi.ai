"use client";

import { Button } from "@heroui/react";
import { ShieldX } from "lucide-react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/hooks/useAuth";

export default function UnauthorizedPage() {
  const router = useRouter();
  const { user, logout } = useAuth();

  const handleGoBack = () => {
    router.back();
  };

  const handleGoHome = () => {
    if (user) {
      switch (user.role) {
        case "master_admin":
          router.push("/admin/dashboard");
          break;
        case "company_admin":
          router.push("/dashboard");
          break;
        case "support_agent":
          router.push("/inbox");
          break;
        default:
          router.push("/");
      }
    } else {
      router.push("/login");
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-background to-default-100 p-4">
      <div className="text-center max-w-md">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-danger/10 mb-6">
          <ShieldX className="w-10 h-10 text-danger" />
        </div>

        <h1 className="text-3xl font-bold mb-2">Access Denied</h1>
        <p className="text-default-500 mb-8">
          You don&apos;t have permission to access this page. Please contact your
          administrator if you believe this is an error.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button variant="bordered" onClick={handleGoBack}>
            Go Back
          </Button>
          <Button color="primary" onClick={handleGoHome}>
            Go to Dashboard
          </Button>
        </div>

        {user && (
          <div className="mt-8 pt-6 border-t border-divider">
            <p className="text-sm text-default-400 mb-3">
              Signed in as <span className="font-medium">{user.email}</span>
            </p>
            <Button variant="light" size="sm" onClick={logout}>
              Sign out
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
