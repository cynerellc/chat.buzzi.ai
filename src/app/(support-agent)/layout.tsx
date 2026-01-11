import { SupportAgentLayout } from "@/components/layouts";
import { requireSupportAgent } from "@/lib/auth/guards";

export default async function SupportAgentRouteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // requireSupportAgent handles:
  // 1. Authentication check (redirects to /login if not authenticated)
  // 2. Company selection check (redirects to /companies if no active company)
  // 3. Permission check (requires at least support_agent permission, or company_admin, or master_admin)
  const { company } = await requireSupportAgent();

  return <SupportAgentLayout companyName={company.name}>{children}</SupportAgentLayout>;
}
