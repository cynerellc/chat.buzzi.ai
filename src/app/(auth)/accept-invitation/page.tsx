import { Suspense } from "react";

import { AcceptInvitationForm } from "@/components/auth";

export const metadata = {
  title: "Accept Invitation | Chat Buzzi",
  description: "Accept your team invitation to Chat Buzzi",
};

export default function AcceptInvitationPage() {
  return (
    <Suspense fallback={<AcceptInvitationFormSkeleton />}>
      <AcceptInvitationForm />
    </Suspense>
  );
}

function AcceptInvitationFormSkeleton() {
  return (
    <div className="w-full max-w-md animate-pulse">
      <div className="text-center mb-8">
        <div className="w-12 h-12 bg-muted rounded-full mx-auto mb-4" />
        <div className="h-8 bg-muted rounded w-48 mx-auto mb-2" />
        <div className="h-4 bg-muted rounded w-64 mx-auto" />
      </div>
      <div className="h-20 bg-muted rounded mb-6" />
      <div className="space-y-4">
        <div className="h-14 bg-muted rounded" />
        <div className="h-14 bg-muted rounded" />
        <div className="h-14 bg-muted rounded" />
        <div className="h-12 bg-muted rounded" />
      </div>
    </div>
  );
}
