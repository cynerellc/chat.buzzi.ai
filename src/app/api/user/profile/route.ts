/**
 * User Profile API
 *
 * GET /api/user/profile - Get current user profile
 * PATCH /api/user/profile - Update current user profile
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema/users";
import { requireAuth } from "@/lib/auth/guards";
import { eq } from "drizzle-orm";
import { z } from "zod/v4";

const updateProfileSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  phone: z.string().max(20).optional().nullable(),
  avatarUrl: z.string().url().max(500).optional().nullable(),
});

export async function GET() {
  try {
    const authUser = await requireAuth();

    const [userData] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        phone: users.phone,
        avatarUrl: users.avatarUrl,
        image: users.image,
        role: users.role,
        activeCompanyId: users.activeCompanyId,
      })
      .from(users)
      .where(eq(users.id, authUser.id))
      .limit(1);

    if (!userData) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      profile: {
        id: userData.id,
        name: userData.name,
        email: userData.email,
        phone: userData.phone,
        avatarUrl: userData.avatarUrl,
        image: userData.image,
        role: userData.role,
        activeCompanyId: userData.activeCompanyId,
      },
    });
  } catch (error) {
    console.error("Get user profile error:", error);
    return NextResponse.json(
      { error: "Failed to fetch profile" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const authUser = await requireAuth();

    const body = await request.json();
    const data = updateProfileSchema.parse(body);

    // Build update object
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (data.name !== undefined) {
      updateData.name = data.name;
    }
    if (data.phone !== undefined) {
      updateData.phone = data.phone;
    }
    if (data.avatarUrl !== undefined) {
      updateData.avatarUrl = data.avatarUrl;
    }

    const [updatedUser] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, authUser.id))
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        phone: users.phone,
        avatarUrl: users.avatarUrl,
        image: users.image,
        role: users.role,
        activeCompanyId: users.activeCompanyId,
      });

    if (!updatedUser) {
      return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
    }

    return NextResponse.json({
      profile: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        phone: updatedUser.phone,
        avatarUrl: updatedUser.avatarUrl,
        image: updatedUser.image,
        role: updatedUser.role,
        activeCompanyId: updatedUser.activeCompanyId,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }

    console.error("Update user profile error:", error);
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 }
    );
  }
}
