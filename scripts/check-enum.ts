import postgres from 'postgres';

async function main() {
  const sql = postgres(process.env.DATABASE_URL!);
  const result = await sql`SELECT enumlabel FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE typname = 'user_role' ORDER BY enumlabel`;
  console.log('user_role enum values:', result);
  await sql.end();
}

main().catch(console.error);
