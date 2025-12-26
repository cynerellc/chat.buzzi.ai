import bcrypt from "bcryptjs";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import postgres from "postgres";

import * as schema from "../src/lib/db/schema";

async function fixAdminUser() {
  const connectionString = process.env.DATABASE_URL;
  const adminEmail = process.env.ADMIN_USERNAME;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  if (!adminEmail || !adminPassword) {
    throw new Error("ADMIN_USERNAME and ADMIN_PASSWORD environment variables must be set");
  }

  const client = postgres(connectionString, { max: 1 });
  const db = drizzle(client, { schema });

  console.log("🔧 Fixing admin user...\n");

  try {
    // Check if user with this email already exists
    const existingUser = await db.query.users.findFirst({
      where: eq(schema.users.email, adminEmail),
    });

    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    if (existingUser) {
      // Update existing user
      console.log(`📝 Updating existing user: ${adminEmail}`);
      await db
        .update(schema.users)
        .set({
          hashedPassword,
          role: "chatapp.master_admin",
          status: "active",
          isActive: true,
        })
        .where(eq(schema.users.id, existingUser.id));
      console.log(`   ✓ Updated password and role for ${adminEmail}\n`);
    } else {
      // Create new user
      console.log(`📝 Creating new master admin user: ${adminEmail}`);
      await db.insert(schema.users).values({
        email: adminEmail,
        name: "Master Admin",
        role: "chatapp.master_admin",
        status: "active",
        isActive: true,
        hashedPassword,
      });
      console.log(`   ✓ Created master admin user: ${adminEmail}\n`);
    }

    console.log("✅ Admin user fixed successfully!");
    console.log(`   Email: ${adminEmail}`);
    console.log(`   Password: [set from ADMIN_PASSWORD env var]`);
  } catch (error) {
    console.error("❌ Failed to fix admin user:", error);
    throw error;
  } finally {
    await client.end();
  }
}

fixAdminUser().catch((error) => {
  console.error(error);
  process.exit(1);
});
