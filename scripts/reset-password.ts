import postgres from "postgres";
import bcrypt from "bcryptjs";

async function resetPassword() {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });
  const password = "Sec0ndStreet";

  console.log("Setting password:", password);
  const hash = await bcrypt.hash(password, 12);
  console.log("Hash:", hash);

  await sql`UPDATE chatapp.users SET hashed_password = ${hash} WHERE email = 'joseph@buzzi.ai'`;
  console.log("Password updated!");

  // Verify
  const verify = await bcrypt.compare(password, hash);
  console.log("Verify:", verify);

  await sql.end();
}

resetPassword();
