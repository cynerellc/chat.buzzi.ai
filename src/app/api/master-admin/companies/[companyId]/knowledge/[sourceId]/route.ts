import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";

import { requireMasterAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { companies } from "@/lib/db/schema/companies";
import { knowledgeSources } from "@/lib/db/schema";
import { deleteChunksBySource } from "@/lib/knowledge/qdrant-client";

interface RouteContext {
  params: Promise<{ companyId: string; sourceId: string }>;
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    await requireMasterAdmin();
    const { companyId, sourceId } = await context.params;

    // Verify company exists
    const [company] = await db
      .select({ id: companies.id })
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1);

    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    // Verify source exists and belongs to company
    const [source] = await db
      .select()
      .from(knowledgeSources)
      .where(
        and(
          eq(knowledgeSources.id, sourceId),
          eq(knowledgeSources.companyId, companyId),
          isNull(knowledgeSources.deletedAt)
        )
      )
      .limit(1);

    if (!source) {
      return NextResponse.json({ error: "Knowledge source not found" }, { status: 404 });
    }

    // Soft delete the source
    await db
      .update(knowledgeSources)
      .set({
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(knowledgeSources.id, sourceId));

    // Delete from Qdrant in background
    setImmediate(async () => {
      try {
        await deleteChunksBySource(sourceId);
        console.log(`[Knowledge Delete] Removed chunks for source ${sourceId}`);
      } catch (error) {
        console.error(`[Knowledge Delete] Failed to remove chunks for source ${sourceId}:`, error);
      }
    });

    return NextResponse.json({
      success: true,
      deletedChunks: source.chunkCount,
    });
  } catch (error) {
    console.error("Error deleting knowledge source:", error);
    return NextResponse.json(
      { error: "Failed to delete knowledge source" },
      { status: 500 }
    );
  }
}
