import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { promises as fs } from "fs";
import path from "path";
import archiver from "archiver";

import { requireMasterAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { agentPackages } from "@/lib/db/schema";
import { getSupabaseClient, getSignedStorageUrl, STORAGE_BUCKET } from "@/lib/supabase/client";

interface RouteContext {
  params: Promise<{ packageId: string }>;
}

const CHATBOT_PACKAGES_DIR = path.join(process.cwd(), "src/chatbot-packages");

// Allowed file extensions for packaging
const ALLOWED_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".json", ".md", ".txt"];

/**
 * Recursively get all files in a directory
 */
async function getAllFiles(
  dirPath: string,
  basePath: string,
  files: { relativePath: string; fullPath: string }[] = []
): Promise<{ relativePath: string; fullPath: string }[]> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    // Skip hidden files and node_modules
    if (entry.name.startsWith(".") || entry.name === "node_modules") {
      continue;
    }

    const fullPath = path.join(dirPath, entry.name);
    const relativePath = path.relative(basePath, fullPath);

    if (entry.isDirectory()) {
      await getAllFiles(fullPath, basePath, files);
    } else {
      const ext = path.extname(entry.name).toLowerCase();
      if (ALLOWED_EXTENSIONS.includes(ext)) {
        files.push({ relativePath, fullPath });
      }
    }
  }

  return files;
}

/**
 * Create a zip buffer from directory contents
 */
async function createZipBuffer(dirPath: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const archive = archiver("zip", { zlib: { level: 9 } });

    archive.on("data", (chunk: Buffer) => chunks.push(chunk));
    archive.on("end", () => resolve(Buffer.concat(chunks)));
    archive.on("error", reject);

    // Add all files from directory
    archive.directory(dirPath, false);
    archive.finalize();
  });
}

/**
 * POST /api/master-admin/packages/[packageId]/pack
 * Pack the package code into a zip, upload to storage, and generate signed URL
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    await requireMasterAdmin();
    const { packageId } = await context.params;

    // Get the package to get its slug
    const [pkg] = await db
      .select({
        id: agentPackages.id,
        slug: agentPackages.slug,
        name: agentPackages.name,
      })
      .from(agentPackages)
      .where(eq(agentPackages.id, packageId))
      .limit(1);

    if (!pkg) {
      return NextResponse.json(
        { error: "Package not found" },
        { status: 404 }
      );
    }

    // Validate package directory exists
    const packageDir = path.join(CHATBOT_PACKAGES_DIR, packageId);

    try {
      await fs.access(packageDir);
    } catch {
      return NextResponse.json(
        { error: `Package directory not found: src/chatbot-packages/${packageId}` },
        { status: 404 }
      );
    }

    const supabase = getSupabaseClient();
    const storagePath = `agent-packages/${pkg.slug}`;

    // Step 1: Upload source files to storage
    const files = await getAllFiles(packageDir, packageDir);
    const uploadedSourceFiles: string[] = [];

    for (const file of files) {
      const content = await fs.readFile(file.fullPath);
      const sourcePath = `${storagePath}/source/${file.relativePath}`;

      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(sourcePath, content, {
          contentType: getContentType(file.relativePath),
          upsert: true,
        });

      if (uploadError) {
        console.error(`Failed to upload ${file.relativePath}:`, uploadError);
      } else {
        uploadedSourceFiles.push(sourcePath);
      }
    }

    // Step 2: Create zip file
    const zipBuffer = await createZipBuffer(packageDir);
    const zipPath = `${storagePath}/bin/package.zip`;

    // Step 3: Upload zip to storage
    const { error: zipUploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(zipPath, zipBuffer, {
        contentType: "application/zip",
        upsert: true,
      });

    if (zipUploadError) {
      console.error("Failed to upload zip:", zipUploadError);
      return NextResponse.json(
        { error: "Failed to upload package zip" },
        { status: 500 }
      );
    }

    // Step 4: Generate signed URL (10 years expiry)
    const signedUrl = await getSignedStorageUrl(zipPath);

    if (!signedUrl) {
      return NextResponse.json(
        { error: "Failed to generate signed URL" },
        { status: 500 }
      );
    }

    // Step 5: Update bundle_path in database
    await db
      .update(agentPackages)
      .set({
        bundlePath: signedUrl,
        updatedAt: new Date(),
      })
      .where(eq(agentPackages.id, packageId));

    return NextResponse.json({
      success: true,
      packageId,
      slug: pkg.slug,
      bundlePath: signedUrl,
      sourceFilesCount: uploadedSourceFiles.length,
      storagePaths: {
        source: `${storagePath}/source/`,
        zip: zipPath,
      },
    });
  } catch (error) {
    console.error("Error packing package:", error);

    if (error instanceof Error && error.message.includes("Unauthorized")) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to pack package" },
      { status: 500 }
    );
  }
}

/**
 * Get content type for file upload
 */
function getContentType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const contentTypes: Record<string, string> = {
    ".ts": "text/typescript",
    ".tsx": "text/typescript",
    ".js": "text/javascript",
    ".jsx": "text/javascript",
    ".json": "application/json",
    ".md": "text/markdown",
    ".txt": "text/plain",
  };
  return contentTypes[ext] ?? "application/octet-stream";
}
