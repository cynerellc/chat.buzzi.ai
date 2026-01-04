"use client";

import { use, useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

import { useSetPageTitle } from "@/contexts/page-context";
import { CodeEditor } from "@/components/shared/code-editor";

interface CodeEditorPageProps {
  params: Promise<{ packageId: string }>;
}

export default function CodeEditorPage({ params }: CodeEditorPageProps) {
  useSetPageTitle("Code Editor");
  const { packageId } = use(params);
  const router = useRouter();

  const [packageName, setPackageName] = useState<string>("Package");
  const [packageSlug, setPackageSlug] = useState<string>("");

  // Fetch package info
  const fetchPackageInfo = useCallback(async () => {
    try {
      const response = await fetch(`/api/master-admin/packages/${packageId}`);
      if (response.ok) {
        const data = await response.json();
        setPackageName(data.package?.name ?? "Package");
        setPackageSlug(data.package?.slug ?? packageId);
      }
    } catch (err) {
      console.error("Failed to fetch package info:", err);
    }
  }, [packageId]);

  useEffect(() => {
    fetchPackageInfo();
  }, [fetchPackageInfo]);

  return (
    <CodeEditor
      packageId={packageId}
      packageName={packageName}
      packageSlug={packageSlug}
      apiBasePath="/api/master-admin/packages"
      showHeader={true}
      showPackButton={true}
      onBack={() => router.push("/admin/packages")}
      className="h-screen"
    />
  );
}
