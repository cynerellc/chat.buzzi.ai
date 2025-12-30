import { NextRequest, NextResponse } from "next/server";
import { and, count, desc, eq, isNull } from "drizzle-orm";

import { requireMasterAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { companies } from "@/lib/db/schema/companies";
import { faqItems } from "@/lib/db/schema/knowledge";

export interface FaqListItem {
  id: string;
  question: string;
  answer: string;
  category: string | null;
  tags: string[];
  keywords: string[];
  priority: number;
  usageCount: number;
  helpfulCount: number;
  notHelpfulCount: number;
  createdAt: string;
  updatedAt: string;
}

interface RouteContext {
  params: Promise<{ companyId: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    await requireMasterAdmin();
    const { companyId } = await context.params;

    // Verify company exists
    const [company] = await db
      .select({ id: companies.id })
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1);

    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "100");
    const offset = (page - 1) * limit;

    // Build where conditions
    const conditions = [
      eq(faqItems.companyId, companyId),
      isNull(faqItems.deletedAt),
    ];

    if (category && category !== "all") {
      if (category === "uncategorized") {
        conditions.push(isNull(faqItems.category));
      } else {
        conditions.push(eq(faqItems.category, category));
      }
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
      keywords: (faq.keywords as string[]) || [],
      priority: faq.priority,
      usageCount: faq.usageCount,
      helpfulCount: faq.helpfulCount,
      notHelpfulCount: faq.notHelpfulCount,
      createdAt: faq.createdAt.toISOString(),
      updatedAt: faq.updatedAt.toISOString(),
    }));

    // Get unique categories for FAQs
    const categoriesResult = await db
      .selectDistinct({ category: faqItems.category })
      .from(faqItems)
      .where(
        and(
          eq(faqItems.companyId, companyId),
          isNull(faqItems.deletedAt)
        )
      );

    const categories = categoriesResult
      .map((c) => c.category)
      .filter((c): c is string => c !== null);

    return NextResponse.json({
      faqs: faqList,
      categories,
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
