import { NextResponse } from "next/server";
import { and, eq, isNull, inArray } from "drizzle-orm";

import { requireCompanyAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { knowledgeSources, faqItems } from "@/lib/db/schema";
import {
  getProcessingPipeline,
  processKnowledgeUrl,
  processKnowledgeText,
} from "@/lib/knowledge/processing-pipeline";
import { getSupabaseClient, STORAGE_BUCKET } from "@/lib/supabase/client";

interface SourceConfig {
  url?: string;
  content?: string;
  storagePath?: string;
  fileName?: string;
  fileType?: string;
}

export async function POST(): Promise<NextResponse> {
  try {
    const { company } = await requireCompanyAdmin();

    // Get all indexed sources for this company
    const sources = await db
      .select()
      .from(knowledgeSources)
      .where(
        and(
          eq(knowledgeSources.companyId, company.id),
          isNull(knowledgeSources.deletedAt),
          inArray(knowledgeSources.status, ["indexed", "failed"])
        )
      );

    if (sources.length === 0) {
      return NextResponse.json({
        message: "No sources to reindex",
        results: {
          total: 0,
          success: 0,
          failed: 0,
        },
      });
    }

    const pipeline = getProcessingPipeline();
    const supabase = getSupabaseClient();
    const results = {
      total: sources.length,
      success: 0,
      failed: 0,
      errors: [] as { sourceId: string; name: string; error: string }[],
    };

    // Process each source
    for (const source of sources) {
      try {
        const config = source.sourceConfig as SourceConfig;

        if (source.type === "url" && config.url) {
          // Reprocess URL source
          const result = await processKnowledgeUrl(source.id, config.url);
          if (result.success) {
            results.success++;
          } else {
            results.failed++;
            results.errors.push({
              sourceId: source.id,
              name: source.name,
              error: result.error || "Unknown error",
            });
          }
        } else if (source.type === "text" && config.content) {
          // Reprocess text source
          const result = await processKnowledgeText(source.id, config.content);
          if (result.success) {
            results.success++;
          } else {
            results.failed++;
            results.errors.push({
              sourceId: source.id,
              name: source.name,
              error: result.error || "Unknown error",
            });
          }
        } else if (source.type === "file" && config.storagePath) {
          // Download file from Supabase and reprocess
          const { data, error } = await supabase.storage
            .from(STORAGE_BUCKET)
            .download(config.storagePath);

          if (error || !data) {
            results.failed++;
            results.errors.push({
              sourceId: source.id,
              name: source.name,
              error: `Failed to download file: ${error?.message || "Unknown error"}`,
            });
            continue;
          }

          const buffer = Buffer.from(await data.arrayBuffer());
          const result = await pipeline.processFile(
            source.id,
            buffer,
            config.fileType || "application/octet-stream",
            config.fileName || "unknown"
          );

          if (result.success) {
            results.success++;
          } else {
            results.failed++;
            results.errors.push({
              sourceId: source.id,
              name: source.name,
              error: result.error || "Unknown error",
            });
          }
        } else {
          results.failed++;
          results.errors.push({
            sourceId: source.id,
            name: source.name,
            error: "Invalid source configuration",
          });
        }
      } catch (error) {
        results.failed++;
        results.errors.push({
          sourceId: source.id,
          name: source.name,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    // Also reprocess FAQs
    const faqResult = await pipeline.reprocessFaqs(company.id);

    return NextResponse.json({
      message: "Reindex complete",
      results: {
        sources: {
          total: results.total,
          success: results.success,
          failed: results.failed,
          errors: results.errors.slice(0, 10), // Limit errors in response
        },
        faqs: {
          processed: faqResult.processed,
          failed: faqResult.failed,
        },
      },
    });
  } catch (error) {
    console.error("Error reindexing knowledge:", error);
    return NextResponse.json(
      { error: "Failed to reindex knowledge base" },
      { status: 500 }
    );
  }
}
