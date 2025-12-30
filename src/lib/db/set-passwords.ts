import bcrypt from "bcryptjs";
import postgres from "postgres";

async function setPasswords() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  const sql = postgres(connectionString, { max: 1 });
  const hashedPassword = await bcrypt.hash("aaaaaa", 10);

  console.log("Setting passwords...\n");

  try {
    const result = await sql`
      UPDATE chatapp.users
      SET hashed_password = ${hashedPassword}
      WHERE email IN ('joseph@buzzi.ai', 'admin@demo.com', 'agent@demo.com')
      RETURNING email
    `;

    console.log('Passwords set to "aaaaaa" for:');
    result.forEach((r) => console.log("  - " + r.email));
    console.log("\n✅ Done!");
  } catch (error) {
    console.error("❌ Failed:", error);
    throw error;
  } finally {
    await sql.end();
  }
}

setPasswords().catch((error) => {
  console.error(error);
  process.exit(1);
});
