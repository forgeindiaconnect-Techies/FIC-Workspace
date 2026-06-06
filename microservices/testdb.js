import { connectMongo, User, Mail } from './shared/database.js';
connectMongo().then(async () => {
  const mails = await Mail.find({ subject: /Meeting Summary/ }).sort({ sentAt: -1 }).limit(10);
  console.log(JSON.stringify(mails.map(m => ({ ownerEmail: m.ownerEmail, subject: m.subject, sentAt: m.sentAt })), null, 2));
  process.exit(0);
});
