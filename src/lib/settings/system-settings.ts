/**
 * System Settings Service
 *
 * Manages platform-wide settings. In production, these would typically
 * be stored in a database table. For now, we use environment variables
 * as the source of truth with fallback defaults.
 */

export interface GeneralSettings {
  platformName: string;
  supportEmail: string;
  defaultTimezone: string;
  defaultLanguage: string;
  allowRegistrations: boolean;
  enableTrial: boolean;
  trialDays: number;
  maintenanceMode: boolean;
  enablePublicApi: boolean;
}

export interface EmailSettings {
  smtpHost: string;
  smtpPort: number;
  smtpUsername: string;
  smtpPassword: string;
  fromEmail: string;
  fromName: string;
  smtpSecure: boolean;
}

export interface AISettings {
  defaultProvider: "openai" | "anthropic" | "custom";
  openaiApiKey: string;
  openaiDefaultModel: string;
  openaiEmbeddingModel: string;
  anthropicApiKey: string;
  maxTokensPerRequest: number;
  maxRequestsPerMinute: number;
}

export interface SecuritySettings {
  sessionTimeoutMinutes: number;
  maxLoginAttempts: number;
  lockoutDurationMinutes: number;
  passwordMinLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumber: boolean;
  requireSpecialChar: boolean;
  allow2fa: boolean;
  require2faMasterAdmin: boolean;
  require2faCompanyAdmin: boolean;
  requireApiAuth: boolean;
  enableRateLimiting: boolean;
  logApiRequests: boolean;
}

export interface IntegrationStatus {
  name: string;
  type: string;
  connected: boolean;
  lastChecked: string | null;
  error: string | null;
}

export interface MaintenanceSettings {
  maintenanceMode: boolean;
  maintenanceMessage: string;
  allowMasterAdminAccess: boolean;
}

export interface SystemSettings {
  general: GeneralSettings;
  email: EmailSettings;
  ai: AISettings;
  security: SecuritySettings;
  maintenance: MaintenanceSettings;
}

// Default settings
const defaultSettings: SystemSettings = {
  general: {
    platformName: "Chat.buzzi.ai",
    supportEmail: "support@chat.buzzi.ai",
    defaultTimezone: "America/New_York",
    defaultLanguage: "en-US",
    allowRegistrations: true,
    enableTrial: true,
    trialDays: 14,
    maintenanceMode: false,
    enablePublicApi: true,
  },
  email: {
    smtpHost: process.env.SMTP_HOST ?? "",
    smtpPort: parseInt(process.env.SMTP_PORT ?? "587", 10),
    smtpUsername: process.env.SMTP_USERNAME ?? "",
    smtpPassword: process.env.SMTP_PASSWORD ?? "",
    fromEmail: process.env.SMTP_FROM_EMAIL ?? "noreply@chat.buzzi.ai",
    fromName: process.env.SMTP_FROM_NAME ?? "Chat.buzzi.ai",
    smtpSecure: process.env.SMTP_SECURE === "true",
  },
  ai: {
    defaultProvider: "openai",
    openaiApiKey: process.env.OPENAI_API_KEY ?? "",
    openaiDefaultModel: "gpt-4o-mini",
    openaiEmbeddingModel: "text-embedding-ada-002",
    anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
    maxTokensPerRequest: 4096,
    maxRequestsPerMinute: 60,
  },
  security: {
    sessionTimeoutMinutes: 1440, // 24 hours
    maxLoginAttempts: 5,
    lockoutDurationMinutes: 30,
    passwordMinLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumber: true,
    requireSpecialChar: false,
    allow2fa: true,
    require2faMasterAdmin: false,
    require2faCompanyAdmin: false,
    requireApiAuth: true,
    enableRateLimiting: true,
    logApiRequests: true,
  },
  maintenance: {
    maintenanceMode: false,
    maintenanceMessage:
      "We are currently performing scheduled maintenance. Please check back in a few minutes.",
    allowMasterAdminAccess: true,
  },
};

// In-memory settings cache (in production, use Redis or database)
let settingsCache: SystemSettings | null = null;

/**
 * Get all system settings
 */
export async function getSystemSettings(): Promise<SystemSettings> {
  if (settingsCache) {
    return settingsCache;
  }

  // In a real implementation, this would fetch from database
  // For now, return defaults merged with environment variables
  settingsCache = { ...defaultSettings };
  return settingsCache;
}

/**
 * Get a specific settings section
 */
export async function getSettingsSection<K extends keyof SystemSettings>(
  section: K
): Promise<SystemSettings[K]> {
  const settings = await getSystemSettings();
  return settings[section];
}

/**
 * Update system settings
 */
export async function updateSystemSettings(
  updates: Partial<SystemSettings>
): Promise<SystemSettings> {
  const current = await getSystemSettings();

  // Deep merge updates
  const updated: SystemSettings = {
    general: { ...current.general, ...updates.general },
    email: { ...current.email, ...updates.email },
    ai: { ...current.ai, ...updates.ai },
    security: { ...current.security, ...updates.security },
    maintenance: { ...current.maintenance, ...updates.maintenance },
  };

  // Update cache
  settingsCache = updated;

  // In production, persist to database here
  // await db.update(systemSettings)...

  return updated;
}

/**
 * Reset settings to defaults
 */
export async function resetSystemSettings(): Promise<SystemSettings> {
  settingsCache = { ...defaultSettings };
  return settingsCache;
}

/**
 * Check integration status
 */
export async function getIntegrationStatus(): Promise<IntegrationStatus[]> {
  const settings = await getSystemSettings();
  const now = new Date().toISOString();

  const integrations: IntegrationStatus[] = [
    {
      name: "OpenAI",
      type: "ai",
      connected: !!settings.ai.openaiApiKey,
      lastChecked: now,
      error: null,
    },
    {
      name: "Anthropic",
      type: "ai",
      connected: !!settings.ai.anthropicApiKey,
      lastChecked: now,
      error: null,
    },
    {
      name: "SMTP Email",
      type: "email",
      connected: !!settings.email.smtpHost && !!settings.email.smtpPassword,
      lastChecked: now,
      error: null,
    },
    {
      name: "Supabase",
      type: "database",
      connected: !!process.env.DATABASE_URL,
      lastChecked: now,
      error: null,
    },
  ];

  return integrations;
}

/**
 * Mask sensitive values for API responses
 */
export function maskSensitiveSettings(
  settings: SystemSettings
): SystemSettings {
  return {
    ...settings,
    email: {
      ...settings.email,
      smtpPassword: settings.email.smtpPassword ? "••••••••" : "",
    },
    ai: {
      ...settings.ai,
      openaiApiKey: settings.ai.openaiApiKey
        ? `sk-${"•".repeat(20)}...${settings.ai.openaiApiKey.slice(-4)}`
        : "",
      anthropicApiKey: settings.ai.anthropicApiKey
        ? `sk-${"•".repeat(20)}...${settings.ai.anthropicApiKey.slice(-4)}`
        : "",
    },
  };
}
