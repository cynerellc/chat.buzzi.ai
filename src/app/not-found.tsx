"use client";

import { FileQuestion, Home, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui";

export default function NotFound() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 mx-auto rounded-full bg-warning/10 flex items-center justify-center mb-6">
          <FileQuestion className="w-10 h-10 text-warning" />
        </div>

        <h1 className="text-6xl font-bold text-primary mb-4">404</h1>
        <h2 className="text-2xl font-semibold mb-3">Page Not Found</h2>
        <p className="text-default-500 mb-8">
          The page you are looking for does not exist or has been moved.
          Please check the URL or return to the home page.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            as={Link}
            href="/"
            color="primary"
            leftIcon={Home}
          >
            Go Home
          </Button>
          <Button
            variant="bordered"
            leftIcon={ArrowLeft}
            onPress={() => router.back()}
          >
            Go Back
          </Button>
        </div>
      </div>
    </div>
  );
}
