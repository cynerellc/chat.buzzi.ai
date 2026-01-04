/**
 * Company Logo Upload API
 *
 * POST /api/company/logo?chatbotId=xxx
 * Uploads a company logo to R2 storage with WebP conversion
 * Path: chatapp/companies/{companyId}/settings/logo-{chatbotId}.webp
 */

import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";

import { requireCompanyAdmin } from "@/lib/auth/guards";
import { uploadWidgetLogo, getWidgetLogoUrl, deleteWidgetLogo } from "@/lib/r2";

export async function POST(request: NextRequest) {
  try {
    // Verify authentication and get company context
    const { company } = await requireCompanyAdmin();
    const companyId = company.id;

    // Get chatbotId from query params
    const { searchParams } = new URL(request.url);
    const chatbotId = searchParams.get("chatbotId");

    if (!chatbotId) {
      return NextResponse.json(
        { error: "chatbotId query parameter is required" },
        { status: 400 }
      );
    }

    // Parse the multipart form data
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Allowed types: JPEG, PNG, GIF, WebP, SVG" },
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

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const inputBuffer = Buffer.from(arrayBuffer);

    // Convert to WebP using sharp
    // SVG files are converted to PNG first, then to WebP
    let webpBuffer: Buffer;
    try {
      webpBuffer = await sharp(inputBuffer)
        .resize(512, 512, {
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({
          quality: 85,
          effort: 4,
        })
        .toBuffer();
    } catch (err) {
      console.error("Image conversion error:", err);
      return NextResponse.json(
        { error: "Failed to process image. Please try a different file." },
        { status: 400 }
      );
    }

    // Upload to R2
    const logoUrl = await uploadWidgetLogo(companyId, chatbotId, webpBuffer);

    return NextResponse.json({
      success: true,
      logoUrl,
    });
  } catch (error) {
    console.error("Logo upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload logo" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/company/logo?chatbotId=xxx
 * Deletes a company logo from R2 storage
 */
export async function DELETE(request: NextRequest) {
  try {
    const { company } = await requireCompanyAdmin();
    const companyId = company.id;

    const { searchParams } = new URL(request.url);
    const chatbotId = searchParams.get("chatbotId");

    if (!chatbotId) {
      return NextResponse.json(
        { error: "chatbotId query parameter is required" },
        { status: 400 }
      );
    }

    await deleteWidgetLogo(companyId, chatbotId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Logo delete error:", error);
    return NextResponse.json(
      { error: "Failed to delete logo" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/company/logo?chatbotId=xxx
 * Returns the public URL for a company logo
 */
export async function GET(request: NextRequest) {
  try {
    const { company } = await requireCompanyAdmin();
    const companyId = company.id;

    const { searchParams } = new URL(request.url);
    const chatbotId = searchParams.get("chatbotId");

    if (!chatbotId) {
      return NextResponse.json(
        { error: "chatbotId query parameter is required" },
        { status: 400 }
      );
    }

    const logoUrl = getWidgetLogoUrl(companyId, chatbotId);

    return NextResponse.json({ logoUrl });
  } catch (error) {
    console.error("Logo fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch logo URL" },
      { status: 500 }
    );
  }
}
