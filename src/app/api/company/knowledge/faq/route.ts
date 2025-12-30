import { NextRequest, NextResponse } from "next/server";
import { and, count, desc, eq, isNull } from "drizzle-orm";

import { requireCompanyAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { faqItems } from "@/lib/db/schema";
import { getProcessingPipeline } from "@/lib/knowledge/processing-pipeline";

export interface FaqListItem {
  id: string;
  question: string;
  answer: string;
  category: string | null;
  tags: string[];
  priority: number;
  usageCount: number;
  helpfulCount: number;
  notHelpfulCount: number;
  createdAt: string;
  updatedAt: string;
}

export async function GET(request: NextRequest) {
  try {
    const { company } = await requireCompanyAdmin();

    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = (page - 1) * limit;

    // Build where conditions
    const conditions = [
      eq(faqItems.companyId, company.id),
      isNull(faqItems.deletedAt),
    ];

    if (category && category !== "all") {
      conditions.push(eq(faqItems.category, category));
    }

    // Get total count
    const [totalResult] = await db
      .select({ count: count() })
      .from(faqItems)
      .where(and(...conditions));

    // Get FAQs
    const faqs = await db
      .select()
      .from(faqItems)
      .where(and(...conditions))
      .orderBy(desc(faqItems.priority), desc(faqItems.createdAt))
      .limit(limit)
      .offset(offset);

    const faqList: FaqListItem[] = faqs.map((faq) => ({
      id: faq.id,
      question: faq.question,
      answer: faq.answer,
      category: faq.category,
      tags: (faq.tags as string[]) || [],
      priority: faq.priority,
      usageCount: faq.usageCount,
      helpfulCount: faq.helpfulCount,
      notHelpfulCount: faq.notHelpfulCount,
      createdAt: faq.createdAt.toISOString(),
      updatedAt: faq.updatedAt.toISOString(),
    }));

    // Get categories for filtering
    const categories = await db
      .selectDistinct({ category: faqItems.category })
      .from(faqItems)
      .where(
        and(
          eq(faqItems.companyId, company.id),
          isNull(faqItems.deletedAt)
        )
      );

    return NextResponse.json({
      faqs: faqList,
      categories: categories
        .map((c) => c.category)
        .filter((c): c is string => c !== null),
      pagination: {
        page,
        limit,
        total: totalResult?.count ?? 0,
        totalPages: Math.ceil((totalResult?.count ?? 0) / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching FAQs:", error);
    return NextResponse.json(
      { error: "Failed to fetch FAQs" },
      { status: 500 }
    );
  }
}

interface CreateFaqRequest {
  question: string;
  answer: string;
  category?: string;
  tags?: string[];
  keywords?: string[];
  priority?: number;
}

export async function POST(request: NextRequest) {
  try {
    const { company } = await requireCompanyAdmin();

    const body: CreateFaqRequest = await request.json();

    if (!body.question?.trim()) {
      return NextResponse.json(
        { error: "Question is required" },
        { status: 400 }
      );
    }

    if (!body.answer?.trim()) {
      return NextResponse.json(
        { error: "Answer is required" },
        { status: 400 }
      );
    }

    const [newFaq] = await db
      .insert(faqItems)
      .values({
        companyId: company.id,
        question: body.question.trim(),
        answer: body.answer.trim(),
        category: body.category || null,
        tags: body.tags || [],
        keywords: body.keywords || [],
        priority: body.priority ?? 0,
      })
      .returning();

    if (!newFaq) {
      return NextResponse.json(
        { error: "Failed to create FAQ" },
        { status: 500 }
      );
    }

    // Index FAQ in Qdrant for semantic search (async, don't wait)
    setImmediate(async () => {
      try {
        const pipeline = getProcessingPipeline();
        await pipeline.processFaq(newFaq.id, { useQdrant: true });
      } catch (error) {
        console.error(`Failed to index FAQ ${newFaq.id} in Qdrant:`, error);
      }
    });

    return NextResponse.json({ faq: newFaq }, { status: 201 });
  } catch (error) {
    console.error("Error creating FAQ:", error);
    return NextResponse.json(
      { error: "Failed to create FAQ" },
      { status: 500 }
    );
  }
}
