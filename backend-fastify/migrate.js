const mongoose = require('mongoose');

const uri = "mongodb+srv://dhanushchakravarthy18_db_user:Dhanush123@pmt.kiqc6ip.mongodb.net/nexus-zoom?retryWrites=true&w=majority&appName=PMT";

async function run() {
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  const users = db.collection('users');
  
  const result = await users.updateOne(
    { email: 'dhanush@fic.com' },
    { $set: { workspaceId: 'forge-india-connect', role: 'Member' } }
  );
  
  console.log("Matched:", result.matchedCount);
  console.log("Modified:", result.modifiedCount);
  
  mongoose.disconnect();
}

run().catch(console.error);
