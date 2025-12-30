/**
 * Admin Configuration Types and Factory Functions
 *
 * This module provides configuration for shared components that work
 * across both company admin and master admin contexts.
 */

export type AdminMode = "company" | "master";

export interface AdminConfig {
  mode: AdminMode;
  companyId: string;

  // API URL builders
  buildApiUrl: (path: string) => string;
  buildKnowledgeApiUrl: (path?: string) => string;
  buildChatbotApiUrl: (chatbotId: string, path?: string) => string;
  buildAgentsApiUrl: (chatbotId: string) => string;

  // Navigation URL builders
  buildNavUrl: (path: string) => string;
  buildKnowledgeNavUrl: (path?: string) => string;
  buildChatbotNavUrl: (chatbotId: string, path?: string) => string;

  // Feature flags
  canEditAISettings: boolean; // System prompt, model, temperature - master only
  canToggleKnowledgeBase: boolean; // KB enabled toggle - master only
  canAddKnowledge: boolean; // Add sources/FAQs - both
}

/**
 * Creates configuration for company admin context.
 * Company admins have limited access - cannot edit AI settings.
 */
export function createCompanyAdminConfig(companyId: string): AdminConfig {
  return {
    mode: "company",
    companyId,

    // API URLs - company admin uses /api/company/...
    buildApiUrl: (path: string) => `/api/company${path.startsWith("/") ? path : `/${path}`}`,

    buildKnowledgeApiUrl: (path?: string) =>
      path ? `/api/company/knowledge${path.startsWith("/") ? path : `/${path}`}` : "/api/company/knowledge",

    buildChatbotApiUrl: (chatbotId: string, path?: string) =>
      path
        ? `/api/company/chatbots/${chatbotId}${path.startsWith("/") ? path : `/${path}`}`
        : `/api/company/chatbots/${chatbotId}`,

    buildAgentsApiUrl: (chatbotId: string) => `/api/company/agents/${chatbotId}`,

    // Navigation URLs - company admin routes
    buildNavUrl: (path: string) => (path.startsWith("/") ? path : `/${path}`),

    buildKnowledgeNavUrl: (path?: string) =>
      path ? `/knowledge${path.startsWith("/") ? path : `/${path}`}` : "/knowledge",

    buildChatbotNavUrl: (chatbotId: string, path?: string) =>
      path
        ? `/chatbots/${chatbotId}${path.startsWith("/") ? path : `/${path}`}`
        : `/chatbots/${chatbotId}`,

    // Feature flags - company admin has restricted access
    canEditAISettings: false,
    canToggleKnowledgeBase: false,
    canAddKnowledge: true,
  };
}

/**
 * Creates configuration for master admin context.
 * Master admins have full access to all features.
 */
export function createMasterAdminConfig(companyId: string): AdminConfig {
  const basePath = `/admin/companies/${companyId}`;

  return {
    mode: "master",
    companyId,

    // API URLs - master admin uses /api/master-admin/companies/[companyId]/...
    buildApiUrl: (path: string) =>
      `/api/master-admin/companies/${companyId}${path.startsWith("/") ? path : `/${path}`}`,

    buildKnowledgeApiUrl: (path?: string) =>
      path
        ? `/api/master-admin/companies/${companyId}/knowledge${path.startsWith("/") ? path : `/${path}`}`
        : `/api/master-admin/companies/${companyId}/knowledge`,

    buildChatbotApiUrl: (chatbotId: string, path?: string) =>
      path
        ? `/api/master-admin/companies/${companyId}/chatbots/${chatbotId}${path.startsWith("/") ? path : `/${path}`}`
        : `/api/master-admin/companies/${companyId}/chatbots/${chatbotId}`,

    buildAgentsApiUrl: (chatbotId: string) =>
      `/api/master-admin/companies/${companyId}/chatbots/${chatbotId}`,

    // Navigation URLs - master admin routes
    buildNavUrl: (path: string) => `${basePath}${path.startsWith("/") ? path : `/${path}`}`,

    buildKnowledgeNavUrl: (path?: string) =>
      path ? `${basePath}/knowledge${path.startsWith("/") ? path : `/${path}`}` : `${basePath}/knowledge`,

    buildChatbotNavUrl: (chatbotId: string, path?: string) =>
      path
        ? `${basePath}/chatbots/${chatbotId}${path.startsWith("/") ? path : `/${path}`}`
        : `${basePath}/chatbots/${chatbotId}`,

    // Feature flags - master admin has full access
    canEditAISettings: true,
    canToggleKnowledgeBase: true,
    canAddKnowledge: true,
  };
}
