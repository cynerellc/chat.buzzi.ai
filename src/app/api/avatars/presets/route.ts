import * as fs from "fs";
import * as path from "path";

import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/guards";
import {
  getSupabaseClient,
  getSignedStorageUrls,
  STORAGE_BUCKET,
  PRESET_AVATARS_PATH,
  MAX_SIGNED_URL_EXPIRY_SECONDS,
} from "@/lib/supabase/client";

interface PresetAvatar {
  id: string;
  url: string;
  name: string;
}

interface PresetsResponse {
  avatars: PresetAvatar[];
  source: "cache" | "dynamic";
}

interface CachedPresetAvatar {
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
  avatars: CachedPresetAvatar[];
}

const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp", ".gif"];
const PRESETS_JSON_PATH = "public/data/avatar-presets.json";

// Cache for the presets file (in-memory for faster access)
let presetsCache: AvatarPresetsFile | null = null;
let presetsCacheTime: number = 0;
const CACHE_TTL_MS = 60 * 1000; // 1 minute cache for file reads

/**
 * Load presets from the generated JSON file
 * Returns null if file doesn't exist or is invalid
 */
function loadPresetsFromFile(): AvatarPresetsFile | null {
  try {
    // Check in-memory cache first
    if (presetsCache && Date.now() - presetsCacheTime < CACHE_TTL_MS) {
      return presetsCache;
    }

    const filePath = path.resolve(process.cwd(), PRESETS_JSON_PATH);

    if (!fs.existsSync(filePath)) {
      return null;
    }

    const content = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(content) as AvatarPresetsFile;

    // Validate the file structure
    if (!data.avatars || !Array.isArray(data.avatars)) {
      console.warn("Invalid avatar presets file structure");
      return null;
    }

    // Check if URLs have expired (add 1 day buffer)
    const expiryDate = new Date(data.expiresAt);
    const bufferMs = 24 * 60 * 60 * 1000; // 1 day
    if (expiryDate.getTime() - bufferMs < Date.now()) {
      console.warn("Avatar presets have expired, need regeneration");
      return null;
    }

    // Update cache
    presetsCache = data;
    presetsCacheTime = Date.now();

    return data;
  } catch (error) {
    console.error("Error loading avatar presets file:", error);
    return null;
  }
}

/**
 * Generate presets dynamically by fetching from storage and creating signed URLs
 * This is a fallback when the JSON file doesn't exist
 */
async function generatePresetsDynamically(): Promise<PresetAvatar[]> {
  const supabase = getSupabaseClient();

  // List files in the preset avatars folder
  const { data: files, error: listError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .list(PRESET_AVATARS_PATH, {
      limit: 100,
      sortBy: { column: "name", order: "asc" },
    });

  if (listError) {
    console.error("Error listing preset avatars:", listError);
    throw new Error("Failed to list preset avatars");
  }

  // Filter for image files
  const imageFiles = (files ?? []).filter((file) => {
    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
    return IMAGE_EXTENSIONS.includes(ext);
  });

  if (imageFiles.length === 0) {
    return [];
  }

  // Generate signed URLs for all files
  const storagePaths = imageFiles.map(
    (file) => `${PRESET_AVATARS_PATH}/${file.name}`
  );

  const signedResults = await getSignedStorageUrls(
    storagePaths,
    MAX_SIGNED_URL_EXPIRY_SECONDS
  );

  // Build avatar objects
  const avatars: PresetAvatar[] = [];

  for (let i = 0; i < imageFiles.length; i++) {
    const file = imageFiles[i];
    const signedResult = signedResults[i];

    if (!file || !signedResult?.signedUrl) {
      continue;
    }

    // Generate readable name from filename
    const baseName = file.name.slice(0, file.name.lastIndexOf("."));
    const readableName = baseName
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());

    avatars.push({
      id: file.id ?? file.name,
      url: signedResult.signedUrl,
      name: readableName,
    });
  }

  return avatars;
}

export async function GET(): Promise<NextResponse> {
  try {
    // Require any authenticated user
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Try to load from cached JSON file first (fast path)
    const cachedPresets = loadPresetsFromFile();

    if (cachedPresets) {
      const avatars: PresetAvatar[] = cachedPresets.avatars.map((a) => ({
        id: a.id,
        url: a.signedUrl,
        name: a.name,
      }));

      const response: PresetsResponse = {
        avatars,
        source: "cache",
      };

      return NextResponse.json(response);
    }

    // Fallback: Generate dynamically (slower, but works without pre-generated file)
    console.log("Avatar presets cache miss - generating dynamically");
    const avatars = await generatePresetsDynamically();

    const response: PresetsResponse = {
      avatars,
      source: "dynamic",
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching preset avatars:", error);
    return NextResponse.json(
      { error: "Failed to fetch preset avatars" },
      { status: 500 }
    );
  }
}
