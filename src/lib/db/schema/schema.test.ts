import { describe, expect, it } from "vitest";
import { getTableName } from "drizzle-orm";

import * as schema from "./index";

describe("Database Schema", () => {
  describe("Enums", () => {
    it("should export user role enum", () => {
      expect(schema.userRoleEnum).toBeDefined();
      expect(schema.userRoleEnum.enumValues).toContain("master_admin");
      expect(schema.userRoleEnum.enumValues).toContain("company_admin");
      expect(schema.userRoleEnum.enumValues).toContain("support_agent");
    });

    it("should export user status enum", () => {
      expect(schema.userStatusEnum).toBeDefined();
      expect(schema.userStatusEnum.enumValues).toContain("active");
      expect(schema.userStatusEnum.enumValues).toContain("inactive");
      expect(schema.userStatusEnum.enumValues).toContain("suspended");
    });

    it("should export agent status enum", () => {
      expect(schema.agentStatusEnum).toBeDefined();
      expect(schema.agentStatusEnum.enumValues).toContain("draft");
      expect(schema.agentStatusEnum.enumValues).toContain("active");
      expect(schema.agentStatusEnum.enumValues).toContain("paused");
      expect(schema.agentStatusEnum.enumValues).toContain("archived");
    });

    it("should export conversation status enum", () => {
      expect(schema.conversationStatusEnum).toBeDefined();
      expect(schema.conversationStatusEnum.enumValues).toContain("active");
      expect(schema.conversationStatusEnum.enumValues).toContain("waiting_human");
      expect(schema.conversationStatusEnum.enumValues).toContain("resolved");
    });

    it("should export message role enum", () => {
      expect(schema.messageRoleEnum).toBeDefined();
      expect(schema.messageRoleEnum.enumValues).toContain("user");
      expect(schema.messageRoleEnum.enumValues).toContain("assistant");
      expect(schema.messageRoleEnum.enumValues).toContain("system");
      expect(schema.messageRoleEnum.enumValues).toContain("human_agent");
    });

    it("should export channel type enum", () => {
      expect(schema.channelTypeEnum).toBeDefined();
      expect(schema.channelTypeEnum.enumValues).toContain("web");
      expect(schema.channelTypeEnum.enumValues).toContain("whatsapp");
      expect(schema.channelTypeEnum.enumValues).toContain("slack");
    });

    it("should export subscription status enum", () => {
      expect(schema.subscriptionStatusEnum).toBeDefined();
      expect(schema.subscriptionStatusEnum.enumValues).toContain("trial");
      expect(schema.subscriptionStatusEnum.enumValues).toContain("active");
      expect(schema.subscriptionStatusEnum.enumValues).toContain("cancelled");
    });
  });

  describe("Tables", () => {
    it("should export companies table", () => {
      expect(schema.companies).toBeDefined();
      expect(getTableName(schema.companies)).toBe("chatapp_companies");
    });

    it("should export users table", () => {
      expect(schema.users).toBeDefined();
      expect(getTableName(schema.users)).toBe("chatapp_users");
    });

    it("should export accounts table (Auth.js)", () => {
      expect(schema.accounts).toBeDefined();
      expect(getTableName(schema.accounts)).toBe("chatapp_accounts");
    });

    it("should export sessions table (Auth.js)", () => {
      expect(schema.sessions).toBeDefined();
      expect(getTableName(schema.sessions)).toBe("chatapp_sessions");
    });

    it("should export verificationTokens table (Auth.js)", () => {
      expect(schema.verificationTokens).toBeDefined();
      expect(getTableName(schema.verificationTokens)).toBe("chatapp_verification_tokens");
    });

    it("should export subscription plans table", () => {
      expect(schema.subscriptionPlans).toBeDefined();
      expect(getTableName(schema.subscriptionPlans)).toBe("chatapp_subscription_plans");
    });

    it("should export company subscriptions table", () => {
      expect(schema.companySubscriptions).toBeDefined();
      expect(getTableName(schema.companySubscriptions)).toBe("chatapp_company_subscriptions");
    });

    it("should export agent packages table", () => {
      expect(schema.agentPackages).toBeDefined();
      expect(getTableName(schema.agentPackages)).toBe("chatapp_agent_packages");
    });

    it("should export agents table", () => {
      expect(schema.agents).toBeDefined();
      expect(getTableName(schema.agents)).toBe("chatapp_agents");
    });

    it("should export knowledge sources table", () => {
      expect(schema.knowledgeSources).toBeDefined();
      expect(getTableName(schema.knowledgeSources)).toBe("chatapp_knowledge_sources");
    });

    it("should export knowledge chunks table", () => {
      expect(schema.knowledgeChunks).toBeDefined();
      expect(getTableName(schema.knowledgeChunks)).toBe("chatapp_knowledge_chunks");
    });

    it("should export FAQ items table", () => {
      expect(schema.faqItems).toBeDefined();
      expect(getTableName(schema.faqItems)).toBe("chatapp_faq_items");
    });

    it("should export conversations table", () => {
      expect(schema.conversations).toBeDefined();
      expect(getTableName(schema.conversations)).toBe("chatapp_conversations");
    });

    it("should export messages table", () => {
      expect(schema.messages).toBeDefined();
      expect(getTableName(schema.messages)).toBe("chatapp_messages");
    });

    it("should export escalations table", () => {
      expect(schema.escalations).toBeDefined();
      expect(getTableName(schema.escalations)).toBe("chatapp_escalations");
    });

    it("should export integrations table", () => {
      expect(schema.integrations).toBeDefined();
      expect(getTableName(schema.integrations)).toBe("chatapp_integrations");
    });

    it("should export webhooks table", () => {
      expect(schema.webhooks).toBeDefined();
      expect(getTableName(schema.webhooks)).toBe("chatapp_webhooks");
    });

    it("should export invitations table", () => {
      expect(schema.invitations).toBeDefined();
      expect(getTableName(schema.invitations)).toBe("chatapp_invitations");
    });

    it("should export audit logs table", () => {
      expect(schema.auditLogs).toBeDefined();
      expect(getTableName(schema.auditLogs)).toBe("chatapp_audit_logs");
    });

    it("should export daily analytics table", () => {
      expect(schema.dailyAnalytics).toBeDefined();
      expect(getTableName(schema.dailyAnalytics)).toBe("chatapp_daily_analytics");
    });

    it("should export hourly analytics table", () => {
      expect(schema.hourlyAnalytics).toBeDefined();
      expect(getTableName(schema.hourlyAnalytics)).toBe("chatapp_hourly_analytics");
    });

    it("should export platform analytics table", () => {
      expect(schema.platformAnalytics).toBeDefined();
      expect(getTableName(schema.platformAnalytics)).toBe("chatapp_platform_analytics");
    });
  });

  describe("Relations", () => {
    it("should export companies relations", () => {
      expect(schema.companiesRelations).toBeDefined();
    });

    it("should export users relations", () => {
      expect(schema.usersRelations).toBeDefined();
    });

    it("should export agents relations", () => {
      expect(schema.agentsRelations).toBeDefined();
    });

    it("should export conversations relations", () => {
      expect(schema.conversationsRelations).toBeDefined();
    });

    it("should export messages relations", () => {
      expect(schema.messagesRelations).toBeDefined();
    });
  });

  describe("Types", () => {
    it("should export Company type", () => {
      // Type check - this will fail at compile time if type doesn't exist
      const company: schema.Company = {
        id: "test-id",
        name: "Test Company",
        slug: "test",
        description: null,
        logoUrl: null,
        primaryColor: "#6437F3",
        secondaryColor: "#2b3dd8",
        customDomain: null,
        customDomainVerified: false,
        timezone: "UTC",
        locale: "en",
        settings: {},
        status: "trial",
        apiKeyHash: null,
        apiKeyPrefix: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };
      expect(company).toBeDefined();
    });

    it("should export User type", () => {
      const user: schema.User = {
        id: "test-id",
        email: "test@test.com",
        emailVerified: null,
        name: "Test User",
        image: null,
        hashedPassword: null,
        companyId: null,
        role: "support_agent",
        status: "active",
        phone: null,
        avatarUrl: null,
        permissions: {},
        settings: {},
        isActive: true,
        lastLoginAt: null,
        ipAllowlist: [],
        accessExpiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };
      expect(user).toBeDefined();
    });

    it("should export Agent type", () => {
      const agent: schema.Agent = {
        id: "test-id",
        companyId: "company-id",
        packageId: null,
        name: "Test Agent",
        description: null,
        type: "support",
        status: "draft",
        avatarUrl: null,
        systemPrompt: "You are a helpful assistant",
        modelId: "gpt-4o-mini",
        temperature: 70,
        behavior: {},
        escalationEnabled: true,
        escalationTriggers: [],
        knowledgeSourceIds: [],
        totalConversations: 0,
        avgResolutionTime: null,
        satisfactionScore: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };
      expect(agent).toBeDefined();
    });

    it("should export Conversation type", () => {
      const conversation: schema.Conversation = {
        id: "test-id",
        companyId: "company-id",
        agentId: "agent-id",
        endUserId: "end-user-id",
        channel: "web",
        status: "active",
        subject: null,
        assignedUserId: null,
        messageCount: 0,
        userMessageCount: 0,
        assistantMessageCount: 0,
        resolutionType: null,
        resolvedAt: null,
        resolvedBy: null,
        sentiment: null,
        sentimentHistory: [],
        satisfactionRating: null,
        satisfactionFeedback: null,
        sessionId: null,
        pageUrl: null,
        referrer: null,
        metadata: {},
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        lastMessageAt: null,
      };
      expect(conversation).toBeDefined();
    });

    it("should export Message type", () => {
      const message: schema.Message = {
        id: "test-id",
        conversationId: "conversation-id",
        role: "user",
        type: "text",
        content: "Hello",
        userId: null,
        attachments: [],
        modelId: null,
        tokenCount: null,
        processingTimeMs: null,
        toolCalls: [],
        toolResults: [],
        sourceChunkIds: [],
        isRead: false,
        readAt: null,
        metadata: {},
        createdAt: new Date(),
      };
      expect(message).toBeDefined();
    });
  });
});
