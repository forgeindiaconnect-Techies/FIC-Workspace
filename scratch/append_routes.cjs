const fs = require('fs');

const file = 'd:/New folder/microservices/chat/server.js';
let c = fs.readFileSync(file, 'utf8');

const routes = `
// ─── THREADS / SOCIAL FEED ───
app.get('/api/threads/:workspaceId', async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const posts = await ThreadPost.find({ workspaceId }).sort({ createdAt: -1 }).lean();
    
    // Fetch comments for these posts
    const postIds = posts.map(p => p._id);
    const comments = await ThreadComment.find({ postId: { $in: postIds } }).sort({ createdAt: 1 }).lean();
    
    // Attach comments to posts
    posts.forEach(post => {
      post.comments = comments.filter(c => c.postId.toString() === post._id.toString());
    });
    
    res.json(posts);
  } catch (err) {
    console.error('Failed to fetch threads:', err);
    res.status(500).json({ error: 'Failed to fetch threads' });
  }
});

app.post('/api/threads/create', async (req, res) => {
  try {
    const { workspaceId, content } = req.body;
    const authorEmail = req.user.email;
    const authorName = req.user.name;
    
    const post = await ThreadPost.create({
      workspaceId,
      authorEmail,
      authorName,
      content,
      likes: []
    });
    
    const postObj = post.toObject();
    postObj.comments = [];
    
    res.status(201).json(postObj);
  } catch (err) {
    console.error('Failed to create thread:', err);
    res.status(500).json({ error: 'Failed to create thread' });
  }
});

app.post('/api/threads/:postId/like', async (req, res) => {
  try {
    const { postId } = req.params;
    const userEmail = req.user.email;
    
    const post = await ThreadPost.findById(postId);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    
    const hasLiked = post.likes.includes(userEmail);
    if (hasLiked) {
      post.likes = post.likes.filter(email => email !== userEmail);
    } else {
      post.likes.push(userEmail);
    }
    
    await post.save();
    res.json({ likes: post.likes });
  } catch (err) {
    console.error('Failed to toggle like:', err);
    res.status(500).json({ error: 'Failed to toggle like' });
  }
});

app.post('/api/threads/:postId/comment', async (req, res) => {
  try {
    const { postId } = req.params;
    const { content } = req.body;
    const authorEmail = req.user.email;
    const authorName = req.user.name;
    
    const comment = await ThreadComment.create({
      postId,
      authorEmail,
      authorName,
      content
    });
    
    res.status(201).json(comment);
  } catch (err) {
    console.error('Failed to post comment:', err);
    res.status(500).json({ error: 'Failed to post comment' });
  }
});

`;

const marker = 'const PORT = 3104;';
if (c.includes(marker) && !c.includes('/api/threads/create')) {
  c = c.replace(marker, routes + marker);
  fs.writeFileSync(file, c);
  console.log('Appended thread routes successfully!');
} else {
  console.log('Marker not found or routes already appended.');
}
