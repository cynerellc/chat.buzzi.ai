const postgres = require('postgres');
const fs = require('fs');
const path = require('path');

// Read DATABASE_URL from .env file
const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const dbUrlMatch = envContent.match(/^DATABASE_URL=(.+)$/m);
if (!dbUrlMatch) {
  console.error('DATABASE_URL not found in .env');
  process.exit(1);
}

const sql = postgres(dbUrlMatch[1], { ssl: 'require' });

async function runSQL() {
  try {
    console.log('Connected to database');

    // Grant schema usage to anon role
    console.log('\n1. Granting USAGE on chatapp schema to anon...');
    await sql`GRANT USAGE ON SCHEMA chatapp TO anon`;
    console.log('   Done');

    // Grant SELECT on messages table
    console.log('\n2. Granting SELECT on chatapp.messages to anon...');
    await sql`GRANT SELECT ON chatapp.messages TO anon`;
    console.log('   Done');

    // Grant SELECT on conversations table
    console.log('\n3. Granting SELECT on chatapp.conversations to anon...');
    await sql`GRANT SELECT ON chatapp.conversations TO anon`;
    console.log('   Done');

    // Check publication tables
    console.log('\n4. Checking realtime publication tables...');
    const pubResult = await sql`SELECT schemaname, tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime'`;
    console.log('   Tables in supabase_realtime publication:');
    pubResult.forEach(row => console.log('   -', row.schemaname + '.' + row.tablename));

    // Check if chatapp tables are in publication
    const hasChatappMessages = pubResult.some(r => r.schemaname === 'chatapp' && r.tablename === 'messages');
    const hasChatappConversations = pubResult.some(r => r.schemaname === 'chatapp' && r.tablename === 'conversations');

    if (!hasChatappMessages) {
      console.log('\n5. Adding chatapp.messages to publication...');
      await sql`ALTER PUBLICATION supabase_realtime ADD TABLE chatapp.messages`;
      console.log('   Done');
    } else {
      console.log('\n5. chatapp.messages already in publication');
    }

    if (!hasChatappConversations) {
      console.log('\n6. Adding chatapp.conversations to publication...');
      await sql`ALTER PUBLICATION supabase_realtime ADD TABLE chatapp.conversations`;
      console.log('   Done');
    } else {
      console.log('\n6. chatapp.conversations already in publication');
    }

    // Check REPLICA IDENTITY
    console.log('\n7. Checking REPLICA IDENTITY...');
    const replicaResult = await sql`SELECT relname, relreplident FROM pg_class WHERE relname IN ('messages', 'conversations') AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'chatapp')`;
    replicaResult.forEach(row => {
      const identity = row.relreplident === 'f' ? 'FULL' : row.relreplident === 'd' ? 'DEFAULT' : row.relreplident;
      console.log('   -', row.relname + ':', identity);
    });

    // Set REPLICA IDENTITY FULL if not already
    for (const row of replicaResult) {
      if (row.relreplident !== 'f') {
        console.log('\n   Setting REPLICA IDENTITY FULL for', row.relname);
        await sql.unsafe('ALTER TABLE chatapp.' + row.relname + ' REPLICA IDENTITY FULL');
      }
    }

    console.log('\n=== All SQL commands completed successfully ===');

  } finally {
    await sql.end();
  }
}

runSQL().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
