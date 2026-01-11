import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { promises as fs } from "fs";
import path from "path";

import { requireCompanyAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { agents, agentPackages } from "@/lib/db/schema";

interface RouteParams {
  params: Promise<{ chatbotId: string }>;
}

// File tree node for directory structure
interface FileTreeNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileTreeNode[];
}

const CHATBOT_PACKAGES_DIR = path.join(process.cwd(), "src/chatbot-packages");

// Allowed file extensions for viewing
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
 * GET /api/company/chatbots/[chatbotId]/code
 * Get package code for a chatbot (read-only, only for custom packages)
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { company } = await requireCompanyAdmin();
    const { chatbotId } = await params;
    const { searchParams } = new URL(request.url);
    const filePath = searchParams.get("path");

    // Get the chatbot and verify it belongs to the company and is a custom package
    const [chatbot] = await db
      .select({
        id: agents.id,
        packageId: agents.packageId,
        isCustomPackage: agents.isCustomPackage,
        packageSlug: agentPackages.slug,
        packageName: agentPackages.name,
      })
      .from(agents)
      .leftJoin(agentPackages, eq(agents.packageId, agentPackages.id))
      .where(
        and(
          eq(agents.id, chatbotId),
          eq(agents.companyId, company.id),
          isNull(agents.deletedAt)
        )
      )
      .limit(1);

    if (!chatbot) {
      return NextResponse.json({ error: "Chatbot not found" }, { status: 404 });
    }

    // Only allow viewing code for custom packages
    if (!chatbot.isCustomPackage) {
      return NextResponse.json(
        { error: "Code viewing is only available for custom packages" },
        { status: 403 }
      );
    }

    if (!chatbot.packageId) {
      return NextResponse.json(
        { error: "No package associated with this chatbot" },
        { status: 404 }
      );
    }

    const packageDir = path.join(CHATBOT_PACKAGES_DIR, chatbot.packageId);

    // Check if package directory exists
    try {
      await fs.access(packageDir);
    } catch {
      return NextResponse.json(
        { error: "Package code directory not found" },
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
        });
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
      packageId: chatbot.packageId,
      packageName: chatbot.packageName,
      packageSlug: chatbot.packageSlug,
      files: fileTree,
    });
  } catch (error) {
    console.error("Error reading package code:", error);

    // Check if it's an auth error
    if (error instanceof Error && error.message.includes("Unauthorized")) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to read package code" },
      { status: 500 }
    );
  }
}
