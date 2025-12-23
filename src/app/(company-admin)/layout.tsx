import { redirect } from "next/navigation";

import { CompanyAdminLayout } from "@/components/layouts";
import { auth } from "@/lib/auth";
import { getCurrentCompany } from "@/lib/auth/tenant";

export default async function CompanyAdminRouteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  // Require authentication
  if (!session?.user) {
    redirect("/login");
  }

  // Require company admin or master admin role
  if (session.user.role !== "company_admin" && session.user.role !== "master_admin") {
    redirect("/unauthorized");
  }

  // Get company details
  const company = await getCurrentCompany();
  const companyName = company?.name ?? undefined;

  return <CompanyAdminLayout companyName={companyName}>{children}</CompanyAdminLayout>;
}
