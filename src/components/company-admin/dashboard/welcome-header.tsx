"use client";

import { useSession } from "next-auth/react";

interface WelcomeHeaderProps {
  companyName?: string;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function WelcomeHeader({ companyName }: WelcomeHeaderProps) {
  const { data: session } = useSession();
  const userName = session?.user?.name?.split(" ")[0] || "there";

  return (
    <div className="mb-6">
      <h1 className="text-2xl font-bold">
        {getGreeting()}, {userName}! 👋
      </h1>
      <p className="text-default-500 mt-1">
        {companyName
          ? `Here's what's happening with ${companyName} today.`
          : "Here's what's happening with your support today."}
      </p>
    </div>
  );
}
