import os
import json
from anthropic import Anthropic


client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

def take_text(notes_dir):
    all_text = ""
    for root, _, files in os.walk(notes_dir):
        for f in files:
            if f.endswith(".md"):
                path = os.path.join(root, f)
                with open(path, "r", encoding="utf-8") as file:
                    content = file.read().strip()
                    all_text += content + "\n\n"
    # limit size to avoid hitting token limits
    return all_text[:12000]

def summarize_style(notes_dir):
    style_corpus = take_text(notes_dir)

    prompt = f"""
    You are an assistant that rewrites lecture transcripts in the same tone and style
    as the user's previous Obsidian notes.

    Here are examples of their note-taking style:
    ---
    {style_corpus}
    ---

    List out user's note-taking styles in bullet points and summarize. Make it markdown code heavy so with later prompting they know how to achieve the same formatting. Do not ask follow up question. This will be used for further AI prompting, so keep it all in one answer.
    """

    response = client.messages.create(
        model="claude-3-5-haiku-20241022",
        max_tokens=2000,
        messages=[{"role": "user", "content": prompt}]
    )
    # Extract the actual text content from the response
    if response.content and len(response.content) > 0:
        for block in response.content:
            if block.type == 'text':
                return block.text
        # If no text block found, convert to string
        return str(response.content[0])
    else:
        return "No response generated"


def adapt_style(transcript, style_summarization):
    prompt = f"""
    You are an assistant that rewrites lecture transcripts in the same tone and style
    as the user's previous Obsidian notes.

    The user's lecture notes style can be summarized as this
    ---
    {style_summarization}
    ---

    Restyle transcript to formatted lecture notes that looks like how user will write them.
    ---
    {transcript}
    ---
    Do not ask follow up question. This will be used for further AI prompting, so keep it all in one answer.
    """

    response = client.messages.create(
        model="claude-3-5-haiku-20241022",
        max_tokens=2000,
        messages=[{"role": "user", "content": prompt}]
    )
    # Extract the actual text content from the response
    if response.content and len(response.content) > 0:
        for block in response.content:
            if block.type == 'text':
                return block.text
        # If no text block found, convert to string
        return str(response.content[0])
    else:
        return "No response generated"

if __name__ == "__main__":
    import sys
    # CLI usage:
    # 1) learn-only mode: python learn_style.py <notes_dir> __learn_only__
    #    prints JSON {"style_corpus": "..."}
    # 2) full mode: python learn_style.py <notes_dir> <transcript_path>
    #    reads transcript file and prints JSON {"styled": "..."}
    if len(sys.argv) != 3:
        print("Usage: python learn_style.py <notes_dir> <transcript_path>\n       or: python learn_style.py <notes_dir> __learn_only__")
        exit(1)

    notes_dir, transcript_path = sys.argv[1], sys.argv[2]
    
    # Debug: Check API key
    api_key = os.getenv('ANTHROPIC_API_KEY')
    if not api_key:
        print("Error: ANTHROPIC_API_KEY not found", file=sys.stderr)
        exit(1)
    
    print(f"Debug: Processing notes from {notes_dir}", file=sys.stderr)

    # First, produce a summarization of the style from notes in notes_dir
    try:
        style_summarization = summarize_style(notes_dir)
        print(f"Debug: Got style summarization of length {len(style_summarization)}", file=sys.stderr)
    except Exception as e:
        print(f"Error in summarize_style: {e}", file=sys.stderr)
        exit(1)

    if transcript_path == "__learn_only__":
        # Save the style summarization to the plugin directory for user review
        # Get the directory where this script is located (plugin's utils directory)
        script_dir = os.path.dirname(os.path.abspath(__file__))
        plugin_dir = os.path.dirname(script_dir)  # Go up one level to plugin root
        style_file_path = os.path.join(plugin_dir, "style.txt")
        
        try:
            with open(style_file_path, "w", encoding="utf-8") as style_file:
                style_file.write("# Your Note-Taking Style Summary\n\n")
                style_file.write(style_summarization)
                style_file.write(f"\n\n---\nGenerated on: {os.popen('date').read().strip()}\n")
            
            print(f"Debug: Style saved to {style_file_path}", file=sys.stderr)
        except Exception as e:
            print(f"Warning: Could not save style file: {e}", file=sys.stderr)
        
        # produce the raw style summarization so callers can store it locally
        try:
            result = json.dumps({
                "styled": style_summarization,
                "style_file": style_file_path if 'style_file_path' in locals() else None
            })
            print(result)
        except Exception as e:
            print(f"Error serializing JSON: {e}", file=sys.stderr)
            exit(1)
        exit(0)

    with open(transcript_path, "r", encoding="utf-8") as f:
        transcript = f.read()
    restyled_note = adapt_style(transcript, style_summarization)
    print(json.dumps({"restyled notes": restyled_note}))
