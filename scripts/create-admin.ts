import postgres from "postgres";
import bcrypt from "bcryptjs";

async function createAdminUser() {
  const connectionString = process.env.DATABASE_URL;
  const adminEmail = process.env.ADMIN_USERNAME || "joseph@buzzi.ai";
  const adminPassword = process.env.ADMIN_PASSWORD || "Sec0ndStreet";

  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  const sql = postgres(connectionString, { max: 1 });

  console.log("🔍 Checking for existing admin user...\n");

  try {
    // Check if user exists
    const existingUsers = await sql`
      SELECT id, email, role, status FROM chatapp.users WHERE email = ${adminEmail}
    `;

    if (existingUsers.length > 0) {
      const existingUser = existingUsers[0]!;
      console.log(`✅ User ${adminEmail} already exists:`);
      console.log(`   ID: ${existingUser.id}`);
      console.log(`   Role: ${existingUser.role}`);
      console.log(`   Status: ${existingUser.status}`);
      return;
    }

    // Hash the password
    console.log("🔐 Hashing password...");
    const hashedPassword = await bcrypt.hash(adminPassword, 12);

    // Create the admin user
    console.log(`👤 Creating master_admin user: ${adminEmail}...`);
    const result = await sql`
      INSERT INTO chatapp.users (
        email,
        email_verified,
        name,
        hashed_password,
        role,
        status,
        is_active
      ) VALUES (
        ${adminEmail},
        NOW(),
        'Admin',
        ${hashedPassword},
        'chatapp.master_admin',
        'active',
        true
      )
      RETURNING id, email, role, status
    `;

    const newUser = result[0]!;
    console.log(`\n✅ Admin user created successfully!`);
    console.log(`   ID: ${newUser.id}`);
    console.log(`   Email: ${newUser.email}`);
    console.log(`   Role: ${newUser.role}`);
    console.log(`   Status: ${newUser.status}`);
    console.log(`\n🔑 You can now login with:`);
    console.log(`   Email: ${adminEmail}`);
    console.log(`   Password: ${adminPassword}`);
  } catch (error) {
    console.error("❌ Failed to create admin user:", error);
    throw error;
  } finally {
    await sql.end();
  }
}

createAdminUser().catch((error) => {
  console.error(error);
  process.exit(1);
});
