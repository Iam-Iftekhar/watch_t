const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const mysql = require('mysql2/promise');
const WebSocket = require('ws');
const http = require('http');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// Serve the index.html file for the root URL
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// MySQL Database Connection Pool
const dbPool = mysql.createPool({
    host: 'localhost',
    user: 'root', // Replace with your MySQL username
    password: 'MySQL er password change korlam', // Replace with your MySQL password
    database: 'watch_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// --- API Endpoints ---

// User Authentication and Profile Management
app.post('/api/auth/signin', async (req, res) => {
    const { userId, name, email, profilePic } = req.body;
    if (!userId || !email) {
        return res.status(400).json({ error: 'User ID and email are required.' });
    }
    try {
        const [rows] = await dbPool.query('SELECT * FROM users WHERE id = ?', [userId]);
        if (rows.length === 0) {
            await dbPool.query('INSERT INTO users (id, name, email, profile_pic) VALUES (?, ?, ?, ?)', [userId, name, email, profilePic]);
        }
        res.status(200).json({ message: 'Authentication successful.' });
    } catch (err) {
        console.error('Error during sign-in:', err);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

app.post('/api/auth/register', async (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
        return res.status(400).json({ error: 'Name, email, and password are required.' });
    }
    const userId = 'manual-' + Math.random().toString(36).substr(2, 9);
    try {
        await dbPool.query('INSERT INTO users (id, name, email) VALUES (?, ?, ?)', [userId, name, email]);
        res.status(200).json({ userId, name, email, profilePic: null });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            console.error('Registration error: Email already exists.', err);
            return res.status(409).json({ error: 'This email is already registered. Please try logging in.' });
        }
        console.error('Error during registration:', err);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required.' });
    }
    try {
        const [rows] = await dbPool.query('SELECT * FROM users WHERE email = ?', [email]);
        if (rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials.' });
        }
        const user = rows[0];
        // In a real app, you would compare a hashed password here.
        // For this demo, we'll assume the password is correct if the user exists.
        res.status(200).json({ userId: user.id, name: user.name, email: user.email, profilePic: user.profile_pic });
    } catch (err) {
        console.error('Error during login:', err);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Search for a user
app.get('/api/users/search/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        const [rows] = await dbPool.query('SELECT id, name, profile_pic FROM users WHERE id = ?', [userId]);
        if (rows.length === 0) {
            return res.status(404).json({ message: 'User not found.' });
        }
        res.status(200).json(rows[0]);
    } catch (err) {
        console.error('Error searching for user:', err);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Send a friend request
app.post('/api/friends/request', async (req, res) => {
    const { senderId, receiverId } = req.body;
    if (!senderId || !receiverId) {
        return res.status(400).json({ error: 'Sender and receiver IDs are required.' });
    }
    const [id1, id2] = senderId < receiverId ? [senderId, receiverId] : [receiverId, senderId];
    try {
        const [rows] = await dbPool.query('SELECT * FROM friendships WHERE (user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)', [id1, id2, id2, id1]);
        if (rows.length > 0) {
            return res.status(409).json({ message: 'Friend request already exists or they are already friends.' });
        }
        await dbPool.query('INSERT INTO friendships (user1_id, user2_id, status) VALUES (?, ?, ?)', [id1, id2, 'pending']);
        res.status(200).json({ message: 'Friend request sent.' });
    } catch (err) {
        console.error('Error sending friend request:', err);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Get pending friend requests for a user
app.get('/api/friends/requests/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        const [rows] = await dbPool.query('SELECT f.user1_id as sender_id, u.name as sender_name, u.profile_pic as sender_pic FROM friendships f JOIN users u ON f.user1_id = u.id WHERE f.user2_id = ? AND f.status = ?', [userId, 'pending']);
        res.status(200).json(rows);
    } catch (err) {
        console.error('Error fetching friend requests:', err);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Accept a friend request
app.put('/api/friends/accept/:senderId/:receiverId', async (req, res) => {
    const { senderId, receiverId } = req.params;
    const [id1, id2] = senderId < receiverId ? [senderId, receiverId] : [receiverId, senderId];
    try {
        await dbPool.query('UPDATE friendships SET status = ? WHERE user1_id = ? AND user2_id = ?', ['accepted', id1, id2]);
        res.status(200).json({ message: 'Friend request accepted.' });
    } catch (err) {
        console.error('Error accepting friend request:', err);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Reject a friend request
app.delete('/api/friends/reject/:senderId/:receiverId', async (req, res) => {
    const { senderId, receiverId } = req.params;
    const [id1, id2] = senderId < receiverId ? [senderId, receiverId] : [receiverId, senderId];
    try {
        await dbPool.query('DELETE FROM friendships WHERE user1_id = ? AND user2_id = ?', [id1, id2]);
        res.status(200).json({ message: 'Friend request rejected.' });
    } catch (err) {
        console.error('Error rejecting friend request:', err);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Get friend list for a user
app.get('/api/friends/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        const [friends1] = await dbPool.query('SELECT u.id, u.name, u.profile_pic FROM friendships f JOIN users u ON f.user1_id = u.id WHERE f.user2_id = ? AND f.status = ?', [userId, 'accepted']);
        const [friends2] = await dbPool.query('SELECT u.id, u.name, u.profile_pic FROM friendships f JOIN users u ON f.user2_id = u.id WHERE f.user1_id = ? AND f.status = ?', [userId, 'accepted']);
        const friends = [...friends1, ...friends2];
        res.status(200).json(friends);
    } catch (err) {
        console.error('Error fetching friends list:', err);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// --- WebSocket for Real-time Chat and Video Sync ---
let clients = new Map(); // Map to store userId -> WebSocket connection

wss.on('connection', ws => {
    ws.on('message', message => {
        const data = JSON.parse(message);
        switch (data.type) {
            case 'register':
                clients.set(data.userId, ws);
                break;
            case 'chat_message':
                // Broadcast message to all connected clients
                wss.clients.forEach(client => {
                    if (client !== ws && client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify(data));
                    }
                });
                break;
            case 'video_sync':
                // Broadcast video sync event to all connected clients
                wss.clients.forEach(client => {
                    if (client !== ws && client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify(data));
                    }
                });
                break;
        }
    });

    ws.on('close', () => {
        // Remove client from the map on disconnect
        for (const [userId, client] of clients.entries()) {
            if (client === ws) {
                clients.delete(userId);
                break;
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, 'localhost', () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
