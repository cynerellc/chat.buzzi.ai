import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";

import { requireCompanyAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { faqItems } from "@/lib/db/schema";
import { getProcessingPipeline } from "@/lib/knowledge/processing-pipeline";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ faqId: string }> }
) {
  try {
    const { company } = await requireCompanyAdmin();
    const { faqId } = await params;

    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const [faq] = await db
      .select()
      .from(faqItems)
      .where(
        and(
          eq(faqItems.id, faqId),
          eq(faqItems.companyId, company.id),
          isNull(faqItems.deletedAt)
        )
      )
      .limit(1);

    if (!faq) {
      return NextResponse.json({ error: "FAQ not found" }, { status: 404 });
    }

    return NextResponse.json({ faq });
  } catch (error) {
    console.error("Error fetching FAQ:", error);
    return NextResponse.json(
      { error: "Failed to fetch FAQ" },
      { status: 500 }
    );
  }
}

interface UpdateFaqRequest {
  question?: string;
  answer?: string;
  category?: string | null;
  tags?: string[];
  keywords?: string[];
  priority?: number;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ faqId: string }> }
) {
  try {
    const { company } = await requireCompanyAdmin();
    const { faqId } = await params;

    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const body: UpdateFaqRequest = await request.json();

    // Verify FAQ belongs to company
    const [existingFaq] = await db
      .select({ id: faqItems.id })
      .from(faqItems)
      .where(
        and(
          eq(faqItems.id, faqId),
          eq(faqItems.companyId, company.id),
          isNull(faqItems.deletedAt)
        )
      )
      .limit(1);

    if (!existingFaq) {
      return NextResponse.json({ error: "FAQ not found" }, { status: 404 });
    }

    // Build update object
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (body.question !== undefined) {
      updateData.question = body.question.trim();
    }

    if (body.answer !== undefined) {
      updateData.answer = body.answer.trim();
    }

    if (body.category !== undefined) {
      updateData.category = body.category;
    }

    if (body.tags !== undefined) {
      updateData.tags = body.tags;
    }

    if (body.keywords !== undefined) {
      updateData.keywords = body.keywords;
    }

    if (body.priority !== undefined) {
      updateData.priority = body.priority;
    }

    const [updatedFaq] = await db
      .update(faqItems)
      .set(updateData)
      .where(eq(faqItems.id, faqId))
      .returning();

    // Re-index FAQ if question or answer changed
    if (body.question !== undefined || body.answer !== undefined || body.category !== undefined) {
      setImmediate(async () => {
        try {
          const pipeline = getProcessingPipeline();
          await pipeline.processFaq(faqId, { useQdrant: true });
        } catch (error) {
          console.error(`Failed to re-index FAQ ${faqId} in Qdrant:`, error);
        }
      });
    }

    return NextResponse.json({ faq: updatedFaq });
  } catch (error) {
    console.error("Error updating FAQ:", error);
    return NextResponse.json(
      { error: "Failed to update FAQ" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ faqId: string }> }
) {
  try {
    const { company } = await requireCompanyAdmin();
    const { faqId } = await params;

    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    // Verify FAQ belongs to company
    const [existingFaq] = await db
      .select({ id: faqItems.id })
      .from(faqItems)
      .where(
        and(
          eq(faqItems.id, faqId),
          eq(faqItems.companyId, company.id),
          isNull(faqItems.deletedAt)
        )
      )
      .limit(1);

    if (!existingFaq) {
      return NextResponse.json({ error: "FAQ not found" }, { status: 404 });
    }

    // Soft delete
    await db
      .update(faqItems)
      .set({
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(faqItems.id, faqId));

    // Remove from Qdrant vector store
    setImmediate(async () => {
      try {
        const pipeline = getProcessingPipeline();
        await pipeline.deleteFaqEmbedding(faqId);
      } catch (error) {
        console.error(`Failed to remove FAQ ${faqId} from Qdrant:`, error);
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
