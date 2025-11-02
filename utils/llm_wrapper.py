#!/usr/bin/env python3
import os
import sys
import anthropic

def main():
    api_key = os.getenv('ANTHROPIC_API_KEY')
    if not api_key:
        print('Missing ANTHROPIC_API_KEY env var', file=sys.stderr)
        sys.exit(2)

    client = anthropic.Anthropic(api_key=api_key)
    prompt = sys.stdin.read()
    if not prompt:
        print('No prompt provided on stdin', file=sys.stderr)
        sys.exit(2)

    try:
        resp = client.messages.create(
            model='claude-3-5-haiku-20241022',
            max_tokens=2000,
            messages=[{'role': 'user', 'content': prompt}],
        )
        # Extract just the text content from TextBlock objects
        if resp.content:
            text_content = ""
            for block in resp.content:
                if block.type == 'text':
                    text_content += block.text
                elif isinstance(block, str):
                    text_content += block
            print(text_content.strip())
        else:
            print("No content returned", file=sys.stderr)
            sys.exit(1)
    except Exception as e:
        print('LLM call failed: ' + str(e), file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()
