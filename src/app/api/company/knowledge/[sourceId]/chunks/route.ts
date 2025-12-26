import { NextRequest, NextResponse } from "next/server";
import { and, asc, eq, isNull } from "drizzle-orm";

import { requireCompanyAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { knowledgeSources, knowledgeChunks } from "@/lib/db/schema";

export interface ChunkItem {
  id: string;
  chunkIndex: number;
  content: string;
  tokenCount: number;
  vectorId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sourceId: string }> }
) {
  try {
    const { company } = await requireCompanyAdmin();
    const { sourceId } = await params;

    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = (page - 1) * limit;

    // Verify source belongs to company
    const [source] = await db
      .select({ id: knowledgeSources.id })
      .from(knowledgeSources)
      .where(
        and(
          eq(knowledgeSources.id, sourceId),
          eq(knowledgeSources.companyId, company.id),
          isNull(knowledgeSources.deletedAt)
        )
      )
      .limit(1);

    if (!source) {
      return NextResponse.json(
        { error: "Knowledge source not found" },
        { status: 404 }
      );
    }

    // Get chunks
    const chunks = await db
      .select()
      .from(knowledgeChunks)
      .where(eq(knowledgeChunks.sourceId, sourceId))
      .orderBy(asc(knowledgeChunks.chunkIndex))
      .limit(limit)
      .offset(offset);

    const chunkList: ChunkItem[] = chunks.map((chunk) => ({
      id: chunk.id,
      chunkIndex: chunk.chunkIndex,
      content: chunk.content,
      tokenCount: chunk.tokenCount,
      vectorId: chunk.vectorId,
      metadata: (chunk.metadata as Record<string, unknown>) || {},
      createdAt: chunk.createdAt.toISOString(),
    }));

    return NextResponse.json({
      chunks: chunkList,
      pagination: {
        page,
        limit,
        hasMore: chunks.length === limit,
      },
    });
  } catch (error) {
    console.error("Error fetching chunks:", error);
    return NextResponse.json(
      { error: "Failed to fetch chunks" },
      { status: 500 }
    );
  }
}
