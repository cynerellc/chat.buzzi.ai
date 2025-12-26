import postgres from "postgres";

async function verify() {
  const sql = postgres(process.env.DATABASE_URL!);

  try {
    const tables = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'chatapp'
      AND table_name IN ('package_variables', 'agent_variable_values');
    `;
    console.log("Tables created:", tables.map((t) => t.table_name).join(", "));

    const pkgVarCols = await sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'chatapp'
      AND table_name = 'package_variables'
      ORDER BY ordinal_position;
    `;
    console.log("\npackage_variables columns:");
    pkgVarCols.forEach((c) => console.log("  -", c.column_name, "("+c.data_type+")"));

    const agentVarCols = await sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'chatapp'
      AND table_name = 'agent_variable_values'
      ORDER BY ordinal_position;
    `;
    console.log("\nagent_variable_values columns:");
    agentVarCols.forEach((c) => console.log("  -", c.column_name, "("+c.data_type+")"));
  } catch (error) {
    console.error("Verification failed:", error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

verify();
