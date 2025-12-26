/**
 * Support Agent Canned Response Detail API
 *
 * GET /api/support-agent/responses/[responseId] - Get a response
 * PATCH /api/support-agent/responses/[responseId] - Update a response
 * DELETE /api/support-agent/responses/[responseId] - Delete a response
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cannedResponses } from "@/lib/db/schema/conversations";
import { requireSupportAgent } from "@/lib/auth/guards";
import { and, eq, or } from "drizzle-orm";
import { z } from "zod/v4";

const updateResponseSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  shortcut: z.string().max(50).optional().nullable(),
  content: z.string().min(1).optional(),
  category: z.string().max(100).optional().nullable(),
  tags: z.array(z.string()).optional(),
});

interface RouteParams {
  params: Promise<{ responseId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { responseId } = await params;

    const { user, company } = await requireSupportAgent();

    // Get response - user can see shared responses or their own personal ones
    const [response] = await db
      .select()
      .from(cannedResponses)
      .where(
        and(
          eq(cannedResponses.id, responseId),
          eq(cannedResponses.companyId, company.id),
          or(
            eq(cannedResponses.isShared, true),
            and(
              eq(cannedResponses.userId, user.id),
              eq(cannedResponses.isShared, false)
            )
          )
        )
      )
      .limit(1);

    if (!response) {
      return NextResponse.json({ error: "Response not found" }, { status: 404 });
    }

    return NextResponse.json({ response });
  } catch (error) {
    console.error("Support agent get response error:", error);
    return NextResponse.json(
      { error: "Failed to fetch response" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { responseId } = await params;

    const { user, company } = await requireSupportAgent();

    // Check if response exists
    const [existing] = await db
      .select()
      .from(cannedResponses)
      .where(
        and(
          eq(cannedResponses.id, responseId),
          eq(cannedResponses.companyId, company.id)
        )
      )
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Response not found" }, { status: 404 });
    }

    // Check permissions - users can only edit their own personal responses
    // Shared responses can be edited by anyone (for now - could add admin check)
    if (!existing.isShared && existing.userId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Parse and validate body
    const body = await request.json();
    const data = updateResponseSchema.parse(body);

    // Check for duplicate shortcut if updating
    if (data.shortcut) {
      const duplicate = await db
        .select({ id: cannedResponses.id })
        .from(cannedResponses)
        .where(
          and(
            eq(cannedResponses.companyId, company.id),
            eq(cannedResponses.shortcut, data.shortcut)
          )
        )
        .limit(1);

      if (duplicate.length > 0 && duplicate[0]?.id !== responseId) {
        return NextResponse.json(
          { error: "A response with this shortcut already exists" },
          { status: 400 }
        );
      }
    }

    // Update response
    const [response] = await db
      .update(cannedResponses)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(cannedResponses.id, responseId))
      .returning();

    return NextResponse.json({ response });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }

    console.error("Support agent update response error:", error);
    return NextResponse.json(
      { error: "Failed to update response" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { responseId } = await params;

    const { user, company } = await requireSupportAgent();

    // Check if response exists
    const [existing] = await db
      .select()
      .from(cannedResponses)
      .where(
        and(
          eq(cannedResponses.id, responseId),
          eq(cannedResponses.companyId, company.id)
        )
      )
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Response not found" }, { status: 404 });
    }

    // Check permissions - users can only delete their own personal responses
    if (!existing.isShared && existing.userId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Delete response
    await db
      .delete(cannedResponses)
      .where(eq(cannedResponses.id, responseId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Support agent delete response error:", error);
    return NextResponse.json(
      { error: "Failed to delete response" },
      { status: 500 }
    );
  }
}
