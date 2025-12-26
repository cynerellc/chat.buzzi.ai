/**
 * Knowledge Search API
 *
 * POST /api/company/knowledge/search - Search knowledge base
 */

import { NextRequest, NextResponse } from "next/server";

import { requireCompanyAccess } from "@/lib/auth/guards";
import { searchKnowledge, type SearchOptions } from "@/lib/knowledge";

interface SearchRequest {
  query: string;
  limit?: number;
  minScore?: number;
  sources?: string[];
  searchFaqs?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    // Allow both admins and support agents to search
    const { company } = await requireCompanyAccess();

    const body: SearchRequest = await request.json();

    if (!body.query?.trim()) {
      return NextResponse.json(
        { error: "Search query is required" },
        { status: 400 }
      );
    }

    const options: SearchOptions = {
      limit: body.limit ?? 5,
      minScore: body.minScore ?? 0.7,
      sources: body.sources,
      searchFaqs: body.searchFaqs ?? true,
      includeMetadata: true,
    };

    const context = await searchKnowledge(body.query, company.id, options);

    return NextResponse.json({
      chunks: context.chunks,
      faqs: context.faqs,
      totalResults: context.totalResults,
      searchTimeMs: context.searchTimeMs,
    });
  } catch (error) {
    console.error("Error searching knowledge base:", error);
    return NextResponse.json(
      { error: "Failed to search knowledge base" },
      { status: 500 }
    );
  }
}
