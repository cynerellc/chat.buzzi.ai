import { NextRequest, NextResponse } from "next/server";
import { and, count, desc, eq, isNull } from "drizzle-orm";

import { requireMasterAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { companies } from "@/lib/db/schema/companies";
import { knowledgeSources } from "@/lib/db/schema";
import { triggerBackgroundIndexing } from "@/lib/knowledge/processing-pipeline";
import { getSupabaseClient, STORAGE_BUCKET } from "@/lib/supabase/client";

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

interface CreateKnowledgeSourceRequest {
  name: string;
  description?: string;
  type: "file" | "url" | "text";
  category?: string;
  sourceConfig: {
    // For file
    fileName?: string;
    fileType?: string;
    fileSize?: number;
    storagePath?: string;
    // For url
    url?: string;
    crawlDepth?: number;
    // For text
    content?: string;
  };
}

export async function POST(request: NextRequest, context: RouteContext) {
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

    const body: CreateKnowledgeSourceRequest = await request.json();

    if (!body.name) {
      return NextResponse.json(
        { error: "Source name is required" },
        { status: 400 }
      );
    }

    if (!body.type) {
      return NextResponse.json(
        { error: "Source type is required" },
        { status: 400 }
      );
    }

    // Validate source config based on type
    if (body.type === "url" && !body.sourceConfig?.url) {
      return NextResponse.json(
        { error: "URL is required for URL sources" },
        { status: 400 }
      );
    }

    if (body.type === "text" && !body.sourceConfig?.content) {
      return NextResponse.json(
        { error: "Content is required for text sources" },
        { status: 400 }
      );
    }

    // Create the knowledge source
    const [newSource] = await db
      .insert(knowledgeSources)
      .values({
        companyId,
        name: body.name,
        description: body.description || null,
        type: body.type,
        category: body.category || null,
        status: "pending",
        sourceConfig: body.sourceConfig,
      })
      .returning();

    if (!newSource) {
      return NextResponse.json(
        { error: "Failed to create knowledge source" },
        { status: 500 }
      );
    }

    // Trigger background indexing immediately
    if (body.type === "file" && body.sourceConfig.storagePath) {
      // For files, download from Supabase and trigger indexing
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .download(body.sourceConfig.storagePath);

      if (!error && data) {
        const buffer = Buffer.from(await data.arrayBuffer());
        triggerBackgroundIndexing(newSource.id, "file", {
          fileBuffer: buffer,
          fileType: body.sourceConfig.fileType,
          fileName: body.sourceConfig.fileName,
        });
      }
    } else if (body.type === "url" && body.sourceConfig.url) {
      triggerBackgroundIndexing(newSource.id, "url", {
        url: body.sourceConfig.url,
      });
    } else if (body.type === "text" && body.sourceConfig.content) {
      triggerBackgroundIndexing(newSource.id, "text", {
        content: body.sourceConfig.content,
      });
    }

    return NextResponse.json({ source: newSource }, { status: 201 });
  } catch (error) {
    console.error("Error creating knowledge source:", error);
    return NextResponse.json(
      { error: "Failed to create knowledge source" },
      { status: 500 }
    );
  }
}
