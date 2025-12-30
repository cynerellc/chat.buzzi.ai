import { NextRequest, NextResponse } from "next/server";
import { and, count, desc, eq, isNull } from "drizzle-orm";

import { requireMasterAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { companies } from "@/lib/db/schema/companies";
import { knowledgeSources } from "@/lib/db/schema";

export interface KnowledgeSourceListItem {
  id: string;
  name: string;
  description: string | null;
  type: string;
  status: string;
  category: string | null;
  chunkCount: number;
  tokenCount: number;
  processingError: string | null;
  lastProcessedAt: string | null;
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
    const type = searchParams.get("type");
    const status = searchParams.get("status");
    const category = searchParams.get("category");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = (page - 1) * limit;

    // Build where conditions
    const conditions = [
      eq(knowledgeSources.companyId, companyId),
      isNull(knowledgeSources.deletedAt),
    ];

    if (type && type !== "all") {
      conditions.push(
        eq(knowledgeSources.type, type as "file" | "url" | "text")
      );
    }

    if (status && status !== "all") {
      conditions.push(
        eq(knowledgeSources.status, status as "pending" | "processing" | "indexed" | "failed")
      );
    }

    if (category) {
      if (category === "uncategorized") {
        conditions.push(isNull(knowledgeSources.category));
      } else {
        conditions.push(eq(knowledgeSources.category, category));
      }
    }

    // Get total count
    const [totalResult] = await db
      .select({ count: count() })
      .from(knowledgeSources)
      .where(and(...conditions));

    // Get sources
    const sources = await db
      .select()
      .from(knowledgeSources)
      .where(and(...conditions))
      .orderBy(desc(knowledgeSources.createdAt))
      .limit(limit)
      .offset(offset);

    const sourceList: KnowledgeSourceListItem[] = sources.map((source) => ({
      id: source.id,
      name: source.name,
      description: source.description,
      type: source.type,
      status: source.status,
      category: source.category,
      chunkCount: source.chunkCount,
      tokenCount: source.tokenCount,
      processingError: source.processingError,
      lastProcessedAt: source.lastProcessedAt?.toISOString() ?? null,
      createdAt: source.createdAt.toISOString(),
      updatedAt: source.updatedAt.toISOString(),
    }));

    // Get status counts
    const statusCounts = await db
      .select({
        status: knowledgeSources.status,
        count: count(),
      })
      .from(knowledgeSources)
      .where(
        and(
          eq(knowledgeSources.companyId, companyId),
          isNull(knowledgeSources.deletedAt)
        )
      )
      .groupBy(knowledgeSources.status);

    const statusCountMap: Record<string, number> = {};
    statusCounts.forEach((sc) => {
      statusCountMap[sc.status] = sc.count;
    });

    return NextResponse.json({
      sources: sourceList,
      pagination: {
        page,
        limit,
        total: totalResult?.count ?? 0,
        totalPages: Math.ceil((totalResult?.count ?? 0) / limit),
      },
      statusCounts: statusCountMap,
    });
  } catch (error) {
    console.error("Error fetching knowledge sources:", error);
    return NextResponse.json(
      { error: "Failed to fetch knowledge sources" },
      { status: 500 }
    );
  }
}
