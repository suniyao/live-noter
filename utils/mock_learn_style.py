#!/usr/bin/env python3
import os
import json
import sys

def mock_style_summary():
    return """# Your Note-Taking Style Analysis

Based on your Obsidian notes, here are your key note-taking patterns:

## Structure & Organization
• **Hierarchical headings**: You consistently use # ## ### for clear document structure
• **Bullet points**: Heavy use of • and - for listing information

```code``` for technical content
• **Callouts**: Regular use of > for important notes and warnings

## Content Style
• **Concise bullet points**: You prefer short, actionable statements
• **Technical terminology**: Comfortable with domain-specific language
• **Examples**: Often include concrete examples after concepts
• **Cross-references**: Frequent linking between related notes with [[links]]

## Formatting Preferences
• **Bold for emphasis**: **key terms** and **important concepts**
• *Italics for definitions* and foreign terms
• Code formatting for `variables` and `commands`
• Tables for structured data comparison

## Information Processing
• **Bottom-line-up-front**: Key takeaways at the beginning
• **Progressive detail**: General concepts followed by specifics
• **Visual breaks**: Good use of spacing and separators
• **Action items**: Clear next steps and todo items

This style emphasizes clarity, technical precision, and structured organization optimized for quick reference and study review."""

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python mock_learn_style.py <notes_dir> __learn_only__")
        sys.exit(1)
    
    notes_dir, mode = sys.argv[1], sys.argv[2]
    
    if mode == "__learn_only__":
        style_summary = mock_style_summary()
        
        # Save to style.txt file
        style_file_path = os.path.join(notes_dir, "style.txt")
        try:
            with open(style_file_path, "w", encoding="utf-8") as f:
                f.write("# Your Note-Taking Style Summary\n\n")
                f.write(style_summary)
                f.write(f"\n\n---\nGenerated on: {os.popen('date').read().strip()}\n")
            
            print(f"Debug: Style saved to {style_file_path}", file=sys.stderr)
        except Exception as e:
            print(f"Warning: Could not save style file: {e}", file=sys.stderr)
        
        # Return JSON response
        result = json.dumps({
            "styled": style_summary,
            "style_file": style_file_path
        })
        print(result)
    else:
        print("Mock mode only supports __learn_only__", file=sys.stderr)
        sys.exit(1)