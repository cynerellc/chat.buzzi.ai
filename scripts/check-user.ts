import postgres from "postgres";
import bcrypt from "bcryptjs";

async function checkUser() {
  const connectionString = process.env.DATABASE_URL;
  const email = "joseph@buzzi.ai";
  const password = "Sec0ndStreet";

  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  const sql = postgres(connectionString, { max: 1, prepare: false });

  console.log("🔍 Checking user in database...\n");

  try {
    // Check if user exists
    const users = await sql`
      SELECT id, email, name, hashed_password, role, status, is_active
      FROM chatapp.users
      WHERE email = ${email}
    `;

    if (users.length === 0) {
      console.log("❌ User not found in database");
      return;
    }

    const user = users[0]!;
    console.log("✅ User found:");
    console.log(`   ID: ${user.id}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Name: ${user.name}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Status: ${user.status}`);
    console.log(`   Is Active: ${user.is_active}`);
    console.log(`   Has Password: ${!!user.hashed_password}`);

    if (user.hashed_password) {
      console.log(`\n🔐 Verifying password...`);
      const passwordMatch = await bcrypt.compare(password, user.hashed_password);
      console.log(`   Password match: ${passwordMatch ? "✅ YES" : "❌ NO"}`);

      if (!passwordMatch) {
        // Show what bcrypt generated
        const newHash = await bcrypt.hash(password, 12);
        console.log(`\n   Expected hash for "${password}":`);
        console.log(`   ${newHash}`);
        console.log(`\n   Stored hash:`);
        console.log(`   ${user.hashed_password}`);
      }
    }

    // Check conditions for login
    console.log("\n📋 Login conditions:");
    console.log(`   Status is 'active': ${user.status === "active" ? "✅" : "❌"} (${user.status})`);
    console.log(`   Is Active: ${user.is_active ? "✅" : "❌"}`);
    console.log(`   Has Password: ${user.hashed_password ? "✅" : "❌"}`);

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await sql.end();
  }
}

checkUser();
