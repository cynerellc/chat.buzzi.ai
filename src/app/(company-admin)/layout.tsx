import { redirect } from "next/navigation";

import { CompanyAdminLayout } from "@/components/layouts";
import { requireCompanyAdmin } from "@/lib/auth/guards";

export default async function CompanyAdminRouteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // requireCompanyAdmin handles:
  // 1. Authentication check (redirects to /login if not authenticated)
  // 2. Company selection check (redirects to /companies if no active company)
  // 3. Permission check (redirects to /unauthorized if no company_admin permission)
  // 4. Master admins have access everywhere
  const { company } = await requireCompanyAdmin();

  return <CompanyAdminLayout companyName={company.name}>{children}</CompanyAdminLayout>;
}
