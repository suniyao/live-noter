import fs from 'fs/promises';
import path from 'path';

// Centralized configuration for webhook handling
const CONFIG = {
  webhooksFile: path.join(process.cwd(), 'webhooks.json'),
  processedFile: path.join(process.cwd(), 'processed.json'),
  batchSize: 10, // Max items to process in one go
  mergeSeparator: ' '
};

function extractTextFromData(data) {
  if (typeof data === 'string') {
    return data;
  }
  
  if (data && data.segments) {
    // Handle transcription format with segments
    return data.segments.map(segment => segment.text).join(' ');
  }
  
  if (data && data.text) {
    return data.text;
  }
  
  // Fallback to stringify if no text found
  return JSON.stringify(data);
}

/**
 * Load webhooks from storage
 */
async function loadWebhooks() {
  try {
    const data = await fs.readFile(CONFIG.webhooksFile, 'utf8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

/**
 * Save webhooks to storage
 */
async function saveWebhooks(webhooks) {
  await fs.writeFile(CONFIG.webhooksFile, JSON.stringify(webhooks, null, 2));
}

/**
 * Load processed items tracking
 */
async function loadProcessed() {
  try {
    const data = await fs.readFile(CONFIG.processedFile, 'utf8');
    return JSON.parse(data);
  } catch {
    return { processedIds: [], lastProcessedAt: null };
  }
}

/**
 * Save processed items tracking
 */
async function saveProcessed(processed) {
  await fs.writeFile(CONFIG.processedFile, JSON.stringify(processed, null, 2));
}

/**
 * Add a new webhook to storage
 */
export async function addWebhook(data) {
  if (!data) return;
  
  const webhooks = await loadWebhooks();
  const newWebhook = {
    id: Date.now() + '-' + Math.random().toString(36).substr(2, 9),
    data: data, // Store the actual data object
    receivedAt: new Date().toISOString()
  };
  
  webhooks.push(newWebhook);
  await saveWebhooks(webhooks);
  
  console.log(`📥 Added webhook: ${newWebhook.id}`);
  return newWebhook;
}

/**
 * Get unprocessed webhooks in batches
 */
export async function getUnprocessedBatch() {
  const webhooks = await loadWebhooks();
  const processed = await loadProcessed();
  
  // Filter out already processed items
  const processedIds = processed.processedIds || [];
  const unprocessed = webhooks.filter(w => !processedIds.includes(w.id));
  
  if (unprocessed.length === 0) {
    return null;
  }
  
  // Take up to batchSize items
  const batch = unprocessed.slice(0, CONFIG.batchSize);
  const nextBatch = unprocessed.slice(CONFIG.batchSize, CONFIG.batchSize * 2);
  
  return {
    items: batch,
    mergedText: batch.map(item => extractTextFromData(item.data)).join(CONFIG.mergeSeparator),
    nextText: nextBatch.length > 0 ? extractTextFromData(nextBatch[0].data) : '',
    hasMore: unprocessed.length > CONFIG.batchSize
  };
}

/**
 * Mark a batch as processed
 */
export async function markBatchProcessed(batchItems) {
  if (!batchItems?.length) return;
  
  const processed = await loadProcessed();
  const newIds = batchItems.map(item => item.id);
  
  // Ensure processedIds array exists
  if (!processed.processedIds) {
    processed.processedIds = [];
  }
  
  processed.processedIds.push(...newIds);
  processed.lastProcessedAt = new Date().toISOString();
  processed.totalProcessed = (processed.totalProcessed || 0) + newIds.length;
  
  await saveProcessed(processed);
  
  console.log(`✅ Marked ${newIds.length} items as processed`);
}

/**
 * Get webhook statistics
 */
export async function getStats() {
  const webhooks = await loadWebhooks();
  const processed = await loadProcessed();
  
  const processedCount = processed.processedIds ? processed.processedIds.length : 0;
  
  return {
    total: webhooks.length,
    processed: processedCount,
    pending: webhooks.length - processedCount,
    lastProcessedAt: processed.lastProcessedAt,
    batchSize: CONFIG.batchSize
  };
}

/**
 * Clean up old processed webhooks (optional maintenance)
 */
export async function cleanup(keepDays = 7) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - keepDays);
  
  const webhooks = await loadWebhooks();
  const processed = await loadProcessed();
  
  // Remove old webhooks that are already processed
  const filtered = webhooks.filter(w => {
    const isOld = new Date(w.receivedAt) < cutoff;
    const isProcessed = processed.processedIds.includes(w.id);
    return !(isOld && isProcessed);
  });
  
  // Update processed IDs to match remaining webhooks
  const remainingIds = filtered.map(w => w.id);
  processed.processedIds = processed.processedIds.filter(id => remainingIds.includes(id));
  
  await saveWebhooks(filtered);
  await saveProcessed(processed);
  
  const removed = webhooks.length - filtered.length;
  if (removed > 0) {
    console.log(`🗑️ Cleaned up ${removed} old processed webhooks`);
  }
  
  return removed;
}

/**
 * Limit webhooks to a maximum number when not recording
 */
export async function limitWebhooks(maxCount = 30) {
  const webhooks = await loadWebhooks();
  
  if (webhooks.length > maxCount) {
    // Keep only the most recent webhooks
    const limited = webhooks.slice(-maxCount);
    await saveWebhooks(limited);
    
    // Clean up processed IDs to match remaining webhooks
    const processed = await loadProcessed();
    const remainingIds = limited.map(w => w.id);
    processed.processedIds = processed.processedIds.filter(id => remainingIds.includes(id));
    await saveProcessed(processed);
    
    const removed = webhooks.length - limited.length;
    console.log(`🗑️ Limited webhooks to ${maxCount}, removed ${removed} old items`);
    return removed;
  }
  
  return 0;
}

/**
 * Reset processed tracking (clear processed.json)
 */
export async function resetProcessed() {
  await saveProcessed({ processedIds: [], lastProcessedAt: null });
  console.log('🔄 Reset processed tracking');
}

/**
 * Get all unprocessed webhooks for final processing
 */
export async function getAllUnprocessed() {
  const webhooks = await loadWebhooks();
  const processed = await loadProcessed();
  
  const processedIds = processed.processedIds || [];
  const unprocessed = webhooks.filter(w => !processedIds.includes(w.id));
  
  return {
    items: unprocessed,
    mergedText: unprocessed.map(item => item.text).join(CONFIG.mergeSeparator),
    count: unprocessed.length
  };
}