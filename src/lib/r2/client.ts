/**
 * Cloudflare R2 Storage Client
 *
 * R2 is S3-compatible object storage. This client provides utilities
 * for uploading and managing files in the R2 bucket.
 *
 * Storage paths:
 * - Widget config: chatapp/companies/{companyId}/settings/{chatbotId}.json
 * - Company logo: chatapp/companies/{companyId}/settings/logo-{chatbotId}.webp
 */

import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";

// R2 Configuration
const R2_ACCOUNT_ID = process.env.CLOUDFLARE_R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = "buzzi-ai";

// R2 endpoint format: https://{accountId}.r2.cloudflarestorage.com
const R2_ENDPOINT = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;

// Public URL for accessing files (configure custom domain or use R2 public URL)
// For public buckets, files are accessible at: https://pub-{hash}.r2.dev/{path}
// Or via custom domain if configured
const R2_PUBLIC_URL = process.env.CLOUDFLARE_R2_PUBLIC_URL || `https://${R2_BUCKET_NAME}.${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;

/**
 * Create S3-compatible client for Cloudflare R2
 */
function createR2Client(): S3Client {
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    throw new Error(
      "Missing R2 credentials. Required: CLOUDFLARE_R2_ACCOUNT_ID, CLOUDFLARE_R2_ACCESS_KEY_ID, CLOUDFLARE_R2_SECRET_ACCESS_KEY"
    );
  }

  return new S3Client({
    region: "auto",
    endpoint: R2_ENDPOINT,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });
}

// Lazy initialization of client
let r2Client: S3Client | null = null;

function getR2Client(): S3Client {
  if (!r2Client) {
    r2Client = createR2Client();
  }
  return r2Client;
}

/**
 * Upload JSON data to R2
 */
export async function uploadJson(
  path: string,
  data: Record<string, unknown>
): Promise<string> {
  const client = getR2Client();
  const body = JSON.stringify(data, null, 2);

  await client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: path,
      Body: body,
      ContentType: "application/json",
      CacheControl: "public, max-age=300", // 5 minute cache
    })
  );

  return getPublicUrl(path);
}

/**
 * Upload binary file to R2
 */
export async function uploadFile(
  path: string,
  data: Buffer | Uint8Array,
  contentType: string,
  options?: {
    cacheControl?: string;
  }
): Promise<string> {
  const client = getR2Client();

  await client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: path,
      Body: data,
      ContentType: contentType,
      CacheControl: options?.cacheControl || "public, max-age=31536000", // 1 year for immutable assets
    })
  );

  return getPublicUrl(path);
}

/**
 * Delete a file from R2
 */
export async function deleteFile(path: string): Promise<void> {
  const client = getR2Client();

  await client.send(
    new DeleteObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: path,
    })
  );
}

/**
 * Check if a file exists in R2
 */
export async function fileExists(path: string): Promise<boolean> {
  const client = getR2Client();

  try {
    await client.send(
      new HeadObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: path,
      })
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Get file content from R2
 */
export async function getFile(path: string): Promise<Buffer | null> {
  const client = getR2Client();

  try {
    const response = await client.send(
      new GetObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: path,
      })
    );

    if (response.Body) {
      const bytes = await response.Body.transformToByteArray();
      return Buffer.from(bytes);
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Get JSON content from R2
 */
export async function getJson<T = Record<string, unknown>>(
  path: string
): Promise<T | null> {
  const buffer = await getFile(path);
  if (!buffer) return null;

  try {
    return JSON.parse(buffer.toString("utf-8")) as T;
  } catch {
    return null;
  }
}

/**
 * Get public URL for a file in R2
 */
export function getPublicUrl(path: string): string {
  // Use the public URL base
  return `${R2_PUBLIC_URL}/${path}`;
}

// ============================================================================
// Widget-specific helpers
// ============================================================================

/**
 * Get the storage path for widget config JSON
 */
export function getWidgetConfigPath(companyId: string, chatbotId: string): string {
  return `chatapp/companies/${companyId}/settings/${chatbotId}.json`;
}

/**
 * Get the storage path for company logo
 */
export function getWidgetLogoPath(companyId: string, chatbotId: string): string {
  return `chatapp/companies/${companyId}/settings/logo-${chatbotId}.webp`;
}

/**
 * Upload widget config JSON to R2
 */
export async function uploadWidgetConfig(
  companyId: string,
  chatbotId: string,
  config: Record<string, unknown>
): Promise<string> {
  const path = getWidgetConfigPath(companyId, chatbotId);
  return uploadJson(path, config);
}

/**
 * Upload widget logo to R2 (expects WebP format)
 */
export async function uploadWidgetLogo(
  companyId: string,
  chatbotId: string,
  imageData: Buffer | Uint8Array
): Promise<string> {
  const path = getWidgetLogoPath(companyId, chatbotId);
  return uploadFile(path, imageData, "image/webp");
}

/**
 * Delete widget config from R2
 */
export async function deleteWidgetConfig(
  companyId: string,
  chatbotId: string
): Promise<void> {
  const path = getWidgetConfigPath(companyId, chatbotId);
  await deleteFile(path);
}

/**
 * Delete widget logo from R2
 */
export async function deleteWidgetLogo(
  companyId: string,
  chatbotId: string
): Promise<void> {
  const path = getWidgetLogoPath(companyId, chatbotId);
  await deleteFile(path);
}

/**
 * Get widget config public URL
 */
export function getWidgetConfigUrl(companyId: string, chatbotId: string): string {
  const path = getWidgetConfigPath(companyId, chatbotId);
  return getPublicUrl(path);
}

/**
 * Get widget logo public URL
 */
export function getWidgetLogoUrl(companyId: string, chatbotId: string): string {
  const path = getWidgetLogoPath(companyId, chatbotId);
  return getPublicUrl(path);
}
