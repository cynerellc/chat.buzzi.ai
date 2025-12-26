import postgres from "postgres";

async function migrate() {
  const sql = postgres(process.env.DATABASE_URL!);

  try {
    console.log("Starting migration to JSONB variables...\n");

    // Step 1: Add variables JSONB column to agent_packages if it doesn't exist
    console.log("1. Adding 'variables' column to agent_packages...");
    await sql.unsafe(`
      DO $$ BEGIN
        ALTER TABLE "chatapp"."agent_packages"
        ADD COLUMN IF NOT EXISTS "variables" jsonb DEFAULT '[]'::jsonb NOT NULL;
      EXCEPTION
        WHEN duplicate_column THEN null;
      END $$;
    `);
    console.log("   Done.");

    // Step 2: Add variable_values JSONB column to agents if it doesn't exist
    console.log("2. Adding 'variable_values' column to agents...");
    await sql.unsafe(`
      DO $$ BEGIN
        ALTER TABLE "chatapp"."agents"
        ADD COLUMN IF NOT EXISTS "variable_values" jsonb DEFAULT '{}'::jsonb NOT NULL;
      EXCEPTION
        WHEN duplicate_column THEN null;
      END $$;
    `);
    console.log("   Done.");

    // Step 3: Migrate existing data from package_variables to agent_packages.variables
    console.log("3. Migrating existing package_variables data...");
    const existingPackageVars = await sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'chatapp' AND table_name = 'package_variables';
    `;

    if (existingPackageVars.length > 0) {
      // Get all packages with their variables
      const packages = await sql`
        SELECT DISTINCT package_id FROM chatapp.package_variables;
      `;

      for (const pkg of packages) {
        const variables = await sql`
          SELECT
            name,
            display_name as "displayName",
            description,
            variable_type as "variableType",
            data_type as "dataType",
            default_value as "defaultValue",
            required,
            validation_pattern as "validationPattern",
            placeholder
          FROM chatapp.package_variables
          WHERE package_id = ${pkg.package_id}
          ORDER BY sort_order;
        `;

        // Update the package with the variables array
        await sql`
          UPDATE chatapp.agent_packages
          SET variables = ${JSON.stringify(variables)}::jsonb
          WHERE id = ${pkg.package_id};
        `;
      }
      console.log(`   Migrated variables for ${packages.length} packages.`);
    } else {
      console.log("   No existing package_variables table found, skipping data migration.");
    }

    // Step 4: Migrate existing agent_variable_values to agents.variable_values
    console.log("4. Migrating existing agent_variable_values data...");
    const existingAgentVars = await sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'chatapp' AND table_name = 'agent_variable_values';
    `;

    if (existingAgentVars.length > 0) {
      // Get all agents with their variable values
      const agents = await sql`
        SELECT DISTINCT agent_id FROM chatapp.agent_variable_values;
      `;

      for (const agent of agents) {
        const values = await sql`
          SELECT
            pv.name,
            avv.value
          FROM chatapp.agent_variable_values avv
          JOIN chatapp.package_variables pv ON avv.package_variable_id = pv.id
          WHERE avv.agent_id = ${agent.agent_id};
        `;

        // Convert to key-value object
        const variableValues: Record<string, string> = {};
        for (const v of values) {
          variableValues[v.name] = v.value || "";
        }

        // Update the agent with the variable values
        await sql`
          UPDATE chatapp.agents
          SET variable_values = ${JSON.stringify(variableValues)}::jsonb
          WHERE id = ${agent.agent_id};
        `;
      }
      console.log(`   Migrated variable values for ${agents.length} agents.`);
    } else {
      console.log("   No existing agent_variable_values table found, skipping data migration.");
    }

    // Step 5: Drop the old tables
    console.log("5. Dropping old tables...");
    await sql.unsafe(`
      DROP TABLE IF EXISTS "chatapp"."agent_variable_values" CASCADE;
    `);
    await sql.unsafe(`
      DROP TABLE IF EXISTS "chatapp"."package_variables" CASCADE;
    `);
    console.log("   Done.");

    // Step 6: Drop unused enums (optional cleanup)
    console.log("6. Dropping unused enums...");
    await sql.unsafe(`
      DROP TYPE IF EXISTS "public"."variable_type" CASCADE;
    `);
    await sql.unsafe(`
      DROP TYPE IF EXISTS "public"."variable_data_type" CASCADE;
    `);
    console.log("   Done.");

    console.log("\nMigration completed successfully!");
    console.log("- agent_packages.variables: JSONB array of variable definitions");
    console.log("- agents.variable_values: JSONB object of variable name -> value");

  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

migrate();
