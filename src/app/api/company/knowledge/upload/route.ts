import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";

import { requireCompanyAdmin } from "@/lib/auth/guards";
import {
  getSupabaseClient,
  getSupabaseStorageUrl,
  STORAGE_BUCKET,
  getKnowledgeStoragePath,
} from "@/lib/supabase/client";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const ALLOWED_MIME_TYPES: Record<string, string[]> = {
  "application/pdf": [".pdf"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  "application/msword": [".doc"],
  "text/plain": [".txt"],
  "text/markdown": [".md"],
  "text/csv": [".csv"],
  "text/html": [".html", ".htm"],
};

interface UploadResult {
  storagePath: string;
  publicUrl: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { company } = await requireCompanyAdmin();

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File size exceeds maximum of ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 400 }
      );
    }

    // Validate file type
    const mimeType = file.type;
    if (!ALLOWED_MIME_TYPES[mimeType]) {
      return NextResponse.json(
        {
          error: "Invalid file type. Allowed types: PDF, DOCX, DOC, TXT, MD, CSV, HTML",
        },
        { status: 400 }
      );
    }

    // Generate unique filename
    const fileExtension = file.name.split(".").pop() || "bin";
    const uniqueFileName = `${uuidv4()}-${Date.now()}.${fileExtension}`;
    const storagePath = getKnowledgeStoragePath(company.id, uniqueFileName);

    // Get file content as buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Supabase Storage
    const supabase = getSupabaseClient();
    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, buffer, {
        contentType: mimeType,
        upsert: false,
      });

    if (uploadError) {
      console.error("Supabase upload error:", uploadError);
      return NextResponse.json(
        { error: "Failed to upload file to storage" },
        { status: 500 }
      );
    }

    const publicUrl = getSupabaseStorageUrl(STORAGE_BUCKET, storagePath);

    const result: UploadResult = {
      storagePath,
      publicUrl,
      fileName: file.name,
      fileSize: file.size,
      mimeType,
    };

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("Error uploading file:", error);
    return NextResponse.json(
      { error: "Failed to upload file" },
      { status: 500 }
    );
  }
}
