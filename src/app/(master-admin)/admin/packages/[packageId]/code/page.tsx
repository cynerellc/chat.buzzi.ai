"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { useSetBreadcrumbs } from "@/contexts/page-context";
import { CodeEditor } from "@/components/shared/code-editor";

interface CodeEditorPageProps {
  params: Promise<{ packageId: string }>;
}

export default function CodeEditorPage({ params }: CodeEditorPageProps) {
  const { packageId } = use(params);
  const router = useRouter();

  const [packageName, setPackageName] = useState<string>("Package");
  const [packageSlug, setPackageSlug] = useState<string>("");

  // Fetch package info on mount
  useEffect(() => {
    let cancelled = false;

    async function fetchPackageInfo() {
      try {
        const response = await fetch(`/api/master-admin/packages/${packageId}`);
        if (response.ok && !cancelled) {
          const data = await response.json();
          setPackageName(data.package?.name ?? "Package");
          setPackageSlug(data.package?.slug ?? packageId);
        }
      } catch (err) {
        console.error("Failed to fetch package info:", err);
      }
    }

    fetchPackageInfo();

    return () => {
      cancelled = true;
    };
  }, [packageId]);

  const breadcrumbs = useMemo(() => [
    { label: "Chatbot Packages", href: "/admin/packages" },
    { label: packageName, href: `/admin/packages/${packageId}` },
    { label: "Code Editor" },
  ], [packageName, packageId]);

  useSetBreadcrumbs(breadcrumbs);

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
