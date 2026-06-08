require('dotenv').config({ path: 'backend-fastify/.env' });
const mongoose = require('mongoose');
const { Meeting } = require('./backend-fastify/dist/models/Meeting');
const { summarizeMeeting } = require('./backend-fastify/dist/services/summarizer');

async function test() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/nexus');
  const meeting = await Meeting.findOne({ status: 'ended' }).sort({ createdAt: -1 });
  if (!meeting) {
    console.log('No ended meetings found.');
    process.exit(0);
  }
  console.log('Testing summary for meeting:', meeting._id);
  // Force reset summarySent
  await Meeting.updateOne({ _id: meeting._id }, { $set: { summarySent: false, aiSummary: null } });
  
  try {
    const html = await summarizeMeeting(meeting._id.toString());
    console.log('Summary result length:', html ? html.length : 'null');
  } catch(e) {
    console.error('Error during summarize:', e);
  }
  process.exit(0);
}
test();
