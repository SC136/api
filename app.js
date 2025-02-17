const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const app = express();
const port = 3000;

// Track client ready state
let isClientReady = false;

// Initialize WhatsApp client with local authentication
const client = new Client({
    authStrategy: new LocalAuth({
        clientId: "whatsapp-client"
    }),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

// Generate QR code for WhatsApp Web authentication
client.on('qr', (qr) => {
    console.log('Please scan the following QR code with WhatsApp:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    isClientReady = true;
    console.log('WhatsApp client is ready!');
});

// Handle errors
client.on('auth_failure', msg => {
    isClientReady = false;
    console.error('WhatsApp authentication failed:', msg);
});

client.on('disconnected', (reason) => {
    isClientReady = false;
    console.log('Client was disconnected:', reason);
});

// Initialize WhatsApp client
client.initialize();

// Add timeout middleware
const timeout = (ms) => {
    return (req, res, next) => {
        res.setTimeout(ms, () => {
            console.log('Request timed out');
            res.status(408).json({ error: 'Request timeout' });
        });
        next();
    };
};

// Express endpoint
app.get('/reached', timeout(15000), async (req, res) => {
    console.log('Received request to /reached endpoint');

    if (!isClientReady) {
        console.log('Client not ready yet');
        return res.status(503).json({ error: 'WhatsApp client not ready. Please wait a moment and try again.' });
    }

    try {
        // Get all chats
        console.log('Fetching chats...');
        const chats = await client.getChats();
        console.log(`Found ${chats.length} chats`);

        // Find the group
        console.log('Searching for group named "family"...' );
        const targetGroup = chats.find(chat => {
            console.log(`Checking chat: ${chat.name}`);
            return chat.name === '❤️ SSS ❤️';
        });

        if (!targetGroup) {
            console.log('Group "family" not found');
            return res.status(404).json({ error: 'Group not found' });
        }

        console.log('Found group, attempting to send message...');
        // Send message to the group
        await targetGroup.sendMessage('reached college 🏫🎓');

        console.log('Message sent successfully');
        res.json({ success: true, message: 'Message sent to group' });
    } catch (error) {
        console.error('Detailed error:', error);
        res.status(500).json({ error: 'Failed to send message', details: error.message });
    }
});

// Start server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
