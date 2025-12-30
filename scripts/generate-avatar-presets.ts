/**
 * Generate Avatar Presets JSON
 *
 * This script generates a JSON file containing all preset avatars with signed URLs.
 * The signed URLs have a 10-year expiry for long-term usage.
 *
 * Run this script:
 * - After adding new avatars to storage
 * - Periodically to refresh URLs before expiry (recommended: yearly)
 *
 * Usage:
 *   npx tsx scripts/generate-avatar-presets.ts
 *
 * Output:
 *   public/data/avatar-presets.json
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

// Configuration
const STORAGE_BUCKET = "chatapp";
const PRESET_AVATARS_PATH = "public/general/avatars";
const OUTPUT_FILE = "public/data/avatar-presets.json";
const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp", ".gif"];

// 10 years in seconds
const MAX_EXPIRY_SECONDS = 10 * 365 * 24 * 60 * 60;

interface PresetAvatar {
  id: string;
  name: string;
  storagePath: string;
  signedUrl: string;
  generatedAt: string;
  expiresAt: string;
}

interface AvatarPresetsFile {
  version: string;
  generatedAt: string;
  expiresAt: string;
  expirySeconds: number;
  avatars: PresetAvatar[];
}

async function main() {
  console.log("🎨 Generating avatar presets with signed URLs...\n");

  // Validate environment
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("❌ Missing environment variables:");
    if (!supabaseUrl) console.error("   - NEXT_PUBLIC_SUPABASE_URL");
    if (!supabaseServiceKey) console.error("   - SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  // Create Supabase client
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  // List files in preset avatars folder
  console.log(`📁 Listing files in ${PRESET_AVATARS_PATH}...`);
  const { data: files, error: listError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .list(PRESET_AVATARS_PATH, {
      limit: 100,
      sortBy: { column: "name", order: "asc" },
    });

  if (listError) {
    console.error("❌ Error listing files:", listError.message);
    process.exit(1);
  }

  if (!files || files.length === 0) {
    console.log("⚠️  No files found in preset avatars folder");
    console.log("   Make sure to upload avatars to:", PRESET_AVATARS_PATH);
    process.exit(0);
  }

  // Filter for image files
  const imageFiles = files.filter((file) => {
    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
    return IMAGE_EXTENSIONS.includes(ext);
  });

  console.log(`   Found ${imageFiles.length} image files\n`);

  if (imageFiles.length === 0) {
    console.log("⚠️  No image files found (supported:", IMAGE_EXTENSIONS.join(", ") + ")");
    process.exit(0);
  }

  // Generate signed URLs for all files
  console.log("🔐 Generating signed URLs (10-year expiry)...");
  const storagePaths = imageFiles.map(
    (file) => `${PRESET_AVATARS_PATH}/${file.name}`
  );

  const { data: signedData, error: signedError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrls(storagePaths, MAX_EXPIRY_SECONDS);

  if (signedError) {
    console.error("❌ Error generating signed URLs:", signedError.message);
    process.exit(1);
  }

  // Build avatar objects
  const now = new Date();
  const expiryDate = new Date(now.getTime() + MAX_EXPIRY_SECONDS * 1000);

  const avatars: PresetAvatar[] = [];

  for (let i = 0; i < imageFiles.length; i++) {
    const file = imageFiles[i];
    const signedResult = signedData?.[i];

    if (!file || !signedResult?.signedUrl) {
      console.warn(`   ⚠️  Skipping ${file?.name ?? "unknown"}: Failed to generate signed URL`);
      continue;
    }

    // Generate readable name from filename
    const baseName = file.name.slice(0, file.name.lastIndexOf("."));
    const readableName = baseName
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());

    avatars.push({
      id: file.id ?? file.name,
      name: readableName,
      storagePath: `${PRESET_AVATARS_PATH}/${file.name}`,
      signedUrl: signedResult.signedUrl,
      generatedAt: now.toISOString(),
      expiresAt: expiryDate.toISOString(),
    });

    console.log(`   ✓ ${file.name} -> ${readableName}`);
  }

  // Create output structure
  const output: AvatarPresetsFile = {
    version: "1.0",
    generatedAt: now.toISOString(),
    expiresAt: expiryDate.toISOString(),
    expirySeconds: MAX_EXPIRY_SECONDS,
    avatars,
  };

  // Ensure output directory exists
  const outputPath = path.resolve(process.cwd(), OUTPUT_FILE);
  const outputDir = path.dirname(outputPath);

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
    console.log(`\n📁 Created directory: ${outputDir}`);
  }

  // Write JSON file
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`\n✅ Generated ${OUTPUT_FILE}`);
  console.log(`   - ${avatars.length} avatars`);
  console.log(`   - Expires: ${expiryDate.toLocaleDateString()} (${Math.round(MAX_EXPIRY_SECONDS / 365 / 24 / 60 / 60)} years)`);
  console.log("\n🎉 Done!\n");
}

main().catch((error) => {
  console.error("❌ Unexpected error:", error);
  process.exit(1);
});
