import { spawnSync } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

/**
 * Learn the user's style corpus by invoking the Python helper in learn-only mode.
 * Returns an object with the style summary and file path.
 */
export function learnStyle(notesDir: string, scriptPath?: string, apiKey?: string): { summary: string, filePath?: string } {
  const script = scriptPath ?? path.join(__dirname, 'learn_style.py');
  const env = Object.assign({}, process.env, apiKey ? { ANTHROPIC_API_KEY: apiKey } : {});
  const result = spawnSync("python3", [script, notesDir, "__learn_only__"], { env });
  
  if (result.error) {
    console.error("Python spawn error:", result.error);
    throw result.error;
  }
  
  if (result.status !== 0) {
    console.error("Python stderr:", result.stderr.toString());
    throw new Error(`Python script failed with status ${result.status}`);
  }
  
  try {
    const parsed = JSON.parse(result.stdout.toString());
    return {
      summary: parsed.styled || '',
      filePath: parsed.style_file || undefined
    };
  } catch (err) {
    console.error("Python error:", result.stderr.toString());
    console.error("Python stdout:", result.stdout.toString());
    throw err;
  }
}

/**
 * Stylize a piece of transcript text. The Python script expects a file path for
 * the transcript, so we write a small temporary file and pass its path.
 */
export function stylizeText(notesDir: string, transcriptText: string, scriptPath?: string, apiKey?: string): string {
  const tmpDir = os.tmpdir();
  const tmpName = `live-noter-transcript-${Date.now()}-${Math.floor(Math.random() * 10000)}.md`;
  const tmpPath = path.join(tmpDir, tmpName);
  try {
  fs.writeFileSync(tmpPath, transcriptText, { encoding: "utf-8" });
  const script = scriptPath ?? path.join(__dirname, 'learn_style.py');
  const env = Object.assign({}, process.env, apiKey ? { ANTHROPIC_API_KEY: apiKey } : {});
  const result = spawnSync("python3", [script, notesDir, tmpPath], { env });
    try {
      const parsed = JSON.parse(result.stdout.toString());
      // Current learn_style.py prints the key "restyled notes" for the
      // stylized output. Fall back to `styled` if present.
      return parsed["restyled notes"] ?? parsed.styled ?? '';
    } catch (err) {
      console.error("Python error:", result.stderr.toString());
      throw err;
    }
  } finally {
    try { fs.unlinkSync(tmpPath); } catch (e) { /* ignore cleanup errors */ }
  }
}

// Backwards-compatible alias
export const applyObsidianStyle = stylizeText;
