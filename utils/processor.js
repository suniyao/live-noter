import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Centralized configuration
const CONFIG = {
  outputFile: path.join(process.cwd(), 'final_notes.md'), // Default fallback
  stateFile: path.join(process.cwd(), 'processor_state.json'),
  promptFile: path.join(process.cwd(), 'last_prompt.txt'),
  styleFile: path.join(process.cwd(), 'style.txt'),
  llmScript: path.join(__dirname, 'llm_wrapper.py')
};

/**
 * Load processor state (tracks what was last processed)
 */
async function loadState() {
  try {
    const data = await fs.readFile(CONFIG.stateFile, 'utf8');
    return JSON.parse(data);
  } catch {
    return { lastProcessed: '', processedCount: 0 };
  }
}

/**
 * Load user's note-taking style
 */
async function loadUserStyle() {
  try {
    const styleContent = await fs.readFile(CONFIG.styleFile, 'utf8');
    return styleContent.trim();
  } catch {
    return ''; // Return empty string if style file doesn't exist
  }
}

/**
 * Save processor state
 */
async function saveState(state) {
  await fs.writeFile(CONFIG.stateFile, JSON.stringify(state, null, 2));
}

/**
 * Build the iterative processing prompt
 */
async function buildPrompt(lastProcessed, mainText, nextText = '') {
  const userStyle = await loadUserStyle();
  
  let styleSection = '';
  if (userStyle) {
    styleSection = `
USER'S NOTE-TAKING STYLE (follow this style when creating notes):
${userStyle}

---

`;
  }
  return `You are a note taking expert. Here is a part of audio processed, so it might contain small errors on recognizing what the word is. If it does not make sense to you, maybe search for some word of similar pronunciation that fits in the topic. 

${styleSection}IGNORE unfinished text if it seems like it is cut off from a previous batch that was processed, and if it does not conclude within this text, try to comprehend what it means from next one, and only add the next one's part that can be connected to the unfinished sentence. Also check from last styled piece of styled note processed by LLM, do not double process because you will append the text to where the last one processed ends.

Last one processed: "${lastProcessed.replace(/"/g, '\\"')}"
Main text: "${mainText.replace(/"/g, '\\"')}"
Next one to process: "${nextText.replace(/"/g, '\\"')}"

What will you output? ONLY PROCESS THE PIECE OF NOTE YOU WILL TAKE WITH THIS TEXT (in markdown form) following the user's note-taking style above. DO NOT OVER PROCESS.`;
}

/**
 * Call the LLM with a prompt
 */
async function callLLM(prompt) {
  return new Promise((resolve, reject) => {
    // Check for API key in multiple places
    const apiKey = process.env.ANTHROPIC_API_KEY || 
                   process.env.anthropic_api_key ||
                   process.env.CLAUDE_API_KEY;
    
    if (!apiKey) {
      reject(new Error('ANTHROPIC_API_KEY not found. Set it with: export ANTHROPIC_API_KEY=your_key'));
      return;
    }
    
    const py = spawn('python3', [CONFIG.llmScript], { 
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { 
        ...process.env,
        ANTHROPIC_API_KEY: apiKey
      },
      cwd: process.cwd()
    });
    
    let stdout = '';
    let stderr = '';
    
    py.stdout.on('data', (data) => stdout += data.toString());
    py.stderr.on('data', (data) => stderr += data.toString());
    
    py.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`LLM failed (${code}): ${stderr}`));
      } else {
        resolve(stdout.trim());
      }
    });
    
    py.stdin.write(prompt);
    py.stdin.end();
  });
}

/**
 * Append processed content to the specified output file
 */
async function appendToOutput(content, outputPath = CONFIG.outputFile) {
  if (!content) return;
  
  try {
    // Ensure the directory exists
    const dir = path.dirname(outputPath);
    await fs.mkdir(dir, { recursive: true });
    
    await fs.appendFile(outputPath, content + '\n\n', 'utf8');
  } catch {
    await fs.writeFile(outputPath, content + '\n\n', 'utf8');
  }
}

/**
 * Process a single text batch iteratively
 */
export async function processBatch(mergedText, nextText = '', outputPath = null) {
  if (!mergedText?.trim()) {
    console.log('📝 No text to process');
    return null;
  }

  // Determine the output file path
  const finalOutputPath = outputPath || CONFIG.outputFile;

  try {
    // Load current state
    const state = await loadState();
    
    // Build prompt with context and user style
    const prompt = await buildPrompt(state.lastProcessed, mergedText, nextText);
    
    // Save prompt for debugging
    await fs.writeFile(CONFIG.promptFile, prompt, 'utf8');
    
    console.log(`🤖 Processing batch #${state.processedCount + 1}...`);
    
    // Call LLM
    const processedContent = await callLLM(prompt);
    
    if (!processedContent) {
      throw new Error('LLM returned empty content');
    }
    
    // Append to the specified output file
    await appendToOutput(processedContent, finalOutputPath);
    
    // Update state
    const newState = {
      lastProcessed: processedContent,
      processedCount: state.processedCount + 1,
      lastProcessedAt: new Date().toISOString()
    };
    await saveState(newState);
    
    console.log(`✅ Processed batch #${newState.processedCount}`);
    console.log(`📄 Added to: ${finalOutputPath}`);
    
    return processedContent;
    
  } catch (error) {
    console.error('❌ Processing failed:', error.message);
    throw error;
  }
}

/**
 * Reset processor state (for testing/debugging)
 */
export async function resetState() {
  await saveState({ lastProcessed: '', processedCount: 0 });
  console.log('🔄 Processor state reset');
}

/**
 * Get current processor status
 */
export async function getStatus() {
  const state = await loadState();
  return {
    ...state,
    outputFile: CONFIG.outputFile,
    llmScript: CONFIG.llmScript
  };
}