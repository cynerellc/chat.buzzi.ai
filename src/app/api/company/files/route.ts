import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, ilike, inArray, sql } from "drizzle-orm";

import { requireCompanyAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { companyFiles, users } from "@/lib/db/schema";

export interface CompanyFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  url: string;
  category: string;
  uploadedBy: {
    id: string;
    name: string | null;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
}

export async function GET(request: NextRequest) {
  try {
    const { company } = await requireCompanyAdmin();

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const type = searchParams.get("type");
    const category = searchParams.get("category");
    const search = searchParams.get("search");

    const offset = (page - 1) * limit;

    // Build where conditions
    const conditions = [eq(companyFiles.companyId, company.id)];

    if (type && type !== "all") {
      // Map type to mime type patterns
      const mimePatterns: Record<string, string> = {
        document: "%document%",
        image: "image/%",
        video: "video/%",
        audio: "audio/%",
      };
      if (mimePatterns[type]) {
        conditions.push(ilike(companyFiles.mimeType, mimePatterns[type]));
      }
    }

    if (category && category !== "all") {
      conditions.push(eq(companyFiles.category, category));
    }

    if (search) {
      conditions.push(ilike(companyFiles.name, `%${search}%`));
    }

    // Get files with pagination
    const files = await db
      .select({
        id: companyFiles.id,
        name: companyFiles.name,
        mimeType: companyFiles.mimeType,
        size: companyFiles.size,
        url: companyFiles.url,
        category: companyFiles.category,
        createdAt: companyFiles.createdAt,
        updatedAt: companyFiles.updatedAt,
        uploadedById: companyFiles.uploadedById,
      })
      .from(companyFiles)
      .where(and(...conditions))
      .orderBy(desc(companyFiles.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(companyFiles)
      .where(and(...conditions));
    const total = countResult[0]?.count ?? 0;

    // Get uploader info
    const uploaderIds = [...new Set(files.map((f) => f.uploadedById))];
    const uploaders = uploaderIds.length > 0
      ? await db
          .select({
            id: users.id,
            name: users.name,
            email: users.email,
          })
          .from(users)
          .where(inArray(users.id, uploaderIds))
      : [];

    const uploaderMap = new Map(uploaders.map((u) => [u.id, u]));

    const response: CompanyFile[] = files.map((file) => {
      const uploader = uploaderMap.get(file.uploadedById) || {
        id: file.uploadedById,
        name: null,
        email: "Unknown",
      };

      return {
        id: file.id,
        name: file.name,
        mimeType: file.mimeType,
        size: file.size,
        url: file.url,
        category: file.category,
        uploadedBy: {
          id: uploader.id,
          name: uploader.name,
          email: uploader.email,
        },
        createdAt: file.createdAt.toISOString(),
        updatedAt: file.updatedAt.toISOString(),
      };
    });

    return NextResponse.json({
      files: response,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching files:", error);
    return NextResponse.json(
      { error: "Failed to fetch files" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, company } = await requireCompanyAdmin();

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const category = (formData.get("category") as string) || "general";
    const name = (formData.get("name") as string) || file?.name || "Untitled";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File size exceeds 10MB limit" },
        { status: 400 }
      );
    }

    // TODO: Upload file to storage (S3, GCS, etc.)
    // For now, we'll create a placeholder URL
    const url = `/uploads/${company.id}/${Date.now()}-${file.name}`;

    // Create file record
    const [newFile] = await db
      .insert(companyFiles)
      .values({
        companyId: company.id,
        name,
        mimeType: file.type,
        size: file.size,
        url,
        category,
        uploadedById: user.id,
      })
      .returning();

    if (!newFile) {
      return NextResponse.json(
        { error: "Failed to create file record" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        file: {
          id: newFile.id,
          name: newFile.name,
          mimeType: newFile.mimeType,
          size: newFile.size,
          url: newFile.url,
          category: newFile.category,
          createdAt: newFile.createdAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error uploading file:", error);
    return NextResponse.json(
      { error: "Failed to upload file" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { company } = await requireCompanyAdmin();

    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get("id");

    if (!fileId) {
      return NextResponse.json({ error: "File ID is required" }, { status: 400 });
    }

    // Verify file belongs to company
    const [existingFile] = await db
      .select({ id: companyFiles.id })
      .from(companyFiles)
      .where(
        and(eq(companyFiles.id, fileId), eq(companyFiles.companyId, company.id))
      )
      .limit(1);

    if (!existingFile) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // TODO: Delete file from storage

    // Delete file record
    await db.delete(companyFiles).where(eq(companyFiles.id, fileId));

    return NextResponse.json({ message: "File deleted successfully" });
  } catch (error) {
    console.error("Error deleting file:", error);
    return NextResponse.json(
      { error: "Failed to delete file" },
      { status: 500 }
    );
  }
}
