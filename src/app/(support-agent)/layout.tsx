import { redirect } from "next/navigation";

import { SupportAgentLayout } from "@/components/layouts";
import { auth } from "@/lib/auth";
import { getCurrentCompany } from "@/lib/auth/tenant";

export default async function SupportAgentRouteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  // Require authentication
  if (!session?.user) {
    redirect("/login");
  }

  // All roles can access support agent features
  // (support_agent, company_admin, master_admin)

  // Get company details
  const company = await getCurrentCompany();
  const companyName = company?.name ?? undefined;

  return <SupportAgentLayout companyName={companyName}>{children}</SupportAgentLayout>;
}
