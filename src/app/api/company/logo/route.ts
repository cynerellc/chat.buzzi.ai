/**
 * Company Logo Upload API
 *
 * POST /api/company/logo
 * Uploads a company logo to Supabase storage
 * Path: public/companies/[company-id]/settings/logo.[extension]
 */

import { NextRequest, NextResponse } from "next/server";

import { requireCompanyAdmin } from "@/lib/auth/guards";
import { getSupabaseClient, getSignedStorageUrl, STORAGE_BUCKET } from "@/lib/supabase/client";

/**
 * Get the storage path for company logo
 */
function getLogoStoragePath(companyId: string, extension: string): string {
  return `public/companies/${companyId}/settings/logo.${extension}`;
}

export async function POST(request: NextRequest) {
  try {
    // Verify authentication and get company context
    const { company } = await requireCompanyAdmin();
    const companyId = company.id;

    // Parse the multipart form data
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Allowed types: JPEG, PNG, GIF, WebP" },
        { status: 400 }
      );
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 5MB" },
        { status: 400 }
      );
    }

    // Determine file extension from MIME type
    const extensionMap: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/gif": "gif",
      "image/webp": "webp",
    };
    const extension = extensionMap[file.type] || "png";

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Supabase storage
    const supabase = getSupabaseClient();
    const storagePath = getLogoStoragePath(companyId, extension);

    // Delete old logo files first (different extensions might exist)
    // M4: Parallelize deletion instead of sequential loop
    const oldExtensions = ["jpg", "png", "gif", "webp"];
    await Promise.all(
      oldExtensions.map((ext) => {
        const oldPath = getLogoStoragePath(companyId, ext);
        return supabase.storage.from(STORAGE_BUCKET).remove([oldPath]);
      })
    );

    // Upload new logo
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (error) {
      console.error("Logo upload error:", error);
      return NextResponse.json(
        { error: "Failed to upload logo: " + error.message },
        { status: 500 }
      );
    }

    // Get signed URL (for private bucket)
    const signedUrl = await getSignedStorageUrl(storagePath);
    if (!signedUrl) {
      return NextResponse.json(
        { error: "Failed to generate signed URL for logo" },
        { status: 500 }
      );
    }

    // L2: Only return logoUrl, remove redundant path field
    return NextResponse.json({
      success: true,
      logoUrl: signedUrl,
    });
  } catch (error) {
    console.error("Logo upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload logo" },
      { status: 500 }
    );
  }
}
