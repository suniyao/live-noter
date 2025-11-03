# Live Noter - AI-Powered Real-time Note Taking for Obsidian

Live Noter is an Obsidian plugin that transforms real-time transcriptions into well-formatted, styled notes using AI. It integrates with external transcription services (like [Omi](https://omi.me)) to automatically process audio content and generate notes in your personal note-taking style.

## Features

- **Real-time transcription processing** via webhooks
- **AI-powered note generation** using Anthropic Claude
- **Personal style learning** from your existing notes
- **Smart file targeting** - saves notes to your current active file or fallback
- **Automated processing** every 10s (or your modified number of seconds) during recording sessions
- **Live preview** of styled notes in settings

## 🚀 Quick Start

### Prerequisites

- Node.js v16+ (`node --version`)
- Obsidian v0.15.0+
- Anthropic API key ([Get one here](https://console.anthropic.com/))

### Installation

1. **Clone the repository** into your Obsidian plugins folder:
   ```bash
   cd /path/to/your/vault/.obsidian/plugins/
   git clone https://github.com/suniyao/omi-obsidian-live-noter.git
   cd omi-obsidian-live-noter
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up your API key**:
   ```bash
   cp .env.example .env
   # Edit .env and add your Anthropic API key:
   # ANTHROPIC_API_KEY=sk-ant-api03-your-actual-api-key-here
   ```

4. **Build the plugin**:
   ```bash
   npm run build
   ```

5. **Enable the plugin** in Obsidian:
   - Go to Settings → Community plugins
   - Refresh and enable "Live Noter"

## How to Use

### Basic Workflow

1. **Learn your note-taking style** (one-time setup):
   - Go to Settings → Live Noter
   - Set your sample notes folder path (optional)
   - Click "Learn note-taking style"
   - The AI will analyze your existing notes and save your style

2. **Start a recording session**:
   - Open the file where you want notes saved (or leave empty for `final_notes.md`)
   - Click the microphone icon in the ribbon, or
   - Use the command palette: "Start Note Taking"

3. **Send transcriptions** to the webhook:
   ```bash
   # Start the webhook server
   cd /path/to/vault/.obsidian/plugins/live-noter
   node utils/server.js
   ```
   
   - Server runs on `http://localhost:3000`
   - Send POST requests to `/webhook` with transcription data

4. **Stop recording**:
   - Click the microphone icon again
   - Final processing will complete automatically

### Integration with External Apps

#### Omi Integration
If you're using [Omi](https://omi.me) for transcription:

1. Set up ngrok for public webhook access:
   ```bash
   ngrok http 3000
   ```

2. Configure Omi to send webhooks to your ngrok URL:
   ```
   https://your-ngrok-url.ngrok-free.app/webhook
   ```

#### Custom Integration
Send POST requests to `/webhook` with this format:
```json
{
  "text": "Your transcribed text here",
  "segments": [
    {"text": "Segment 1"},
    {"text": "Segment 2"}
  ]
}
```

## Configuration

### Plugin Settings

- **Sample notes folder**: Path to analyze for learning your style (e.g., "Notes/Physics")
- **Anthropic API Key**: Your Claude API key (can also be set via .env file)
- **Preview text**: Test area to preview how your style will be applied

### Environment Variables

Create a `.env` file in the plugin directory:
```bash
ANTHROPIC_API_KEY = "sk-ant-api03-your-key-here"
```

## Development

### Project Structure

```
live-noter/
├── main.ts                 # Main plugin entry point
├── utils/
│   ├── server.js          # Webhook server
│   ├── processor.js       # AI processing logic
│   ├── webhook-manager.js # Data storage management
│   ├── styleAPI.ts        # Style learning interface
│   ├── learn_style.py     # Python style analysis
│   └── llm_wrapper.py     # Anthropic API wrapper
├── .env.example           # Environment template
└── package.json           # Dependencies
```

### Development Commands

```bash
npm run dev      # Watch mode compilation with hot reload (if you are developer)
npm run build    # Production build
npm install      # Install dependencies
```

### Running the Webhook Server

```bash
# Development (with auto-restart)
cd utils && node server.js

# Production (background)
cd utils && nohup node server.js > server.log 2>&1 &
```

## Troubleshooting

### Common Issues

1. **"ANTHROPIC_API_KEY not found"**
   - Make sure your `.env` file exists with the correct API key
   - Or set the API key in plugin settings

2. **Webhook server not responding**
   - Check if server is running: `lsof -i :3000`
   - Restart with: `cd utils && node server.js`

3. **Notes not saving to current file**
   - Ensure you have a file open when starting recording
   - Check console for file path detection logs

4. **Style learning fails**
   - Ensure Python is installed and accessible
   - Check that sample notes folder exists and contains .md files

### Debug Logs

Check these files for debugging:
- `last_prompt.txt` - Last AI prompt sent
- `processor_state.json` - Processing state
- `webhooks.json` - Received webhook data
- `processed.json` - Processing tracking

## Contributing :)

1. Fork the repository
2. Create a feature branch: `git checkout -b my-new-feature`
3. Commit changes: `git commit -am 'Add some feature'`
4. Push to branch: `git push origin my-new-feature`
5. Submit a pull request


**Note**: This plugin requires an active internet connection and Anthropic API access for AI processing.
