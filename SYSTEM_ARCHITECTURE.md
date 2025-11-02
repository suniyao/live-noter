# Organized Webhook Processing System

## Overview
The webhook processing system has been reorganized into clean, modular components that handle iterative processing of merged text batches. The system processes incoming webhooks in batches every 30 seconds, maintaining context between processing sessions.

## Architecture

### Core Modules

#### 1. `webhook-manager.js`
**Purpose**: Manages webhook storage, batching, and processed item tracking
**Key Functions**:
- `addWebhook(text)` - Store incoming webhook text
- `getUnprocessedBatch()` - Get next batch of unprocessed items
- `markBatchProcessed(items)` - Mark items as processed
- `getStats()` - Get processing statistics
- `cleanup(keepDays)` - Clean up old processed items

#### 2. `processor.js`
**Purpose**: Handles iterative LLM processing with context awareness
**Key Functions**:
- `processBatch(mergedText, nextText)` - Process text batch with LLM
- `getStatus()` - Get processor state and configuration
- `resetState()` - Reset processing state for testing

#### 3. `server.js`
**Purpose**: Express server with webhook endpoints and automated processing
**Features**:
- `POST /webhook` - Receive webhook text
- `GET /status` - View processing statistics
- `GET /health` - Health check endpoint
- Automatic batch processing every 30 seconds

## Data Flow

```
Incoming Webhook → webhook-manager → Batch Processing → LLM Processing → Output File
     ↓                    ↓               ↓               ↓              ↓
  webhooks.json      Batch Creation   processor.js   llm_wrapper.py  final_notes.md
                     (10 items max)   Context Aware  (Anthropic API)  (Markdown)
                                      State Tracking
```

## File Storage

### State Files
- `webhooks.json` - Raw webhook storage with timestamps and IDs
- `processed.json` - Tracking of processed item IDs and metadata
- `processor_state.json` - Last processed content for context continuity
- `final_notes.md` - Final markdown output from LLM processing
- `last_prompt.txt` - Debug file showing last LLM prompt

### Configuration
- Batch size: 10 items maximum per processing cycle
- Processing interval: 30 seconds
- Output format: Markdown with proper formatting
- LLM integration: Anthropic Claude API via Python subprocess

## Iterative Processing Features

### Context Awareness
- **Last Processed Tracking**: System remembers the last processed content
- **Batch Continuity**: Each new batch receives context from previous processing
- **Unfinished Text Handling**: Smart detection and completion of cut-off sentences
- **Duplicate Prevention**: Ensures no double-processing of content

### State Management
- Persistent state across server restarts
- Atomic batch processing (all-or-nothing)
- Error recovery with detailed logging
- Processing statistics and monitoring

## Usage

### Starting the Server
```bash
cd utils
node server.js
```

### Sending Webhooks
```bash
curl -X POST http://localhost:3001/webhook \
  -H "Content-Type: text/plain" \
  -d "Your transcript text here"
```

### Checking Status
```bash
curl http://localhost:3001/status
```

### Testing the System
```bash
node test-system.js
```

## API Endpoints

### POST /webhook
Accepts webhook text for processing
- **Body**: Plain text or JSON with `text` field
- **Response**: `{ success: true, id: "webhook-id", message: "..." }`

### GET /status
Returns processing statistics
```json
{
  "total": 15,
  "processed": 12,
  "pending": 3,
  "lastProcessedAt": "2024-11-02T05:20:15.123Z",
  "batchSize": 10
}
```

### GET /health
Health check endpoint
```json
{
  "status": "healthy",
  "timestamp": "2024-11-02T05:20:15.123Z"
}
```

## Environment Requirements

### Required Environment Variables
- `ANTHROPIC_API_KEY` - Your Anthropic API key for LLM processing

### Dependencies
- Node.js with ES modules support
- Python 3 with `anthropic` package installed
- Express.js for webhook server

## Error Handling

### Robust Error Recovery
- LLM processing failures don't block webhook acceptance
- Batch processing continues with next batch on errors
- Detailed error logging with context preservation
- Graceful degradation when API limits are hit

### Debugging Features
- Last prompt saved to `last_prompt.txt` for debugging
- Comprehensive console logging with emoji indicators
- Processing state inspection via `/status` endpoint
- Test script for system validation

## Benefits of New Organization

1. **Modularity**: Clear separation of concerns between webhook handling, processing, and LLM integration
2. **Maintainability**: Easy to modify individual components without affecting others
3. **Testability**: Comprehensive test script validates entire system
4. **Scalability**: Configurable batch sizes and processing intervals
5. **Reliability**: Robust error handling and state persistence
6. **Monitoring**: Built-in statistics and health checks

## Migration from Old System

The old scattered files have been consolidated:
- ❌ `process_to_markdown.js` → ✅ `processor.js`
- ❌ `run_with_python_model.js` → ✅ Integrated in `processor.js`
- ❌ Complex server logic → ✅ Clean `webhook-manager.js` + `server.js`
- ❌ Multiple duplicate utilities → ✅ Single-purpose modules

All functionality is preserved while reducing complexity and improving maintainability.