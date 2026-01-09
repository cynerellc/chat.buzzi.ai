import { createClient } from "@supabase/supabase-js";

let supabaseClient: ReturnType<typeof createClient> | null = null;

/**
 * Get Supabase client for server-side operations (uses service role key)
 */
export function getSupabaseClient() {
  if (!supabaseClient) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Supabase environment variables not configured");
    }

    supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return supabaseClient;
}

/**
 * Get the public URL for a file in Supabase storage
 * Note: This only works for public buckets. For private buckets, use getSignedStorageUrl()
 */
export function getSupabaseStorageUrl(bucket: string, path: string): string {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL not configured");
  }
  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${path}`;
}

/**
 * Maximum signed URL expiry in seconds (10 years)
 * Supabase allows very long expiry times for signed URLs
 */
export const MAX_SIGNED_URL_EXPIRY_SECONDS = 10 * 365 * 24 * 60 * 60; // 315,360,000 seconds

/**
 * Get a signed URL for a file in Supabase storage (for private buckets)
 * @param path - Storage path within the bucket
 * @param expiresIn - Expiry time in seconds (default: 10 years)
 * @returns Signed URL or null if generation fails
 */
export async function getSignedStorageUrl(
  path: string,
  expiresIn: number = MAX_SIGNED_URL_EXPIRY_SECONDS
): Promise<string | null> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(path, expiresIn);

  if (error) {
    console.error(`Error creating signed URL for ${path}:`, error);
    return null;
  }

  return data.signedUrl;
}

/**
 * Get signed URLs for multiple files in Supabase storage (batch operation)
 * @param paths - Array of storage paths within the bucket
 * @param expiresIn - Expiry time in seconds (default: 10 years)
 * @returns Array of signed URLs (null for failed entries)
 */
export async function getSignedStorageUrls(
  paths: string[],
  expiresIn: number = MAX_SIGNED_URL_EXPIRY_SECONDS
): Promise<Array<{ path: string; signedUrl: string | null; error?: string }>> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrls(paths, expiresIn);

  if (error) {
    console.error("Error creating signed URLs:", error);
    return paths.map((path) => ({ path, signedUrl: null, error: error.message }));
  }

  return (data ?? []).map((item) => ({
    path: item.path ?? "",
    signedUrl: item.signedUrl ?? null,
    error: item.error ?? undefined,
  }));
}

/**
 * Storage bucket name for chat app files
 */
export const STORAGE_BUCKET = "chatapp";

/**
 * Preset avatars storage path
 */
export const PRESET_AVATARS_PATH = "public/general/avatars";

/**
 * Get the storage path for knowledge files
 */
export function getKnowledgeStoragePath(companyId: string, fileName: string): string {
  return `knowledge/${companyId}/${fileName}`;
}

/**
 * Conversation files storage path prefix
 */
export const CONVERSATION_FILES_PATH = "conversation-files";

/**
 * Get the storage path for conversation files (voice messages, uploads)
 * @param companyId - Company ID
 * @param conversationId - Conversation ID
 * @param fileName - File name (e.g., "{messageId}.webm" or "uploads/{fileName}")
 */
export function getConversationFilePath(
  companyId: string,
  conversationId: string,
  fileName: string
): string {
  return `${CONVERSATION_FILES_PATH}/${companyId}/${conversationId}/${fileName}`;
}

/**
 * Upload a file to conversation storage
 * @param companyId - Company ID for multi-tenant isolation
 * @param conversationId - Conversation ID for access control
 * @param fileName - File name (e.g., "{messageId}.webm")
 * @param fileBuffer - File content as Buffer
 * @param mimeType - MIME type of the file
 * @returns Storage path and signed URL for access
 */
export async function uploadConversationFile(
  companyId: string,
  conversationId: string,
  fileName: string,
  fileBuffer: Buffer,
  mimeType: string
): Promise<{ storagePath: string; signedUrl: string }> {
  const supabase = getSupabaseClient();
  const storagePath = getConversationFilePath(companyId, conversationId, fileName);

  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, fileBuffer, {
      contentType: mimeType,
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Failed to upload file: ${uploadError.message}`);
  }

  // Generate signed URL for access (1 hour expiry for playback)
  const signedUrl = await getConversationFileUrl(storagePath);
  if (!signedUrl) {
    throw new Error("Failed to generate signed URL for uploaded file");
  }

  return { storagePath, signedUrl };
}

/**
 * Default expiry for conversation file URLs (1 hour)
 */
export const CONVERSATION_FILE_URL_EXPIRY = 60 * 60; // 1 hour in seconds

/**
 * Get a signed URL for a conversation file
 * @param storagePath - Full storage path of the file
 * @param expiresIn - Expiry time in seconds (default: 1 hour)
 * @returns Signed URL or null if generation fails
 */
export async function getConversationFileUrl(
  storagePath: string,
  expiresIn: number = CONVERSATION_FILE_URL_EXPIRY
): Promise<string | null> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(storagePath, expiresIn);

  if (error) {
    console.error(`Error creating signed URL for ${storagePath}:`, error);
    return null;
  }

  return data.signedUrl;
}
