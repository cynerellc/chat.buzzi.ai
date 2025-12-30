import { redirect } from "next/navigation";

interface ChatbotDetailsPageProps {
  params: Promise<{ companyId: string; chatbotId: string }>;
}

export default async function ChatbotDetailsPage({ params }: ChatbotDetailsPageProps) {
  const { companyId, chatbotId } = await params;
  redirect(`/admin/companies/${companyId}/chatbots/${chatbotId}/general`);
}
