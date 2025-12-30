import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";

import { requireCompanyAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { knowledgeSources } from "@/lib/db/schema";
import { deleteChunksBySource } from "@/lib/knowledge/qdrant-client";

export interface KnowledgeSourceDetail {
  id: string;
  name: string;
  description: string | null;
  type: string;
  status: string;
  sourceConfig: Record<string, unknown>;
  chunkCount: number;
  tokenCount: number;
  processingError: string | null;
  lastProcessedAt: string | null;
  vectorCollectionId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
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

    const [source] = await db
      .select()
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

    const sourceDetail: KnowledgeSourceDetail = {
      id: source.id,
      name: source.name,
      description: source.description,
      type: source.type,
      status: source.status,
      sourceConfig: source.sourceConfig as Record<string, unknown>,
      chunkCount: source.chunkCount,
      tokenCount: source.tokenCount,
      processingError: source.processingError,
      lastProcessedAt: source.lastProcessedAt?.toISOString() ?? null,
      vectorCollectionId: source.vectorCollectionId,
      metadata: (source.metadata as Record<string, unknown>) || {},
      createdAt: source.createdAt.toISOString(),
      updatedAt: source.updatedAt.toISOString(),
    };

    return NextResponse.json({ source: sourceDetail });
  } catch (error) {
    console.error("Error fetching knowledge source:", error);
    return NextResponse.json(
      { error: "Failed to fetch knowledge source" },
      { status: 500 }
    );
  }
}

interface UpdateKnowledgeSourceRequest {
  name?: string;
  description?: string;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ sourceId: string }> }
) {
  try {
    const { company } = await requireCompanyAdmin();
    const { sourceId } = await params;

    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const body: UpdateKnowledgeSourceRequest = await request.json();

    // Verify source belongs to company
    const [existingSource] = await db
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

    if (!existingSource) {
      return NextResponse.json(
        { error: "Knowledge source not found" },
        { status: 404 }
      );
    }

    // Build update object
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (body.name !== undefined) {
      updateData.name = body.name;
    }

    if (body.description !== undefined) {
      updateData.description = body.description;
    }

    const [updatedSource] = await db
      .update(knowledgeSources)
      .set(updateData)
      .where(eq(knowledgeSources.id, sourceId))
      .returning();

    return NextResponse.json({ source: updatedSource });
  } catch (error) {
    console.error("Error updating knowledge source:", error);
    return NextResponse.json(
      { error: "Failed to update knowledge source" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ sourceId: string }> }
) {
  try {
    const { company } = await requireCompanyAdmin();
    const { sourceId } = await params;

    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    // Verify source belongs to company
    const [existingSource] = await db
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

    if (!existingSource) {
      return NextResponse.json(
        { error: "Knowledge source not found" },
        { status: 404 }
      );
    }

    // Soft delete the source
    await db
      .update(knowledgeSources)
      .set({
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(knowledgeSources.id, sourceId));

    // Delete chunks from Qdrant vector store in background
    setImmediate(async () => {
      try {
        console.log(`[Knowledge Delete] Removing chunks for source ${sourceId} from Qdrant...`);
        await deleteChunksBySource(sourceId);
        console.log(`[Knowledge Delete] Successfully removed chunks for source ${sourceId}`);
      } catch (error) {
        console.error(`[Knowledge Delete] Failed to remove chunks for source ${sourceId}:`, error);
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting knowledge source:", error);
    return NextResponse.json(
      { error: "Failed to delete knowledge source" },
      { status: 500 }
    );
  }
}
