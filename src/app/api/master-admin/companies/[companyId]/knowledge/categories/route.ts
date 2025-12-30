import { NextRequest, NextResponse } from "next/server";
import { and, count, eq, isNull } from "drizzle-orm";

import { requireMasterAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { companies } from "@/lib/db/schema/companies";
import { knowledgeSources, faqItems } from "@/lib/db/schema/knowledge";
import { deleteChunksBySource, deleteFaq, getQdrantService, COLLECTIONS } from "@/lib/knowledge/qdrant-client";

export interface CategoryWithCounts {
  name: string;
  sourceCount: number;
  faqCount: number;
}

interface CompanySettings {
  knowledgeCategories?: string[];
  [key: string]: unknown;
}

interface RouteContext {
  params: Promise<{ companyId: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    await requireMasterAdmin();
    const { companyId } = await context.params;

    // Get company
    const [company] = await db
      .select()
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1);

    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    // Get categories from company settings
    const settings = (company.settings as CompanySettings) || {};
    const categoryNames = settings.knowledgeCategories || [];

    // Get source counts per category
    const sourceCounts = await db
      .select({
        category: knowledgeSources.category,
        count: count(),
      })
      .from(knowledgeSources)
      .where(eq(knowledgeSources.companyId, companyId))
      .groupBy(knowledgeSources.category);

    const sourceCountMap: Record<string, number> = {};
    sourceCounts.forEach((sc) => {
      if (sc.category) {
        sourceCountMap[sc.category] = sc.count;
      }
    });

    // Get FAQ counts per category
    const faqCategoryCounts = await db
      .select({
        category: faqItems.category,
        count: count(),
      })
      .from(faqItems)
      .where(eq(faqItems.companyId, companyId))
      .groupBy(faqItems.category);

    const faqCountMap: Record<string, number> = {};
    faqCategoryCounts.forEach((fc) => {
      if (fc.category) {
        faqCountMap[fc.category] = fc.count;
      }
    });

    const categories: CategoryWithCounts[] = categoryNames.map((name) => ({
      name,
      sourceCount: sourceCountMap[name] ?? 0,
      faqCount: faqCountMap[name] ?? 0,
    }));

    return NextResponse.json({ categories });
  } catch (error) {
    console.error("Error fetching knowledge categories:", error);
    return NextResponse.json(
      { error: "Failed to fetch knowledge categories" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    await requireMasterAdmin();
    const { companyId } = await context.params;

    // Get company
    const [company] = await db
      .select()
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1);

    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const body = await request.json();
    const { name } = body;

    if (!name || typeof name !== "string") {
      return NextResponse.json(
        { error: "Category name is required" },
        { status: 400 }
      );
    }

    const trimmedName = name.trim();
    if (trimmedName.length === 0) {
      return NextResponse.json(
        { error: "Category name cannot be empty" },
        { status: 400 }
      );
    }

    // Get current settings
    const settings = (company.settings as CompanySettings) || {};
    const currentCategories = settings.knowledgeCategories || [];

    // Check if category already exists
    if (currentCategories.includes(trimmedName)) {
      return NextResponse.json(
        { error: "Category already exists" },
        { status: 409 }
      );
    }

    // Add new category
    const updatedCategories = [...currentCategories, trimmedName];
    const updatedSettings: CompanySettings = {
      ...settings,
      knowledgeCategories: updatedCategories,
    };

    // Update company settings
    await db
      .update(companies)
      .set({
        settings: updatedSettings,
        updatedAt: new Date(),
      })
      .where(eq(companies.id, companyId));

    return NextResponse.json(
      {
        category: {
          name: trimmedName,
          sourceCount: 0,
          faqCount: 0,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating knowledge category:", error);
    return NextResponse.json(
      { error: "Failed to create knowledge category" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    await requireMasterAdmin();
    const { companyId } = await context.params;

    // Get company
    const [company] = await db
      .select()
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1);

    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const name = searchParams.get("name");

    if (!name) {
      return NextResponse.json(
        { error: "Category name is required" },
        { status: 400 }
      );
    }

    // Get current settings
    const settings = (company.settings as CompanySettings) || {};
    const currentCategories = settings.knowledgeCategories || [];

    // Check if category exists
    if (!currentCategories.includes(name)) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 }
      );
    }

    // Get all sources in this category (for Qdrant cleanup)
    const sourcesInCategory = await db
      .select({ id: knowledgeSources.id })
      .from(knowledgeSources)
      .where(
        and(
          eq(knowledgeSources.companyId, companyId),
          eq(knowledgeSources.category, name),
          isNull(knowledgeSources.deletedAt)
        )
      );

    // Get all FAQs in this category (for Qdrant cleanup)
    const faqsInCategory = await db
      .select({ id: faqItems.id })
      .from(faqItems)
      .where(
        and(
          eq(faqItems.companyId, companyId),
          eq(faqItems.category, name),
          isNull(faqItems.deletedAt)
        )
      );

    // Remove category from settings
    const updatedCategories = currentCategories.filter((c) => c !== name);
    const updatedSettings: CompanySettings = {
      ...settings,
      knowledgeCategories: updatedCategories,
    };

    // Update company settings
    await db
      .update(companies)
      .set({
        settings: updatedSettings,
        updatedAt: new Date(),
      })
      .where(eq(companies.id, companyId));

    // Soft delete all knowledge sources in this category
    if (sourcesInCategory.length > 0) {
      await db
        .update(knowledgeSources)
        .set({
          deletedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(knowledgeSources.companyId, companyId),
            eq(knowledgeSources.category, name)
          )
        );
    }

    // Soft delete all FAQs in this category
    if (faqsInCategory.length > 0) {
      await db
        .update(faqItems)
        .set({
          deletedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(faqItems.companyId, companyId),
            eq(faqItems.category, name)
          )
        );
    }

    // Delete from Qdrant in background
    setImmediate(async () => {
      try {
        console.log(`[Category Delete] Removing vectors for category "${name}"...`);

        // Delete all chunks for sources in this category
        for (const source of sourcesInCategory) {
          try {
            await deleteChunksBySource(source.id);
            console.log(`[Category Delete] Removed chunks for source ${source.id}`);
          } catch (error) {
            console.error(`[Category Delete] Failed to remove chunks for source ${source.id}:`, error);
          }
        }

        // Delete all FAQs from Qdrant
        for (const faq of faqsInCategory) {
          try {
            await deleteFaq(faq.id);
            console.log(`[Category Delete] Removed FAQ ${faq.id} from Qdrant`);
          } catch (error) {
            console.error(`[Category Delete] Failed to remove FAQ ${faq.id}:`, error);
          }
        }

        // Also delete any chunks that have this category directly
        try {
          const qdrant = getQdrantService();
          await qdrant.deleteByFilter(COLLECTIONS.KNOWLEDGE_CHUNKS, {
            must: [
              { key: "companyId", match: { value: companyId } },
              { key: "category", match: { value: name } },
            ],
          });
          console.log(`[Category Delete] Removed all chunks with category "${name}"`);
        } catch (error) {
          console.error(`[Category Delete] Failed to remove chunks by category filter:`, error);
        }

        console.log(`[Category Delete] Completed cleanup for category "${name}"`);
      } catch (error) {
        console.error(`[Category Delete] Error during Qdrant cleanup:`, error);
      }
    });

    return NextResponse.json({
      success: true,
      deleted: {
        sources: sourcesInCategory.length,
        faqs: faqsInCategory.length,
      }
    });
  } catch (error) {
    console.error("Error deleting knowledge category:", error);
    return NextResponse.json(
      { error: "Failed to delete knowledge category" },
      { status: 500 }
    );
  }
}
