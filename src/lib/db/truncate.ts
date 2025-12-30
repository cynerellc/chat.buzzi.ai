import postgres from "postgres";

async function truncateAll() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  const sql = postgres(connectionString, { max: 1 });

  console.log("🗑️  Truncating all tables...\n");

  const tables = [
    "messages",
    "conversations",
    "escalations",
    "daily_analytics",
    "hourly_analytics",
    "platform_analytics",
    "audit_logs",
    "invitations",
    "webhooks",
    "integrations",
    "widget_configs",
    "faq_items",
    "knowledge_sources",
    "chatbot_versions",
    "chatbots",
    "chatbot_packages",
    "company_subscriptions",
    "company_permissions",
    "sessions",
    "accounts",
    "users",
    "companies",
    "subscription_plans",
  ];

  try {
    for (const table of tables) {
      await sql.unsafe(`TRUNCATE chatapp.${table} CASCADE`);
      console.log(`   ✓ Truncated ${table}`);
    }
    console.log("\n✅ All tables truncated successfully!\n");
  } catch (error) {
    console.error("❌ Truncate failed:", error);
    throw error;
  } finally {
    await sql.end();
  }
}

truncateAll().catch((error) => {
  console.error(error);
  process.exit(1);
});
