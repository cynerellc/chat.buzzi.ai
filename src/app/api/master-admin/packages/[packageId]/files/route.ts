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

// Allowed file extensions for viewing
const ALLOWED_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".json", ".md", ".txt"];

// Get language mode for Monaco editor
function getLanguageFromExtension(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const languageMap: Record<string, string> = {
    ".ts": "typescript",
    ".tsx": "typescript",
    ".js": "javascript",
    ".jsx": "javascript",
    ".json": "json",
    ".md": "markdown",
    ".txt": "plaintext",
  };
  return languageMap[ext] ?? "plaintext";
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
