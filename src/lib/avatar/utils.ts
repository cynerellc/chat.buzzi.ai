import sharp from "sharp";
import { v4 as uuidv4 } from "uuid";

export interface CropData {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Get the storage path for an avatar based on user role
 */
export function getAvatarStoragePath(
  isMasterAdmin: boolean,
  companyId: string | null,
  fileName: string
): string {
  if (isMasterAdmin) {
    return `public/general/avatars/${fileName}`;
  }
  if (!companyId) {
    throw new Error("Company ID is required for company admin uploads");
  }
  return `public/companies/${companyId}/avatars/${fileName}`;
}

/**
 * Generate a unique filename for an avatar
 */
export function generateAvatarFileName(extension: string = "png"): string {
  return `${uuidv4()}.${extension}`;
}

/**
 * Process an avatar image: crop, resize, and optionally apply circle mask
 * @param buffer - Original image buffer
 * @param cropData - Crop coordinates (x, y, width, height in pixels)
 * @param circularCrop - Whether to apply a circular mask
 * @param maxSize - Maximum dimensions (default 180x180)
 * @returns Processed image buffer
 */
export async function processAvatar(
  buffer: Buffer,
  cropData: CropData,
  circularCrop: boolean = false,
  maxSize: number = 180
): Promise<Buffer> {
  let image = sharp(buffer);

  // Get image metadata to validate crop bounds
  const metadata = await image.metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;

  // Validate and clamp crop data to image bounds
  const cropX = Math.max(0, Math.round(cropData.x));
  const cropY = Math.max(0, Math.round(cropData.y));
  const cropWidth = Math.min(Math.round(cropData.width), width - cropX);
  const cropHeight = Math.min(Math.round(cropData.height), height - cropY);

  // Extract the cropped region
  image = image.extract({
    left: cropX,
    top: cropY,
    width: cropWidth,
    height: cropHeight,
  });

  // Resize to max dimensions while maintaining aspect ratio
  image = image.resize(maxSize, maxSize, {
    fit: "cover",
    position: "center",
  });

  // Apply circular mask if requested
  if (circularCrop) {
    const circleRadius = maxSize / 2;
    const circleMask = Buffer.from(
      `<svg width="${maxSize}" height="${maxSize}">
        <circle cx="${circleRadius}" cy="${circleRadius}" r="${circleRadius}" fill="white"/>
      </svg>`
    );

    image = image.composite([
      {
        input: circleMask,
        blend: "dest-in",
      },
    ]);

    // Output as PNG to preserve transparency
    return image.png().toBuffer();
  }

  // For non-circular crops, maintain original format or use PNG
  return image.png().toBuffer();
}

/**
 * Validate that a file is an acceptable image type
 */
export function isValidImageType(mimeType: string): boolean {
  const validTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  return validTypes.includes(mimeType);
}

/**
 * Get file extension from MIME type
 */
export function getExtensionFromMimeType(mimeType: string): string {
  const mimeToExt: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
  };
  return mimeToExt[mimeType] ?? "png";
}

/**
 * Maximum allowed file size in bytes (5MB)
 */
export const MAX_AVATAR_SIZE = 5 * 1024 * 1024;

/**
 * Avatar dimensions
 */
export const AVATAR_SIZE = 180;
