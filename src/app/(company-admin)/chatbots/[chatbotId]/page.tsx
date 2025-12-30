import { redirect } from "next/navigation";

interface PageProps {
  params: Promise<{ chatbotId: string }>;
}

export default async function ChatbotDetailPage({ params }: PageProps) {
  const { chatbotId } = await params;
  redirect(`/chatbots/${chatbotId}/general`);
}
