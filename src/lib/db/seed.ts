import bcrypt from "bcryptjs";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

// Seed script for development/testing
async function seed() {
  const connectionString = process.env.DATABASE_URL;
  const adminEmail = process.env.ADMIN_USERNAME || "admin@buzzi.ai";
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  const client = postgres(connectionString, { max: 1 });
  const db = drizzle(client, { schema });

  console.log("🌱 Starting seed...\n");

  try {
    // 1. Create Subscription Plans
    console.log("📦 Creating subscription plans...");
    const plans = await db
      .insert(schema.subscriptionPlans)
      .values([
        {
          name: "Free",
          slug: "free",
          description: "Perfect for getting started",
          basePrice: "0.00",
          maxAgents: 1,
          maxConversationsPerMonth: 100,
          maxKnowledgeSources: 3,
          maxStorageGb: 1,
          maxTeamMembers: 1,
          features: ["Basic chat widget", "Email support"],
          customBranding: false,
          prioritySupport: false,
          apiAccess: false,
          advancedAnalytics: false,
          customIntegrations: false,
          trialDays: 0,
          sortOrder: 0,
        },
        {
          name: "Starter",
          slug: "starter",
          description: "For small businesses",
          basePrice: "49.00",
          maxAgents: 3,
          maxConversationsPerMonth: 1000,
          maxKnowledgeSources: 10,
          maxStorageGb: 5,
          maxTeamMembers: 3,
          features: [
            "Multiple AI agents",
            "Knowledge base",
            "Email support",
            "Basic analytics",
          ],
          customBranding: false,
          prioritySupport: false,
          apiAccess: false,
          advancedAnalytics: false,
          customIntegrations: false,
          trialDays: 14,
          sortOrder: 1,
        },
        {
          name: "Professional",
          slug: "professional",
          description: "For growing teams",
          basePrice: "149.00",
          maxAgents: 10,
          maxConversationsPerMonth: 5000,
          maxKnowledgeSources: 50,
          maxStorageGb: 25,
          maxTeamMembers: 10,
          features: [
            "Unlimited AI agents",
            "Advanced knowledge base",
            "Priority email support",
            "Advanced analytics",
            "Custom branding",
            "API access",
          ],
          customBranding: true,
          prioritySupport: true,
          apiAccess: true,
          advancedAnalytics: true,
          customIntegrations: false,
          trialDays: 14,
          sortOrder: 2,
        },
        {
          name: "Enterprise",
          slug: "enterprise",
          description: "For large organizations",
          basePrice: "499.00",
          maxAgents: 100,
          maxConversationsPerMonth: 50000,
          maxKnowledgeSources: 500,
          maxStorageGb: 100,
          maxTeamMembers: 100,
          features: [
            "Everything in Professional",
            "Custom integrations",
            "Dedicated support",
            "SLA guarantee",
            "Custom domain",
            "SSO/SAML",
            "Audit logs",
          ],
          customBranding: true,
          prioritySupport: true,
          apiAccess: true,
          advancedAnalytics: true,
          customIntegrations: true,
          trialDays: 30,
          sortOrder: 3,
        },
      ])
      .returning();
    console.log(`   ✓ Created ${plans.length} subscription plans\n`);

    // 2. Create Agent Packages (templates)
    console.log("🤖 Creating agent packages...");
    const packages = await db
      .insert(schema.agentPackages)
      .values([
        {
          name: "Customer Support Agent",
          slug: "customer-support",
          description: "General customer support assistant",
          category: "Support",
          defaultSystemPrompt: `You are a helpful customer support assistant. Your goal is to help customers with their questions and issues.

Guidelines:
- Be friendly, professional, and empathetic
- Provide accurate information based on the knowledge base
- If you don't know something, say so and offer to escalate to a human
- Keep responses concise but helpful
- Always ask clarifying questions if needed`,
          defaultModelId: "gpt-4o-mini",
          defaultTemperature: 70,
          defaultBehavior: {
            greeting: "Hello! How can I help you today?",
            fallbackMessage:
              "I'm not sure I understand. Could you rephrase that or let me connect you with a human agent?",
            maxTurnsBeforeEscalation: 10,
          },
          features: ["knowledge_base", "escalation", "sentiment_analysis"],
          sortOrder: 0,
        },
        {
          name: "Sales Assistant",
          slug: "sales-assistant",
          description: "Help qualify leads and answer product questions",
          category: "Sales",
          defaultSystemPrompt: `You are a knowledgeable sales assistant. Your goal is to help potential customers understand our products and services.

Guidelines:
- Be enthusiastic but not pushy
- Focus on understanding customer needs
- Highlight relevant features and benefits
- Collect contact information when appropriate
- Qualify leads based on budget, timeline, and needs`,
          defaultModelId: "gpt-4o-mini",
          defaultTemperature: 75,
          defaultBehavior: {
            greeting: "Hi there! Looking to learn more about our products?",
            fallbackMessage:
              "Great question! Let me get one of our sales team members to help you with that.",
            maxTurnsBeforeEscalation: 8,
            collectEmail: true,
            collectName: true,
          },
          features: ["knowledge_base", "lead_capture", "calendar_booking"],
          sortOrder: 1,
        },
        {
          name: "Technical Support Agent",
          slug: "technical-support",
          description: "Technical troubleshooting and documentation help",
          category: "Support",
          defaultSystemPrompt: `You are a technical support specialist. Your goal is to help users troubleshoot technical issues and find relevant documentation.

Guidelines:
- Ask for specific error messages and steps to reproduce
- Provide step-by-step solutions when possible
- Reference documentation when available
- Escalate complex issues that require code access
- Be patient and thorough`,
          defaultModelId: "gpt-4o",
          defaultTemperature: 60,
          defaultBehavior: {
            greeting: "Hello! I'm here to help with technical questions.",
            fallbackMessage:
              "This seems to require deeper investigation. Let me connect you with our technical team.",
            maxTurnsBeforeEscalation: 15,
          },
          features: ["knowledge_base", "code_snippets", "escalation"],
          sortOrder: 2,
        },
        {
          name: "FAQ Bot",
          slug: "faq-bot",
          description: "Quick answers to frequently asked questions",
          category: "General",
          defaultSystemPrompt: `You are a helpful FAQ assistant. Your goal is to quickly answer common questions from the FAQ database.

Guidelines:
- Provide direct, concise answers
- Quote from the FAQ when relevant
- Suggest related questions the user might have
- Offer to connect to a human if the question isn't in the FAQ`,
          defaultModelId: "gpt-4o-mini",
          defaultTemperature: 50,
          defaultBehavior: {
            greeting: "Hi! I can help answer your questions.",
            fallbackMessage:
              "I don't have an answer for that in my FAQ database. Would you like to speak with a human?",
            maxTurnsBeforeEscalation: 5,
          },
          features: ["faq_matching", "escalation"],
          sortOrder: 3,
        },
      ])
      .returning();
    console.log(`   ✓ Created ${packages.length} agent packages\n`);

    // 3. Create a demo company
    console.log("🏢 Creating demo company...");
    const [demoCompany] = await db
      .insert(schema.companies)
      .values({
        name: "Demo Company",
        slug: "demo",
        description: "Demo company for testing",
        primaryColor: "#6437F3",
        secondaryColor: "#2b3dd8",
        timezone: "America/New_York",
        locale: "en",
        status: "active",
      })
      .returning();

    if (!demoCompany) {
      throw new Error("Failed to create demo company");
    }
    console.log(`   ✓ Created company: ${demoCompany.name}\n`);

    // 4. Create company subscription
    console.log("📋 Creating company subscription...");
    const professionalPlan = plans.find((p) => p.slug === "professional");
    if (!professionalPlan) {
      throw new Error("Professional plan not found");
    }
    const now = new Date();
    const periodEnd = new Date();
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    await db.insert(schema.companySubscriptions).values({
      companyId: demoCompany.id,
      planId: professionalPlan.id,
      billingCycle: "monthly",
      status: "active",
      currentPrice: professionalPlan.basePrice,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
    });
    console.log(`   ✓ Subscribed to ${professionalPlan.name} plan\n`);

    // 5. Create master admin user
    console.log("👤 Creating master admin user...");
    let hashedPassword: string | null = null;
    if (adminPassword) {
      hashedPassword = await bcrypt.hash(adminPassword, 10);
      console.log(`   Using password from ADMIN_PASSWORD env variable`);
    } else {
      console.log(`   ⚠️ No ADMIN_PASSWORD set - admin will need to use OAuth or reset password`);
    }
    const masterAdminResult = await db
      .insert(schema.users)
      .values({
        email: adminEmail,
        name: "Master Admin",
        role: "chatapp.master_admin",
        status: "active",
        isActive: true,
        hashedPassword,
      })
      .returning();
    const masterAdmin = masterAdminResult[0];
    if (!masterAdmin) {
      throw new Error("Failed to create master admin");
    }
    console.log(`   ✓ Created user: ${masterAdmin.email}\n`);

    // 6. Create demo company admin
    console.log("👤 Creating company admin user...");
    const companyAdminResult = await db
      .insert(schema.users)
      .values({
        email: "admin@demo.com",
        name: "Demo Admin",
        role: "chatapp.user",
        status: "active",
        isActive: true,
      })
      .returning();
    const companyAdmin = companyAdminResult[0];
    if (!companyAdmin) {
      throw new Error("Failed to create company admin");
    }

    // Add company_admin permission for demo company
    await db.insert(schema.companyPermissions).values({
      companyId: demoCompany.id,
      userId: companyAdmin.id,
      role: "chatapp.company_admin",
    });
    console.log(`   ✓ Created user: ${companyAdmin.email} (company admin)\n`);

    // 7. Create support agent
    console.log("👤 Creating support agent user...");
    const supportAgentResult = await db
      .insert(schema.users)
      .values({
        email: "agent@demo.com",
        name: "Demo Agent",
        role: "chatapp.user",
        status: "active",
        isActive: true,
      })
      .returning();
    const supportAgent = supportAgentResult[0];
    if (!supportAgent) {
      throw new Error("Failed to create support agent");
    }

    // Add support_agent permission for demo company
    await db.insert(schema.companyPermissions).values({
      companyId: demoCompany.id,
      userId: supportAgent.id,
      role: "chatapp.support_agent",
    });
    console.log(`   ✓ Created user: ${supportAgent.email} (support agent)\n`);

    // 8. Create a demo AI agent
    console.log("🤖 Creating demo AI agent...");
    const supportPackage = packages.find((p) => p.slug === "customer-support");
    if (!supportPackage) {
      throw new Error("Customer support package not found");
    }
    const agentResult = await db
      .insert(schema.agents)
      .values({
        companyId: demoCompany.id,
        packageId: supportPackage.id,
        name: "Support Bot",
        description: "Demo customer support agent",
        type: "support",
        status: "active",
        systemPrompt: supportPackage.defaultSystemPrompt,
        modelId: supportPackage.defaultModelId,
        temperature: supportPackage.defaultTemperature,
        behavior: supportPackage.defaultBehavior,
        escalationEnabled: true,
      })
      .returning();
    const agent = agentResult[0];
    if (!agent) {
      throw new Error("Failed to create demo agent");
    }
    console.log(`   ✓ Created agent: ${agent.name}\n`);

    console.log("✅ Seed completed successfully!\n");
    console.log("Demo Credentials:");
    console.log(`  Master Admin: ${adminEmail}${adminPassword ? " (password set from ADMIN_PASSWORD)" : ""}`);
    console.log("  Company Admin: admin@demo.com");
    console.log("  Support Agent: agent@demo.com");
    console.log("\n(Note: Company admin and support agent have no passwords set. Use OAuth or set passwords manually.)\n");
  } catch (error) {
    console.error("❌ Seed failed:", error);
    throw error;
  } finally {
    await client.end();
  }
}

// Run seed
seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
