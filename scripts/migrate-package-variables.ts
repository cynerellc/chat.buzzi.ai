import postgres from "postgres";

async function migrate() {
  const sql = postgres(process.env.DATABASE_URL!);

  try {
    // Create new enums if they don't exist
    await sql.unsafe(`
      DO $$ BEGIN
          CREATE TYPE "public"."variable_data_type" AS ENUM('string', 'number', 'boolean', 'json');
      EXCEPTION
          WHEN duplicate_object THEN null;
      END $$;
    `);

    await sql.unsafe(`
      DO $$ BEGIN
          CREATE TYPE "public"."variable_type" AS ENUM('variable', 'secured_variable');
      EXCEPTION
          WHEN duplicate_object THEN null;
      END $$;
    `);

    // Create package_variables table
    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS "chatapp"."package_variables" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          "package_id" uuid NOT NULL,
          "name" varchar(100) NOT NULL,
          "display_name" varchar(255) NOT NULL,
          "description" text,
          "variable_type" "variable_type" DEFAULT 'variable' NOT NULL,
          "data_type" "variable_data_type" DEFAULT 'string' NOT NULL,
          "default_value" text,
          "required" boolean DEFAULT true NOT NULL,
          "validation_pattern" varchar(500),
          "placeholder" varchar(255),
          "sort_order" integer DEFAULT 0 NOT NULL,
          "created_at" timestamp DEFAULT now() NOT NULL,
          "updated_at" timestamp DEFAULT now() NOT NULL
      );
    `);

    // Create agent_variable_values table
    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS "chatapp"."agent_variable_values" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          "agent_id" uuid NOT NULL,
          "package_variable_id" uuid NOT NULL,
          "value" text,
          "is_encrypted" boolean DEFAULT false NOT NULL,
          "created_at" timestamp DEFAULT now() NOT NULL,
          "updated_at" timestamp DEFAULT now() NOT NULL
      );
    `);

    // Add foreign key constraints if they don't exist
    await sql.unsafe(`
      DO $$ BEGIN
          ALTER TABLE "chatapp"."package_variables"
          ADD CONSTRAINT "package_variables_package_id_agent_packages_id_fk"
          FOREIGN KEY ("package_id") REFERENCES "chatapp"."agent_packages"("id") ON DELETE cascade ON UPDATE no action;
      EXCEPTION
          WHEN duplicate_object THEN null;
      END $$;
    `);

    await sql.unsafe(`
      DO $$ BEGIN
          ALTER TABLE "chatapp"."agent_variable_values"
          ADD CONSTRAINT "agent_variable_values_agent_id_agents_id_fk"
          FOREIGN KEY ("agent_id") REFERENCES "chatapp"."agents"("id") ON DELETE cascade ON UPDATE no action;
      EXCEPTION
          WHEN duplicate_object THEN null;
      END $$;
    `);

    await sql.unsafe(`
      DO $$ BEGIN
          ALTER TABLE "chatapp"."agent_variable_values"
          ADD CONSTRAINT "agent_variable_values_package_variable_id_package_variables_id_fk"
          FOREIGN KEY ("package_variable_id") REFERENCES "chatapp"."package_variables"("id") ON DELETE cascade ON UPDATE no action;
      EXCEPTION
          WHEN duplicate_object THEN null;
      END $$;
    `);

    // Create indexes
    await sql.unsafe(`CREATE INDEX IF NOT EXISTS "package_variables_package_idx" ON "chatapp"."package_variables" USING btree ("package_id");`);
    await sql.unsafe(`CREATE INDEX IF NOT EXISTS "package_variables_name_idx" ON "chatapp"."package_variables" USING btree ("package_id","name");`);
    await sql.unsafe(`CREATE INDEX IF NOT EXISTS "package_variables_type_idx" ON "chatapp"."package_variables" USING btree ("variable_type");`);
    await sql.unsafe(`CREATE INDEX IF NOT EXISTS "agent_variable_values_agent_idx" ON "chatapp"."agent_variable_values" USING btree ("agent_id");`);
    await sql.unsafe(`CREATE INDEX IF NOT EXISTS "agent_variable_values_variable_idx" ON "chatapp"."agent_variable_values" USING btree ("package_variable_id");`);
    await sql.unsafe(`CREATE INDEX IF NOT EXISTS "agent_variable_values_unique_idx" ON "chatapp"."agent_variable_values" USING btree ("agent_id","package_variable_id");`);

    console.log("Migration completed successfully!");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

migrate();
