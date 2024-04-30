const express = require('express');
const db = require('./database');
const session = require('express-session');
const xss = require('xss');

const app = express();
const PORT = process.env.PORT || 3000;

// Session configuration
app.use(session({
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));

app.use(express.static('public')); //Static files from the public directory
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const [user] = await db.query('SELECT * FROM users WHERE username = ? AND password = ?', [username, password]);
        if (user.length > 0) {
            req.session.userId = user[0].id;  // Store user ID in session
            req.session.username = user[0].username;  // Store username in session
            res.send('Logged in successfully');
        } else {
            res.status(401).send('Invalid username or password');
        }
    } catch (error) {
        console.log(error);
        res.status(500).send('Database query failed');
    }
});

// Middleware to check if user is authenticated
function isAuthenticated(req, res, next) {
    if (req.session.userId) {
        next();
    } else {
        res.status(401).send('Unauthorized');
    }
}

// Route to get all posts
app.get('/posts', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT posts.id, posts.title, posts.content, users.username FROM posts JOIN users ON posts.user_id = users.id');
        res.json(rows);
    } catch (error) {
        console.log(error);
        res.status(500).send('Error retrieving posts from database');
    }
});

// Route to create a new post
app.post('/posts', isAuthenticated, async (req, res) => {
    const { title, content } = req.body;
    const userId = req.session.userId; // Retrieve user ID from session

    if (!userId) {
        return res.status(403).send('Unauthorized');
    }

    try {
        const result = await db.query('INSERT INTO posts (user_id, title, content) VALUES (?, ?, ?)', [userId, title, content]);
        res.status(201).send(`Post created with ID: ${result[0].insertId}`);
    } catch (error) {
        console.log(error);
        res.status(500).send('Failed to create post');
    }
});

// Route to get a single post by ID with comments
app.get('/posts/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const [post] = await db.query(`
            SELECT posts.id, posts.title, posts.content, users.username 
            FROM posts 
            JOIN users ON posts.user_id = users.id 
            WHERE posts.id = ?
        `, [id]);

        const [comments] = await db.query(`
            SELECT comments.id, comments.comment, users.username 
            FROM comments 
            JOIN users ON comments.user_id = users.id 
            WHERE comments.post_id = ?
        `, [id]);

        if (post.length) {
            res.json({ post: post[0], comments });
        } else {
            res.status(404).send('Post not found');
        }
    } catch (error) {
        console.log(error);
        res.status(500).send('Error retrieving post from database');
    }
});

// Route to update a post
app.put('/posts/:id', isAuthenticated, async (req, res) => {
    const { id } = req.params;
    const { title, content } = req.body;
    const userId = req.session.userId;

    try {
        // First, verify the user is the owner of the post
        const [post] = await db.query('SELECT user_id FROM posts WHERE id = ?', [id]);
        if (post[0].user_id !== userId) {
            return res.status(403).send('Unauthorized to update this post');
        }

        const result = await db.query('UPDATE posts SET title = ?, content = ? WHERE id = ?', [title, content, id]);
        if (result[0].affectedRows === 0) {
            res.status(404).send('Post not found');
        } else {
            res.send('Post updated successfully');
        }
    } catch (error) {
        console.log(error);
        res.status(500).send('Failed to update post');
    }
});

// Route to delete a post
app.delete('/posts/:id', isAuthenticated, async (req, res) => {
    const { id } = req.params;
    const userId = req.session.userId;

    try {
        // Verify the user is the owner of the post
        const [post] = await db.query('SELECT user_id FROM posts WHERE id = ?', [id]);
        if (post[0].user_id !== userId) {
            return res.status(403).send('Unauthorized to delete this post');
        }

        const result = await db.query('DELETE FROM posts WHERE id = ?', [id]);
        if (result[0].affectedRows === 0) {
            res.status(404).send('Post not found');
        } else {
            res.send('Post deleted successfully');
        }
    } catch (error) {
        console.log(error);
        res.status(500).send('Failed to delete post');
    }
});

// Comment routes
app.post('/posts/:postId/comments', isAuthenticated, async (req, res) => {
    const { postId } = req.params;
    const { comment } = req.body;
    const userId = req.session.userId;  // Retrieve user ID from session

    if (!userId) {
        return res.status(403).json({ message: 'User not authenticated' });
    }

    try {
        const result = await db.query('INSERT INTO comments (post_id, user_id, comment) VALUES (?, ?, ?)', [postId, userId, comment]);
        res.status(201).json({ id: result.insertId, comment });
    } catch (error) {
        console.error('Error posting comment:', error);
        res.status(500).json({ message: 'Failed to post comment' });
    }
});

//allows the user to update a comment
app.put('/comments/:commentId', isAuthenticated, async (req, res) => {
    const { commentId } = req.params;
    const { comment } = req.body;
    try {
        const result = await db.query('UPDATE comments SET comment = ? WHERE id = ?', [comment, commentId]);
        if (result.affectedRows) {
            res.json({ message: 'Comment updated successfully' });
        } else {
            res.status(404).json({ message: 'Comment not found' });
        }
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: 'Error updating comment' });
    }
});

//Allows the user to delte a comment
app.delete('/comments/:commentId', isAuthenticated, async (req, res) => {
    const { commentId } = req.params;
    try {
        const result = await db.query('DELETE FROM comments WHERE id = ?', [commentId]);
        if (result.affectedRows) {
            res.json({ message: 'Comment deleted successfully' });
        } else {
            res.status(404).json({ message: 'Comment not found' });
        }
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: 'Error deleting comment' });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
