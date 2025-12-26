import { redirect } from "next/navigation";

import { MasterAdminLayout } from "@/components/layouts";
import { auth } from "@/lib/auth";

export default async function MasterAdminRouteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  // Require master admin role
  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== "chatapp.master_admin") {
    redirect("/unauthorized");
  }

  return <MasterAdminLayout>{children}</MasterAdminLayout>;
}
