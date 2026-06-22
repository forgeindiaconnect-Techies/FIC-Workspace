const fs = require('fs');

const models = `
// ─── THREAD POST SCHEMA ───
const ThreadPostSchema = new mongoose.Schema({
  workspaceId: { type: String, required: true },
  authorEmail: { type: String, required: true },
  authorName: { type: String, required: true },
  content: { type: String, required: true },
  likes: [{ type: String }], // Array of emails who liked it
  createdAt: { type: Date, default: Date.now }
});
export const ThreadPost = mongoose.models.ThreadPost || mongoose.model('ThreadPost', ThreadPostSchema);

// ─── THREAD COMMENT SCHEMA ───
const ThreadCommentSchema = new mongoose.Schema({
  postId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'ThreadPost' },
  authorEmail: { type: String, required: true },
  authorName: { type: String, required: true },
  content: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});
export const ThreadComment = mongoose.models.ThreadComment || mongoose.model('ThreadComment', ThreadCommentSchema);
`;

const dbContent = fs.readFileSync('d:/New folder/microservices/shared/database.js', 'utf8');

// Also need to export them in the imports for server.js later if needed, but in `server.js` we can just import them explicitly.
if (!dbContent.includes('ThreadPostSchema')) {
  fs.appendFileSync('d:/New folder/microservices/shared/database.js', models);
  console.log('Appended schemas to database.js');
} else {
  console.log('Schemas already exist');
}
