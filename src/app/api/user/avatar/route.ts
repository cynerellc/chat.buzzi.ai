/**
 * User Avatar Upload API
 *
 * POST /api/user/avatar - Upload and update user avatar
 *
 * The client processes images to 120x120 PNG with circular mask before uploading,
 * so this API simply stores the pre-processed image.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema/users";
import { requireAuth } from "@/lib/auth/guards";
import { getActiveCompanyId } from "@/lib/auth/tenant";
import { eq } from "drizzle-orm";
import {
  getSupabaseClient,
  getSignedStorageUrl,
  STORAGE_BUCKET,
} from "@/lib/supabase/client";
import {
  generateAvatarFileName,
  getUserAvatarStoragePath,
  MAX_AVATAR_SIZE,
} from "@/lib/avatar/utils";

interface UploadResponse {
  avatarUrl: string;
  storagePath: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const authUser = await requireAuth();
    const isMasterAdmin = authUser.role === "chatapp.master_admin";

    // Get company ID for non-master admins
    let companyId: string | null = null;
    if (!isMasterAdmin) {
      companyId = await getActiveCompanyId();
      if (!companyId) {
        return NextResponse.json(
          { error: "No active company selected. Please select a company first." },
          { status: 400 }
        );
      }
    }

    // Parse form data
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch (err) {
      console.error("Failed to parse form data:", err);
      return NextResponse.json(
        { error: "Invalid form data. Please try uploading again." },
        { status: 400 }
      );
    }

    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided. Please select an image to upload." },
        { status: 400 }
      );
    }

    // Validate file size (client should send pre-processed small image, but check anyway)
    if (file.size > MAX_AVATAR_SIZE) {
      return NextResponse.json(
        { error: `File size exceeds maximum of ${MAX_AVATAR_SIZE / 1024 / 1024}MB` },
        { status: 400 }
      );
    }

    // Get file content as buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Generate storage path
    const fileName = generateAvatarFileName("png");
    const storagePath = getUserAvatarStoragePath(authUser.id, isMasterAdmin, companyId, fileName);

    // Upload to Supabase Storage with upsert enabled
    const supabase = getSupabaseClient();
    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, buffer, {
        contentType: "image/png",
        upsert: true, // Allow overwriting existing files
      });

    if (uploadError) {
      console.error("Supabase upload error:", uploadError);

      // Provide specific error messages based on error type
      if (uploadError.message?.includes("Bucket not found")) {
        return NextResponse.json(
          { error: "Storage bucket not configured. Please contact support." },
          { status: 500 }
        );
      }
      if (uploadError.message?.includes("not authorized")) {
        return NextResponse.json(
          { error: "Not authorized to upload files. Please contact support." },
          { status: 403 }
        );
      }

      return NextResponse.json(
        { error: `Failed to upload avatar: ${uploadError.message}` },
        { status: 500 }
      );
    }

    // Generate signed URL for the uploaded avatar (10-year expiry)
    const avatarUrl = await getSignedStorageUrl(storagePath);

    if (!avatarUrl) {
      console.error("Failed to generate signed URL for:", storagePath);
      return NextResponse.json(
        { error: "Avatar uploaded but failed to generate URL. Please try again." },
        { status: 500 }
      );
    }

    // Update user's avatarUrl in database
    const [updatedUser] = await db
      .update(users)
      .set({
        avatarUrl: avatarUrl,
        updatedAt: new Date(),
      })
      .where(eq(users.id, authUser.id))
      .returning({
        id: users.id,
        avatarUrl: users.avatarUrl,
      });

    if (!updatedUser) {
      console.error("Failed to update user avatarUrl in database for user:", authUser.id);
      return NextResponse.json(
        { error: "Avatar uploaded but failed to save to profile. Please try again." },
        { status: 500 }
      );
    }

    const result: UploadResponse = {
      avatarUrl,
      storagePath,
    };

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("Error uploading user avatar:", error);

    // Provide more specific error message if possible
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to upload avatar: ${message}` },
      { status: 500 }
    );
  }
}
