import 'dotenv/config';
import express from 'express';
import { addWebhook, getUnprocessedBatch, markBatchProcessed } from './webhook-manager.js';
import { processBatch } from './processor.js';
import fs from 'fs/promises';
import path from 'path';

const app = express();
const PORT = process.env.PORT || 3000;

// Debug: Check if environment variable is loaded
console.log(`🔑 ANTHROPIC_API_KEY loaded: ${process.env.ANTHROPIC_API_KEY ? 'Yes' : 'No'}`);
if (process.env.ANTHROPIC_API_KEY) {
  console.log(`🔑 API Key preview: ${process.env.ANTHROPIC_API_KEY.substring(0, 10)}...`);
}

// Processing state
let processingInterval = null;
let currentNotesFilePath = null; // Will be set to absolute path

// Basic middleware
app.use(express.json());
app.use(express.text());

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Simple webhook endpoint
app.post('/webhook', async (req, res) => {
  try {
    console.log('📥 Webhook received:', req.body);
    
    let data = req.body;
    
    // If it's a string, try to parse it as JSON first
    if (typeof req.body === 'string') {
      try {
        data = JSON.parse(req.body);
      } catch (e) {
        // If parsing fails, keep it as string
        data = req.body;
      }
    }
    
    await addWebhook(data);
    console.log('✅ Webhook saved');
    
    res.json({ success: true, message: 'Webhook received' });
  } catch (error) {
    console.error('❌ Webhook error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

// Root endpoint for testing
app.get('/', (req, res) => {
  res.json({ 
    message: 'Webhook server running',
    endpoints: {
      'POST /webhook': 'External app sends data here',
      'GET /webhooks': 'View received webhook data as JSON',
      'GET /health': 'Health check'
    }
  });
});

// View webhooks as JSON
app.get('/webhooks', async (req, res) => {
  try {
    const webhooksPath = path.join(process.cwd(), 'webhooks.json');
    let webhooks = [];
    
    try {
      const data = await fs.readFile(webhooksPath, 'utf-8');
      webhooks = JSON.parse(data);
    } catch (err) {
      // File doesn't exist or is empty, return empty array
    }
    
    res.json(webhooks);
  } catch (error) {
    console.error('Error loading webhooks:', error);
    res.status(500).json({ error: 'Error loading webhooks' });
  }
});

// Start recording endpoint - receives current file path
app.post('/start-recording', async (req, res) => {
  try {
    const { currentFilePath, fallbackPath } = req.body;
    
    if (currentFilePath) {
      currentNotesFilePath = currentFilePath;
      console.log(`📝 Recording started - will save notes to active file: ${currentFilePath}`);
    } else if (fallbackPath) {
      currentNotesFilePath = fallbackPath;
      console.log(`📝 Recording started - will save notes to fallback: ${fallbackPath}`);
    } else {
      // Ultimate fallback to current working directory
      currentNotesFilePath = path.join(process.cwd(), 'final_notes.md');
      console.log(`📝 Recording started - will save notes to default: ${currentNotesFilePath}`);
    }
    
    res.json({ 
      success: true, 
      message: 'Recording started',
      notesFilePath: currentNotesFilePath
    });
  } catch (error) {
    console.error('❌ Start recording error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Stop recording endpoint
app.post('/stop-recording', async (req, res) => {
  try {
    console.log(`📝 Recording stopped - final notes saved to: ${currentNotesFilePath}`);
    
    res.json({ 
      success: true, 
      message: 'Recording stopped',
      notesFilePath: currentNotesFilePath
    });
  } catch (error) {
    console.error('❌ Stop recording error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 POST /webhook - Send your JSON transcriptions here`);
  console.log(`🌐 Visit http://localhost:${PORT}/webhooks to view data`);
  
  // Start processing every 10 seconds for testing
  processingInterval = setInterval(processWebhooks, 10000);
  console.log('⏰ Processing webhooks every 10 seconds');
});

// Main processing function
async function processWebhooks() {
  console.log('🔄 Checking for unprocessed webhooks...');
  
  try {
    const batch = await getUnprocessedBatch();
    
    if (!batch) {
      console.log('📝 No unprocessed webhooks found');
      return;
    }
    
    console.log(`📚 Processing ${batch.items.length} webhooks`);
    
    // Process the batch with the processor, passing current file path
    await processBatch(batch.mergedText, batch.nextText, currentNotesFilePath);
    
    // Mark this batch as processed
    await markBatchProcessed(batch.items);
    
    console.log('✅ Webhook batch processed successfully');
    
  } catch (error) {
    console.error('❌ Webhook processing failed:', error);
  }
}

console.log('✅ Server initialized');