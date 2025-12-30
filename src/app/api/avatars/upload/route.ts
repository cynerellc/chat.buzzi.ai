import { NextRequest, NextResponse } from "next/server";

import { requireCompanyAccess, getCurrentUser } from "@/lib/auth/guards";
import {
  getSupabaseClient,
  getSignedStorageUrl,
  STORAGE_BUCKET,
} from "@/lib/supabase/client";
import {
  processAvatar,
  getAvatarStoragePath,
  generateAvatarFileName,
  isValidImageType,
  MAX_AVATAR_SIZE,
  type CropData,
} from "@/lib/avatar/utils";

interface UploadResponse {
  avatarUrl: string;
  storagePath: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Get current user
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const isMasterAdmin = user.role === "chatapp.master_admin";
    let companyId: string | null = null;

    // If not master admin, must have company access
    if (!isMasterAdmin) {
      const { company } = await requireCompanyAccess();
      companyId = company.id;
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const cropDataStr = formData.get("cropData") as string | null;
    const circularCropStr = formData.get("circularCrop") as string | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_AVATAR_SIZE) {
      return NextResponse.json(
        { error: `File size exceeds maximum of ${MAX_AVATAR_SIZE / 1024 / 1024}MB` },
        { status: 400 }
      );
    }

    // Validate file type
    if (!isValidImageType(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Allowed types: JPEG, PNG, WebP, GIF" },
        { status: 400 }
      );
    }

    // Parse crop data
    let cropData: CropData;
    try {
      cropData = cropDataStr ? JSON.parse(cropDataStr) : null;
    } catch {
      return NextResponse.json(
        { error: "Invalid crop data format" },
        { status: 400 }
      );
    }

    if (!cropData || typeof cropData.x !== "number" || typeof cropData.y !== "number" ||
        typeof cropData.width !== "number" || typeof cropData.height !== "number") {
      return NextResponse.json(
        { error: "Crop data must include x, y, width, and height" },
        { status: 400 }
      );
    }

    const circularCrop = circularCropStr === "true";

    // Get file content as buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Process the avatar (crop, resize, optionally apply circle mask)
    const processedBuffer = await processAvatar(buffer, cropData, circularCrop);

    // Generate storage path based on user role
    const fileName = generateAvatarFileName("png");
    const storagePath = getAvatarStoragePath(isMasterAdmin, companyId, fileName);

    // Upload to Supabase Storage
    const supabase = getSupabaseClient();
    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, processedBuffer, {
        contentType: "image/png",
        upsert: false,
      });

    if (uploadError) {
      console.error("Supabase upload error:", uploadError);
      return NextResponse.json(
        { error: "Failed to upload avatar to storage" },
        { status: 500 }
      );
    }

    // Generate signed URL for the uploaded avatar (10-year expiry)
    const avatarUrl = await getSignedStorageUrl(storagePath);

    if (!avatarUrl) {
      console.error("Failed to generate signed URL for:", storagePath);
      return NextResponse.json(
        { error: "Failed to generate avatar URL" },
        { status: 500 }
      );
    }

    const result: UploadResponse = {
      avatarUrl,
      storagePath,
    };

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("Error uploading avatar:", error);
    return NextResponse.json(
      { error: "Failed to upload avatar" },
      { status: 500 }
    );
  }
}
