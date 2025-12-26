/**
 * E2E Test Seed Script
 *
 * Creates test data for E2E tests including:
 * - Test company
 * - Company admin with password
 * - Support agent with password
 * - Test agent with knowledge base
 */

import postgres from "postgres";
import bcrypt from "bcryptjs";

const E2E_CONFIG = {
  company: {
    name: "E2E Test Company",
    slug: "e2e-test",
  },
  companyAdmin: {
    email: process.env.E2E_COMPANY_ADMIN_EMAIL || "admin@e2etest.com",
    password: process.env.E2E_COMPANY_ADMIN_PASSWORD || "E2eTest123!",
    name: "E2E Company Admin",
  },
  supportAgent: {
    email: process.env.E2E_SUPPORT_AGENT_EMAIL || "support@e2etest.com",
    password: process.env.E2E_SUPPORT_AGENT_PASSWORD || "E2eTest123!",
    name: "E2E Support Agent",
  },
  agent: {
    name: "Software Support Bot",
    description: "AI assistant for software company enquiries",
  },
  knowledge: {
    name: "Product Documentation",
    content: `# Product FAQ

## What is our product?
Our product is an enterprise software solution that helps businesses automate their workflows.

## How do I install the software?
You can download the installer from our website and follow the installation wizard.

## What are the system requirements?
- Windows 10 or higher, macOS 12+, or Ubuntu 20.04+
- 8GB RAM minimum
- 10GB disk space

## How do I contact support?
You can reach our support team at support@example.com or through this chat.

## What is your refund policy?
We offer a 30-day money-back guarantee for all subscriptions.

## Pricing
Our pricing starts at $49/month for the Starter plan.
`,
  },
};

async function seedE2E() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  const sql = postgres(connectionString, { max: 1 });

  console.log("🧪 Starting E2E seed...\n");

  try {
    // 1. Clean up existing E2E test data (respect foreign key order)
    console.log("🧹 Cleaning up existing E2E test data...");
    // First find the existing E2E company
    const existingCompanies = await sql`SELECT id FROM chatapp.companies WHERE slug = ${E2E_CONFIG.company.slug}`;
    if (existingCompanies.length > 0) {
      const companyId = existingCompanies[0]!.id;
      // Delete agents first (foreign key constraint)
      await sql`DELETE FROM chatapp.agents WHERE company_id = ${companyId}`;
      // Delete users for this company
      await sql`DELETE FROM chatapp.users WHERE company_id = ${companyId}`;
      // Now delete the company
      await sql`DELETE FROM chatapp.companies WHERE id = ${companyId}`;
    }
    // Also delete users by email in case they exist without a company
    await sql`DELETE FROM chatapp.users WHERE email IN (${E2E_CONFIG.companyAdmin.email}, ${E2E_CONFIG.supportAgent.email})`;
    console.log("   ✓ Cleaned up existing data\n");

    // 2. Get or create subscription plan
    console.log("📦 Getting subscription plan...");
    const plans = await sql`SELECT id, slug FROM chatapp.subscription_plans WHERE slug = 'professional' LIMIT 1`;
    let planId: string;

    if (plans.length === 0) {
      console.log("   Creating professional plan...");
      const newPlan = await sql`
        INSERT INTO chatapp.subscription_plans (
          name, slug, description, base_price, max_agents, max_conversations_per_month,
          max_knowledge_sources, max_storage_gb, max_team_members, features,
          custom_branding, priority_support, api_access, advanced_analytics, custom_integrations,
          trial_days, sort_order
        ) VALUES (
          'Professional', 'professional', 'For growing teams', '149.00', 10, 5000, 50, 25, 10,
          '["Multiple AI agents", "Advanced knowledge base", "Priority support"]'::jsonb,
          true, true, true, true, false, 14, 2
        ) RETURNING id
      `;
      planId = newPlan[0]!.id;
    } else {
      planId = plans[0]!.id;
    }
    console.log(`   ✓ Using plan: ${planId}\n`);

    // 3. Create test company
    console.log("🏢 Creating E2E test company...");
    const companies = await sql`
      INSERT INTO chatapp.companies (
        name, slug, description, primary_color, secondary_color,
        timezone, locale, status
      ) VALUES (
        ${E2E_CONFIG.company.name},
        ${E2E_CONFIG.company.slug},
        'Test company for E2E tests',
        '#6437F3',
        '#2b3dd8',
        'UTC',
        'en',
        'active'
      ) RETURNING id, name, slug
    `;
    const company = companies[0]!;
    console.log(`   ✓ Created company: ${company.name} (${company.slug})\n`);

    // 4. Create company subscription (skip if table doesn't exist)
    console.log("📋 Creating company subscription...");
    try {
      const now = new Date();
      const periodEnd = new Date();
      periodEnd.setMonth(periodEnd.getMonth() + 1);

      await sql`
        INSERT INTO chatapp.company_subscriptions (
          company_id, plan_id, billing_cycle, status, current_price,
          current_period_start, current_period_end
        ) VALUES (
          ${company.id}, ${planId}, 'monthly', 'active', '149.00',
          ${now}, ${periodEnd}
        )
      `;
      console.log("   ✓ Created subscription\n");
    } catch (subError) {
      console.log("   ⚠ Skipped subscription (table may not exist)\n");
    }

    // 5. Create company admin
    console.log("👤 Creating company admin...");
    const adminPasswordHash = await bcrypt.hash(E2E_CONFIG.companyAdmin.password, 12);
    const admins = await sql`
      INSERT INTO chatapp.users (
        email, email_verified, name, hashed_password, company_id,
        role, status, is_active
      ) VALUES (
        ${E2E_CONFIG.companyAdmin.email},
        NOW(),
        ${E2E_CONFIG.companyAdmin.name},
        ${adminPasswordHash},
        ${company.id},
        'chatapp.company_admin',
        'active',
        true
      ) RETURNING id, email
    `;
    console.log(`   ✓ Created: ${admins[0]!.email}\n`);

    // 6. Create support agent
    console.log("👤 Creating support agent...");
    const agentPasswordHash = await bcrypt.hash(E2E_CONFIG.supportAgent.password, 12);
    const agents = await sql`
      INSERT INTO chatapp.users (
        email, email_verified, name, hashed_password, company_id,
        role, status, is_active
      ) VALUES (
        ${E2E_CONFIG.supportAgent.email},
        NOW(),
        ${E2E_CONFIG.supportAgent.name},
        ${agentPasswordHash},
        ${company.id},
        'chatapp.support_agent',
        'active',
        true
      ) RETURNING id, email
    `;
    console.log(`   ✓ Created: ${agents[0]!.email}\n`);

    // 7. Create AI agent
    console.log("🤖 Creating AI agent...");
    const aiAgents = await sql`
      INSERT INTO chatapp.agents (
        company_id, name, description, type, status,
        system_prompt, model_id, temperature
      ) VALUES (
        ${company.id},
        ${E2E_CONFIG.agent.name},
        ${E2E_CONFIG.agent.description},
        'support',
        'active',
        'You are a helpful customer support assistant for a software company. Answer questions based on the knowledge base. If you cannot answer, offer to connect the user with a human agent.',
        'gpt-4o-mini',
        70
      ) RETURNING id, name
    `;
    const aiAgent = aiAgents[0]!;
    console.log(`   ✓ Created agent: ${aiAgent.name}\n`);

    // 8. Create knowledge source (optional - skip if table doesn't exist)
    console.log("📚 Creating knowledge source...");
    try {
      const sources = await sql`
        INSERT INTO chatapp.knowledge_sources (
          company_id, name, description, type, status,
          source_config, chunk_count, token_count
        ) VALUES (
          ${company.id},
          ${E2E_CONFIG.knowledge.name},
          'Product documentation for the software',
          'text',
          'indexed',
          ${JSON.stringify({ content: E2E_CONFIG.knowledge.content })},
          5,
          500
        ) RETURNING id, name
      `;
      const source = sources[0]!;
      console.log(`   ✓ Created knowledge source: ${source.name}\n`);

      // 9. Create knowledge chunks
      console.log("📝 Creating knowledge chunks...");
      const chunks = E2E_CONFIG.knowledge.content.split("\n\n").filter((c) => c.trim());
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i]!;
        await sql`
          INSERT INTO chatapp.knowledge_chunks (
            source_id, content, chunk_index, token_count, metadata
          ) VALUES (
            ${source.id},
            ${chunk},
            ${i},
            ${Math.ceil(chunk.length / 4)},
            '{}'
          )
        `;
      }
      console.log(`   ✓ Created ${chunks.length} knowledge chunks\n`);

      // 10. Link knowledge source to agent
      console.log("🔗 Linking knowledge source to agent...");
      await sql`
        UPDATE chatapp.agents
        SET knowledge_source_ids = ARRAY[${source.id}::uuid]
        WHERE id = ${aiAgent.id}
      `;
      console.log("   ✓ Linked knowledge source to agent\n");
    } catch (knowledgeError) {
      console.log("   ⚠ Skipped knowledge source (table may not exist)\n");
    }

    console.log("✅ E2E seed completed successfully!\n");
    console.log("═══════════════════════════════════════════════════");
    console.log("E2E Test Credentials:");
    console.log("═══════════════════════════════════════════════════");
    console.log(`Company Admin:`);
    console.log(`  Email: ${E2E_CONFIG.companyAdmin.email}`);
    console.log(`  Password: ${E2E_CONFIG.companyAdmin.password}`);
    console.log("");
    console.log(`Support Agent:`);
    console.log(`  Email: ${E2E_CONFIG.supportAgent.email}`);
    console.log(`  Password: ${E2E_CONFIG.supportAgent.password}`);
    console.log("═══════════════════════════════════════════════════\n");
  } catch (error) {
    console.error("❌ E2E seed failed:", error);
    throw error;
  } finally {
    await sql.end();
  }
}

seedE2E().catch((error) => {
  console.error(error);
  process.exit(1);
});
