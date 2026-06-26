const mongoose = require('mongoose');

const uri = "mongodb+srv://dhanushchakravarthy18_db_user:Dhanush123@pmt.kiqc6ip.mongodb.net/nexus-zoom?retryWrites=true&w=majority&appName=PMT";

const OLD_IDS = ['antigravity-hq', 'antigraviity-hq', 'antigraviity.hq'];
const NEW_ID = 'forge-india-connect';

async function run() {
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  // All collections that have a workspaceId field
  const collections = ['users', 'tenants', 'mails', 'meetings', 'tasks', 'channels', 'messages', 'docs', 'threads'];

  for (const collName of collections) {
    try {
      const coll = db.collection(collName);
      const result = await coll.updateMany(
        { workspaceId: { $in: OLD_IDS } },
        { $set: { workspaceId: NEW_ID } }
      );
      console.log(`[${collName}] Matched: ${result.matchedCount}, Modified: ${result.modifiedCount}`);
    } catch (err) {
      console.log(`[${collName}] Skipped (may not exist): ${err.message}`);
    }
  }

  console.log('\nDone! All workspace IDs updated to:', NEW_ID);
  mongoose.disconnect();
}

run().catch(console.error);
