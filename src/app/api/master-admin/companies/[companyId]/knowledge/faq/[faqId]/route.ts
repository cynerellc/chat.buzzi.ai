import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";

import { requireMasterAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { companies } from "@/lib/db/schema/companies";
import { faqItems } from "@/lib/db/schema/knowledge";
import { deleteFaq as deleteQdrantFaq } from "@/lib/knowledge/qdrant-client";

interface RouteContext {
  params: Promise<{ companyId: string; faqId: string }>;
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    await requireMasterAdmin();
    const { companyId, faqId } = await context.params;

    // Verify company exists
    const [company] = await db
      .select({ id: companies.id })
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1);

    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    // Verify FAQ exists and belongs to company
    const [faq] = await db
      .select()
      .from(faqItems)
      .where(
        and(
          eq(faqItems.id, faqId),
          eq(faqItems.companyId, companyId),
          isNull(faqItems.deletedAt)
        )
      )
      .limit(1);

    if (!faq) {
      return NextResponse.json({ error: "FAQ not found" }, { status: 404 });
    }

    // Soft delete the FAQ
    await db
      .update(faqItems)
      .set({
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(faqItems.id, faqId));

    // Delete from Qdrant in background
    setImmediate(async () => {
      try {
        await deleteQdrantFaq(faqId);
        console.log(`[FAQ Delete] Removed FAQ ${faqId} from Qdrant`);
      } catch (error) {
        console.error(`[FAQ Delete] Failed to remove FAQ ${faqId}:`, error);
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting FAQ:", error);
    return NextResponse.json(
      { error: "Failed to delete FAQ" },
      { status: 500 }
    );
  }
}
