/**
 * Knowledge Source Processing API
 *
 * POST /api/company/knowledge/[sourceId]/process - Trigger processing
 */

import { NextRequest, NextResponse } from "next/server";
import { eq, and, isNull } from "drizzle-orm";

import { requireCompanyAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { knowledgeSources } from "@/lib/db/schema";
import {
  processKnowledgeFile,
  processKnowledgeUrl,
  processKnowledgeText,
} from "@/lib/knowledge";

interface RouteParams {
  sourceId: string;
}

interface SourceConfig {
  // For file
  fileName?: string;
  fileType?: string;
  storagePath?: string;
  // For url
  url?: string;
  // For text
  content?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<RouteParams> }
) {
  try {
    const { company } = await requireCompanyAdmin();
    const { sourceId } = await params;

    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    // Get the knowledge source
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

    // Check if already processing
    if (source.status === "processing") {
      return NextResponse.json(
        { error: "Source is already being processed" },
        { status: 400 }
      );
    }

    const sourceConfig = source.sourceConfig as SourceConfig;

    // Process based on type
    let result;

    switch (source.type) {
      case "file": {
        // For files, we need to fetch from storage
        if (!sourceConfig.storagePath) {
          return NextResponse.json(
            { error: "File storage path not found" },
            { status: 400 }
          );
        }

        // Fetch file from storage (Supabase Storage or similar)
        // For now, return an error indicating file processing requires storage integration
        return NextResponse.json(
          {
            error: "File processing requires storage integration",
            message: "Please upload file content directly or use URL/text sources",
          },
          { status: 501 }
        );
      }

      case "url": {
        if (!sourceConfig.url) {
          return NextResponse.json(
            { error: "URL not found in source config" },
            { status: 400 }
          );
        }

        result = await processKnowledgeUrl(sourceId, sourceConfig.url);
        break;
      }

      case "text": {
        if (!sourceConfig.content) {
          return NextResponse.json(
            { error: "Text content not found in source config" },
            { status: 400 }
          );
        }

        result = await processKnowledgeText(sourceId, sourceConfig.content);
        break;
      }

      default:
        return NextResponse.json(
          { error: "Unknown source type" },
          { status: 400 }
        );
    }

    if (result.success) {
      return NextResponse.json({
        success: true,
        chunksCreated: result.chunksCreated,
        totalTokens: result.totalTokens,
        processingTimeMs: result.processingTimeMs,
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error processing knowledge source:", error);
    return NextResponse.json(
      { error: "Failed to process knowledge source" },
      { status: 500 }
    );
  }
}
