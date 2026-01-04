#!/usr/bin/env npx tsx
/**
 * Script to upload all chatbot packages from src/chatbot-packages to Supabase storage
 *
 * This script:
 * 1. Compiles TypeScript packages to JavaScript using esbuild
 * 2. Uploads the compiled bundle (package.js) for runtime loading
 * 3. Uploads source files and ZIP for reference
 * 4. Updates the database with the bundle URL
 *
 * Usage:
 *   DATABASE_URL="..." NEXT_PUBLIC_SUPABASE_URL="..." SUPABASE_SERVICE_ROLE_KEY="..." npx tsx scripts/upload-packages-to-storage.ts
 */

import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import archiver from "archiver";
import * as esbuild from "esbuild";
import { createClient } from "@supabase/supabase-js";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq } from "drizzle-orm";
import * as schema from "../src/lib/db/schema";

// Configuration
const CHATBOT_PACKAGES_DIR = path.join(process.cwd(), "src/chatbot-packages");
const STORAGE_BUCKET = "chatapp";
const MAX_SIGNED_URL_EXPIRY_SECONDS = 10 * 365 * 24 * 60 * 60; // 10 years
const ALLOWED_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".json", ".md", ".txt"];

// Initialize clients
function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Supabase environment variables not configured");
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function getDb() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL not configured");
  }

  const client = postgres(databaseUrl);
  return drizzle(client, { schema });
}

async function getAllFiles(
  dirPath: string,
  basePath: string,
  files: { relativePath: string; fullPath: string }[] = []
): Promise<{ relativePath: string; fullPath: string }[]> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });

  for (const entry of entries) {
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

async function createZipBuffer(dirPath: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const archive = archiver("zip", { zlib: { level: 9 } });

    archive.on("data", (chunk: Buffer) => chunks.push(chunk));
    archive.on("end", () => resolve(Buffer.concat(chunks)));
    archive.on("error", reject);

    archive.directory(dirPath, false);
    archive.finalize();
  });
}

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

/**
 * Compile a package's TypeScript to a JavaScript bundle using esbuild
 * Returns the compiled code and source map as buffers
 */
async function compilePackage(packagePath: string): Promise<{
  code: Buffer;
  map: Buffer;
  checksum: string;
}> {
  const entryPoint = path.join(packagePath, "index.ts");

  // Check if entry point exists
  try {
    await fs.access(entryPoint);
  } catch {
    throw new Error(`Entry point not found: ${entryPoint}`);
  }

  // Build with esbuild - specify outdir to get proper file paths
  const result = await esbuild.build({
    entryPoints: [entryPoint],
    bundle: true,
    write: false, // Return as buffer
    format: "esm", // ESM for dynamic import()
    platform: "node",
    target: "node18",
    sourcemap: true,
    minify: true,
    treeShaking: true,
    outdir: "out", // Needed to generate proper file paths in outputFiles
    // Mark @buzzi-ai/agent-sdk as external (will be provided at runtime)
    external: ["@buzzi-ai/agent-sdk", "zod", "@langchain/*"],
    // Handle path aliases
    alias: {
      "@": path.join(process.cwd(), "src"),
    },
  });

  // With write: false, outputFiles contains the code and map
  // First file is the JS, second (if sourcemap: true) is the map
  const outputFiles = result.outputFiles || [];
  const codeFile = outputFiles.find((f) => !f.path.endsWith(".map"));
  const mapFile = outputFiles.find((f) => f.path.endsWith(".map"));

  if (!codeFile) {
    throw new Error(`esbuild did not produce output file. Files: ${outputFiles.map(f => f.path).join(", ")}`);
  }

  const code = Buffer.from(codeFile.contents);
  const map = mapFile ? Buffer.from(mapFile.contents) : Buffer.alloc(0);

  // Generate checksum for cache invalidation
  const checksum = crypto.createHash("sha256").update(code).digest("hex");

  return { code, map, checksum };
}

async function main() {
  console.log("Starting package upload to Supabase storage...\n");

  const supabase = getSupabaseClient();
  const db = getDb();

  // Get all packages from database
  const packages = await db
    .select({
      id: schema.chatbotPackages.id,
      slug: schema.chatbotPackages.slug,
      name: schema.chatbotPackages.name,
    })
    .from(schema.chatbotPackages);

  console.log(`Found ${packages.length} packages in database\n`);

  // Get all package directories
  const packageDirs = await fs.readdir(CHATBOT_PACKAGES_DIR, { withFileTypes: true });
  const validPackageDirs = packageDirs.filter(
    (d) => d.isDirectory() && !d.name.startsWith(".") && d.name !== "sample-single-agent" && d.name !== "sample-multi-agent"
  );

  console.log(`Found ${validPackageDirs.length} package directories\n`);

  for (const packageDir of validPackageDirs) {
    const packageId = packageDir.name;
    const packagePath = path.join(CHATBOT_PACKAGES_DIR, packageId);

    // Find the package in database
    const pkg = packages.find((p) => p.id === packageId);

    if (!pkg) {
      console.log(`  SKIP: ${packageId} - Not found in database`);
      continue;
    }

    console.log(`Processing: ${pkg.name} (${pkg.slug})`);
    console.log(`  Directory: ${packageId}`);

    const storagePath = `agent-packages/${pkg.slug}`;

    try {
      // Step 1: Compile the package
      console.log(`  Compiling TypeScript...`);
      const { code, map, checksum } = await compilePackage(packagePath);
      console.log(`  Compiled bundle: ${(code.length / 1024).toFixed(1)}KB (checksum: ${checksum.slice(0, 8)}...)`);

      // Step 2: Upload compiled bundle (primary artifact for runtime loading)
      const bundlePath = `${storagePath}/bin/package.js`;
      const { error: bundleError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(bundlePath, code, {
          contentType: "text/javascript",
          upsert: true,
        });

      if (bundleError) {
        console.log(`  ERROR uploading bundle: ${bundleError.message}`);
        continue;
      }
      console.log(`  Uploaded bundle: ${bundlePath}`);

      // Step 3: Upload source map (for debugging)
      if (map.length > 0) {
        const mapPath = `${storagePath}/bin/package.js.map`;
        const { error: mapError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(mapPath, map, {
            contentType: "application/json",
            upsert: true,
          });

        if (mapError) {
          console.log(`  WARNING: Failed to upload source map: ${mapError.message}`);
        } else {
          console.log(`  Uploaded source map: ${mapPath}`);
        }
      }

      // Step 4: Upload source files (for reference/debugging)
      const files = await getAllFiles(packagePath, packagePath);
      let uploadedCount = 0;
      for (const file of files) {
        const content = await fs.readFile(file.fullPath);
        const sourcePath = `${storagePath}/source/${file.relativePath}`;

        const { error } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(sourcePath, content, {
            contentType: getContentType(file.relativePath),
            upsert: true,
          });

        if (error) {
          console.log(`    ERROR uploading ${file.relativePath}: ${error.message}`);
        } else {
          uploadedCount++;
        }
      }
      console.log(`  Uploaded ${uploadedCount} source files`);

      // Step 5: Create and upload zip (for reference/backup)
      const zipBuffer = await createZipBuffer(packagePath);
      const zipPath = `${storagePath}/bin/package.zip`;

      const { error: zipError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(zipPath, zipBuffer, {
          contentType: "application/zip",
          upsert: true,
        });

      if (zipError) {
        console.log(`  WARNING: Failed to upload zip: ${zipError.message}`);
      } else {
        console.log(`  Created zip: ${zipPath}`);
      }

      // Step 6: Generate signed URL for the compiled bundle (not the zip)
      const { data: signedData, error: signedError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .createSignedUrl(bundlePath, MAX_SIGNED_URL_EXPIRY_SECONDS);

      if (signedError || !signedData?.signedUrl) {
        console.log(`  ERROR generating signed URL: ${signedError?.message}`);
        continue;
      }

      // Step 7: Update database with bundle URL and checksum
      await db
        .update(schema.chatbotPackages)
        .set({
          bundlePath: signedData.signedUrl,
          bundleChecksum: checksum,
          updatedAt: new Date(),
        })
        .where(eq(schema.chatbotPackages.id, packageId));

      console.log(`  Updated database: bundlePath + checksum`);
      console.log(`  SUCCESS\n`);
    } catch (error) {
      console.log(`  ERROR: ${error instanceof Error ? error.message : "Unknown error"}\n`);
    }
  }

  console.log("\nDone!");
  process.exit(0);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
