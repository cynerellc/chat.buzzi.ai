import { redirect } from "next/navigation";

interface CompanyDetailsPageProps {
  params: Promise<{ companyId: string }>;
}

export default async function CompanyDetailsPage({ params }: CompanyDetailsPageProps) {
  const { companyId } = await params;
  redirect(`/admin/companies/${companyId}/overview`);
}
