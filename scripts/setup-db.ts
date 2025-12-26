import postgres from "postgres";

async function setupDatabase() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  const sql = postgres(connectionString, { max: 1 });

  console.log("🔧 Setting up database...\n");

  try {
    // 1. Create the chatapp schema
    console.log("📁 Creating chatapp schema...");
    await sql`CREATE SCHEMA IF NOT EXISTS chatapp`;
    console.log("   ✓ Schema created\n");

    // 2. Create enum types (if they don't exist)
    console.log("📋 Creating enum types...");

    const enums = [
      { name: "user_role", values: ["chatapp.master_admin", "chatapp.company_admin", "chatapp.support_agent"] },
      { name: "user_status", values: ["active", "inactive", "pending", "suspended"] },
      { name: "agent_status", values: ["draft", "active", "paused", "archived"] },
      { name: "agent_type", values: ["support", "sales", "general", "custom"] },
      { name: "conversation_status", values: ["active", "waiting_human", "with_human", "resolved", "abandoned"] },
      { name: "message_role", values: ["user", "assistant", "system", "human_agent", "tool"] },
      { name: "message_type", values: ["text", "image", "file", "audio", "system_event"] },
      { name: "channel_type", values: ["web", "whatsapp", "telegram", "messenger", "instagram", "slack", "teams", "custom"] },
      { name: "subscription_status", values: ["trial", "active", "past_due", "grace_period", "expired", "cancelled"] },
      { name: "billing_cycle", values: ["monthly", "quarterly", "semi_annual", "annual"] },
      { name: "knowledge_source_type", values: ["file", "url", "text"] },
      { name: "knowledge_source_status", values: ["pending", "processing", "indexed", "failed"] },
      { name: "integration_type", values: ["slack", "zapier", "salesforce", "hubspot", "webhook", "custom"] },
      { name: "integration_status", values: ["active", "inactive", "error"] },
      { name: "invitation_status", values: ["pending", "accepted", "expired", "revoked"] },
      { name: "escalation_status", values: ["pending", "assigned", "in_progress", "resolved", "returned_to_ai", "abandoned"] },
      { name: "escalation_priority", values: ["low", "medium", "high", "urgent"] },
      { name: "support_agent_status", values: ["online", "busy", "away", "offline"] },
      { name: "resolution_type", values: ["ai", "human", "abandoned", "escalated"] },
    ];

    for (const enumDef of enums) {
      try {
        await sql.unsafe(`CREATE TYPE ${enumDef.name} AS ENUM (${enumDef.values.map(v => `'${v}'`).join(", ")})`);
        console.log(`   ✓ Created enum: ${enumDef.name}`);
      } catch (e: any) {
        if (e.code === "42710") {
          console.log(`   - Enum ${enumDef.name} already exists`);
        } else {
          throw e;
        }
      }
    }
    console.log("");

    // 3. Create companies table
    console.log("🏢 Creating companies table...");
    await sql`
      CREATE TABLE IF NOT EXISTS chatapp.companies (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(100) NOT NULL UNIQUE,
        description TEXT,
        logo_url VARCHAR(500),
        primary_color VARCHAR(20),
        secondary_color VARCHAR(20),
        timezone VARCHAR(100) DEFAULT 'UTC',
        locale VARCHAR(10) DEFAULT 'en',
        status VARCHAR(50) DEFAULT 'active',
        settings JSONB DEFAULT '{}',
        billing_email VARCHAR(255),
        billing_address JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
        deleted_at TIMESTAMP
      )
    `;
    console.log("   ✓ Created companies table\n");

    // 4. Create users table
    console.log("👤 Creating users table...");
    await sql`
      CREATE TABLE IF NOT EXISTS chatapp.users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) NOT NULL UNIQUE,
        email_verified TIMESTAMP,
        name VARCHAR(255),
        image VARCHAR(500),
        hashed_password VARCHAR(255),
        company_id UUID REFERENCES chatapp.companies(id),
        role user_role NOT NULL DEFAULT 'chatapp.support_agent',
        status user_status NOT NULL DEFAULT 'active',
        phone VARCHAR(20),
        avatar_url VARCHAR(500),
        permissions JSONB DEFAULT '{}',
        settings JSONB DEFAULT '{}',
        is_active BOOLEAN DEFAULT true NOT NULL,
        last_login_at TIMESTAMP,
        ip_allowlist JSONB DEFAULT '[]',
        access_expires_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
        deleted_at TIMESTAMP
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS users_company_idx ON chatapp.users(company_id)`;
    await sql`CREATE INDEX IF NOT EXISTS users_email_idx ON chatapp.users(email)`;
    await sql`CREATE INDEX IF NOT EXISTS users_role_idx ON chatapp.users(role)`;
    console.log("   ✓ Created users table\n");

    // 5. Create accounts table (for Auth.js)
    console.log("🔑 Creating accounts table...");
    await sql`
      CREATE TABLE IF NOT EXISTS chatapp.accounts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES chatapp.users(id) ON DELETE CASCADE,
        type VARCHAR(255) NOT NULL,
        provider VARCHAR(255) NOT NULL,
        provider_account_id VARCHAR(255) NOT NULL,
        refresh_token TEXT,
        access_token TEXT,
        expires_at INTEGER,
        token_type VARCHAR(255),
        scope VARCHAR(255),
        id_token TEXT,
        session_state VARCHAR(255)
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS accounts_user_idx ON chatapp.accounts(user_id)`;
    console.log("   ✓ Created accounts table\n");

    // 6. Create sessions table (for Auth.js)
    console.log("📋 Creating sessions table...");
    await sql`
      CREATE TABLE IF NOT EXISTS chatapp.sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_token VARCHAR(255) NOT NULL UNIQUE,
        user_id UUID NOT NULL REFERENCES chatapp.users(id) ON DELETE CASCADE,
        expires TIMESTAMP NOT NULL
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS sessions_user_idx ON chatapp.sessions(user_id)`;
    console.log("   ✓ Created sessions table\n");

    // 7. Create verification_tokens table (for Auth.js)
    console.log("🔐 Creating verification_tokens table...");
    await sql`
      CREATE TABLE IF NOT EXISTS chatapp.verification_tokens (
        identifier VARCHAR(255) NOT NULL,
        token VARCHAR(255) NOT NULL UNIQUE,
        expires TIMESTAMP NOT NULL,
        PRIMARY KEY (identifier, token)
      )
    `;
    console.log("   ✓ Created verification_tokens table\n");

    // 8. Create subscription_plans table
    console.log("💳 Creating subscription_plans table...");
    await sql`
      CREATE TABLE IF NOT EXISTS chatapp.subscription_plans (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL,
        slug VARCHAR(50) NOT NULL UNIQUE,
        description TEXT,
        base_price DECIMAL(10,2) NOT NULL DEFAULT 0,
        max_agents INTEGER DEFAULT 1,
        max_conversations_per_month INTEGER DEFAULT 100,
        max_knowledge_sources INTEGER DEFAULT 10,
        max_storage_gb INTEGER DEFAULT 1,
        max_team_members INTEGER DEFAULT 1,
        features JSONB DEFAULT '[]',
        custom_branding BOOLEAN DEFAULT false,
        priority_support BOOLEAN DEFAULT false,
        api_access BOOLEAN DEFAULT false,
        advanced_analytics BOOLEAN DEFAULT false,
        custom_integrations BOOLEAN DEFAULT false,
        trial_days INTEGER DEFAULT 14,
        is_active BOOLEAN DEFAULT true,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `;
    console.log("   ✓ Created subscription_plans table\n");

    // 9. Create agent_packages table
    console.log("📦 Creating agent_packages table...");
    await sql`
      CREATE TABLE IF NOT EXISTS chatapp.agent_packages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL,
        slug VARCHAR(50) NOT NULL UNIQUE,
        description TEXT,
        category VARCHAR(100),
        icon VARCHAR(100),
        default_system_prompt TEXT,
        default_model_id VARCHAR(100) DEFAULT 'gpt-4o-mini',
        default_temperature INTEGER DEFAULT 70,
        default_behavior JSONB DEFAULT '{}',
        features JSONB DEFAULT '[]',
        is_active BOOLEAN DEFAULT true,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `;
    console.log("   ✓ Created agent_packages table\n");

    // 10. Create agents table
    console.log("🤖 Creating agents table...");
    await sql`
      CREATE TABLE IF NOT EXISTS chatapp.agents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id UUID NOT NULL REFERENCES chatapp.companies(id),
        package_id UUID REFERENCES chatapp.agent_packages(id),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        type agent_type NOT NULL DEFAULT 'support',
        status agent_status NOT NULL DEFAULT 'draft',
        avatar_url VARCHAR(500),
        system_prompt TEXT NOT NULL,
        model_id VARCHAR(100) NOT NULL DEFAULT 'gpt-4o-mini',
        temperature INTEGER DEFAULT 70,
        behavior JSONB DEFAULT '{}',
        welcome_message TEXT,
        fallback_message TEXT,
        escalation_enabled BOOLEAN DEFAULT true,
        business_hours JSONB DEFAULT '{}',
        languages JSONB DEFAULT '["en"]',
        total_conversations INTEGER DEFAULT 0,
        satisfaction_score DECIMAL(3,2),
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
        deleted_at TIMESTAMP
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS agents_company_idx ON chatapp.agents(company_id)`;
    console.log("   ✓ Created agents table\n");

    console.log("✅ Database setup completed!\n");
  } catch (error) {
    console.error("❌ Database setup failed:", error);
    throw error;
  } finally {
    await sql.end();
  }
}

setupDatabase().catch((error) => {
  console.error(error);
  process.exit(1);
});
