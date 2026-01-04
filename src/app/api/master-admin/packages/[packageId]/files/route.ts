import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

import { requireMasterAdmin } from "@/lib/auth/guards";

interface RouteContext {
  params: Promise<{ packageId: string }>;
}

// File tree node for directory structure
export interface FileTreeNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileTreeNode[];
}

// Response for file content
export interface FileContentResponse {
  content: string;
  language: string;
}

const CHATBOT_PACKAGES_DIR = path.join(process.cwd(), "src/chatbot-packages");

// Allowed file extensions for viewing and editing
const ALLOWED_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".json", ".md", ".txt", ".css", ".scss"];

// Get language mode for Monaco editor
function getLanguageFromExtension(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const languageMap: Record<string, string> = {
    ".ts": "typescript",
    ".tsx": "typescriptreact",
    ".js": "javascript",
    ".jsx": "javascriptreact",
    ".json": "json",
    ".css": "css",
    ".scss": "scss",
    ".md": "markdown",
    ".txt": "plaintext",
  };
  return languageMap[ext] ?? "plaintext";
}

// Validate file path to prevent directory traversal
function isValidFilePath(filePath: string): boolean {
  if (!filePath || filePath.includes("..")) {
    return false;
  }
  const ext = path.extname(filePath).toLowerCase();
  return ALLOWED_EXTENSIONS.includes(ext);
}

// Ensure parent directory exists
async function ensureDirectoryExists(dirPath: string): Promise<void> {
  try {
    await fs.access(dirPath);
  } catch {
    await fs.mkdir(dirPath, { recursive: true });
  }
}

// Recursively build file tree
async function buildFileTree(
  dirPath: string,
  basePath: string
): Promise<FileTreeNode[]> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const nodes: FileTreeNode[] = [];

  for (const entry of entries) {
    // Skip hidden files and node_modules
    if (entry.name.startsWith(".") || entry.name === "node_modules") {
      continue;
    }

    const fullPath = path.join(dirPath, entry.name);
    const relativePath = path.relative(basePath, fullPath);

    if (entry.isDirectory()) {
      const children = await buildFileTree(fullPath, basePath);
      nodes.push({
        name: entry.name,
        path: relativePath,
        type: "directory",
        children,
      });
    } else {
      const ext = path.extname(entry.name).toLowerCase();
      if (ALLOWED_EXTENSIONS.includes(ext)) {
        nodes.push({
          name: entry.name,
          path: relativePath,
          type: "file",
        });
      }
    }
  }

  // Sort: directories first, then files, alphabetically
  nodes.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === "directory" ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });

  return nodes;
}

/**
 * GET /api/master-admin/packages/[packageId]/files
 * List all files in an agent package or get specific file content
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    await requireMasterAdmin();
    const { packageId } = await context.params;
    const { searchParams } = new URL(request.url);
    const filePath = searchParams.get("path");

    // Validate packageId to prevent directory traversal
    if (!packageId || packageId.includes("..") || packageId.includes("/")) {
      return NextResponse.json({ error: "Invalid package ID" }, { status: 400 });
    }

    const packageDir = path.join(CHATBOT_PACKAGES_DIR, packageId);

    // Check if package directory exists
    try {
      await fs.access(packageDir);
    } catch {
      return NextResponse.json(
        { error: "Package directory not found" },
        { status: 404 }
      );
    }

    // If filePath is provided, return file content
    if (filePath) {
      // Validate file path to prevent directory traversal
      if (filePath.includes("..")) {
        return NextResponse.json(
          { error: "Invalid file path" },
          { status: 400 }
        );
      }

      const fullFilePath = path.join(packageDir, filePath);

      // Ensure the file is within the package directory
      if (!fullFilePath.startsWith(packageDir)) {
        return NextResponse.json(
          { error: "Access denied" },
          { status: 403 }
        );
      }

      try {
        const content = await fs.readFile(fullFilePath, "utf-8");
        const language = getLanguageFromExtension(filePath);

        return NextResponse.json({
          content,
          language,
        } as FileContentResponse);
      } catch {
        return NextResponse.json(
          { error: "File not found" },
          { status: 404 }
        );
      }
    }

    // Return file tree
    const fileTree = await buildFileTree(packageDir, packageDir);

    return NextResponse.json({
      packageId,
      files: fileTree,
    });
  } catch (error) {
    console.error("Error reading package files:", error);

    // Check if it's an auth error
    if (error instanceof Error && error.message.includes("Unauthorized")) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to read package files" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/master-admin/packages/[packageId]/files
 * Save file content
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    await requireMasterAdmin();
    const { packageId } = await context.params;

    // Validate packageId
    if (!packageId || packageId.includes("..") || packageId.includes("/")) {
      return NextResponse.json({ error: "Invalid package ID" }, { status: 400 });
    }

    const body = await request.json();
    const { path: filePath, content } = body;

    if (!filePath || typeof content !== "string") {
      return NextResponse.json(
        { error: "File path and content are required" },
        { status: 400 }
      );
    }

    if (!isValidFilePath(filePath)) {
      return NextResponse.json(
        { error: "Invalid file path or unsupported file type" },
        { status: 400 }
      );
    }

    const packageDir = path.join(CHATBOT_PACKAGES_DIR, packageId);
    const fullFilePath = path.join(packageDir, filePath);

    // Ensure the file is within the package directory
    if (!fullFilePath.startsWith(packageDir)) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

    // Ensure parent directory exists
    const parentDir = path.dirname(fullFilePath);
    await ensureDirectoryExists(parentDir);

    // Write file
    await fs.writeFile(fullFilePath, content, "utf-8");

    return NextResponse.json({
      success: true,
      path: filePath,
    });
  } catch (error) {
    console.error("Error saving file:", error);

    if (error instanceof Error && error.message.includes("Unauthorized")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save file" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/master-admin/packages/[packageId]/files
 * Create a new file
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    await requireMasterAdmin();
    const { packageId } = await context.params;

    // Validate packageId
    if (!packageId || packageId.includes("..") || packageId.includes("/")) {
      return NextResponse.json({ error: "Invalid package ID" }, { status: 400 });
    }

    const body = await request.json();
    const { path: filePath, content = "" } = body;

    if (!filePath) {
      return NextResponse.json(
        { error: "File path is required" },
        { status: 400 }
      );
    }

    if (!isValidFilePath(filePath)) {
      return NextResponse.json(
        { error: "Invalid file path or unsupported file type" },
        { status: 400 }
      );
    }

    const packageDir = path.join(CHATBOT_PACKAGES_DIR, packageId);
    const fullFilePath = path.join(packageDir, filePath);

    // Ensure the file is within the package directory
    if (!fullFilePath.startsWith(packageDir)) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

    // Ensure package directory exists
    await ensureDirectoryExists(packageDir);

    // Check if file already exists
    try {
      await fs.access(fullFilePath);
      return NextResponse.json(
        { error: "File already exists" },
        { status: 409 }
      );
    } catch {
      // File doesn't exist, which is what we want
    }

    // Ensure parent directory exists
    const parentDir = path.dirname(fullFilePath);
    await ensureDirectoryExists(parentDir);

    // Create file
    await fs.writeFile(fullFilePath, content, "utf-8");

    return NextResponse.json({
      success: true,
      path: filePath,
    }, { status: 201 });
  } catch (error) {
    console.error("Error creating file:", error);

    if (error instanceof Error && error.message.includes("Unauthorized")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create file" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/master-admin/packages/[packageId]/files
 * Delete a file or directory
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    await requireMasterAdmin();
    const { packageId } = await context.params;
    const { searchParams } = new URL(request.url);
    const filePath = searchParams.get("path");

    // Validate packageId
    if (!packageId || packageId.includes("..") || packageId.includes("/")) {
      return NextResponse.json({ error: "Invalid package ID" }, { status: 400 });
    }

    if (!filePath) {
      return NextResponse.json(
        { error: "File path is required" },
        { status: 400 }
      );
    }

    // Validate file path
    if (filePath.includes("..")) {
      return NextResponse.json(
        { error: "Invalid file path" },
        { status: 400 }
      );
    }

    const packageDir = path.join(CHATBOT_PACKAGES_DIR, packageId);
    const fullFilePath = path.join(packageDir, filePath);

    // Ensure the file is within the package directory
    if (!fullFilePath.startsWith(packageDir)) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

    // Prevent deleting the entire package directory
    if (fullFilePath === packageDir) {
      return NextResponse.json(
        { error: "Cannot delete the package root directory" },
        { status: 400 }
      );
    }

    // Check if path exists
    try {
      const stats = await fs.stat(fullFilePath);

      if (stats.isDirectory()) {
        // Remove directory recursively
        await fs.rm(fullFilePath, { recursive: true });
      } else {
        // Remove file
        await fs.unlink(fullFilePath);
      }

      return NextResponse.json({
        success: true,
        path: filePath,
      });
    } catch {
      return NextResponse.json(
        { error: "File or directory not found" },
        { status: 404 }
      );
    }
  } catch (error) {
    console.error("Error deleting file:", error);

    if (error instanceof Error && error.message.includes("Unauthorized")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete file" },
      { status: 500 }
    );
  }
}
