import type { Entry, DirectiveType, BridgeExport } from '@/types';
import { DIRECTIVES } from '@/types';
import { estimateTokens } from '@/lib/utils';
import { generateBridgeKey as generateKey } from './api';
import type { JSONContent } from '@tiptap/react';

/**
 * Convert ProseMirror JSON content to plain text for export
 */
function contentToText(content: JSONContent): string {
  if (!content) return '';

  let text = '';

  if (content.text) {
    text += content.text;
  }

  if (content.content && Array.isArray(content.content)) {
    for (const node of content.content) {
      const nodeText = contentToText(node);
      
      // Handle different node types
      switch (node.type) {
        case 'paragraph':
          text += nodeText + '\n\n';
          break;
        case 'heading':
          const level = node.attrs?.level || 1;
          text += '#'.repeat(level) + ' ' + nodeText + '\n\n';
          break;
        case 'bulletList':
        case 'orderedList':
          text += nodeText + '\n';
          break;
        case 'listItem':
          text += '- ' + nodeText + '\n';
          break;
        case 'codeBlock':
          const lang = node.attrs?.language || '';
          text += '```' + lang + '\n' + nodeText + '\n```\n\n';
          break;
        case 'blockquote':
          text += '> ' + nodeText.replace(/\n/g, '\n> ') + '\n\n';
          break;
        case 'horizontalRule':
          text += '---\n\n';
          break;
        default:
          text += nodeText;
      }
    }
  }

  return text;
}

/**
 * Format entry for export with XML delimiters
 */
function formatEntryForExport(entry: Entry): string {
  const content = contentToText(entry.content);
  const timestamp = new Date(entry.createdAt).toISOString();

  return `<${entry.role}_entry id="${entry.id}" sequence="${entry.sequenceId}" timestamp="${timestamp}">
${content.trim()}
</${entry.role}_entry>`;
}

/**
 * Generate the complete bridge prompt
 */
export async function generateBridgePrompt(
  entries: Entry[],
  directive: DirectiveType
): Promise<BridgeExport> {
  const bridgeKey = await generateKey();
  const directiveConfig = DIRECTIVES[directive];

  // Format all staged entries
  const formattedEntries = entries.map(formatEntryForExport).join('\n\n');

  // Build the prompt
  const prompt =
    directiveConfig.template.replace('{STAGED_BLOCKS}', formattedEntries) +
    `\n\n<!-- bridge:${bridgeKey} -->`;

  // Calculate token estimate
  const tokenEstimate = estimateTokens(prompt);

  return {
    bridgeKey,
    prompt,
    stagedEntryIds: entries.map((e) => e.id),
    directive,
    timestamp: Date.now(),
    tokenEstimate,
  };
}

/**
 * Parse and sanitize AI response from clipboard
 */
export function parseAIResponse(rawText: string): {
  content: string;
  bridgeKey: string | null;
} {
  let content = rawText;

  // Extract bridge key using robust regex
  const bridgePattern =
    /(?:<|&lt;)!-{2}\s*bridge\s*:\s*([a-zA-Z0-9]+)\s*-{2}(?:>|&gt;)/i;
  const match = content.match(bridgePattern);
  const bridgeKey = match ? match[1].toLowerCase() : null;

  // Remove bridge key from content
  content = content.replace(bridgePattern, '').trim();

  // Remove common HTML artifacts
  content = content
    .replace(/<div[^>]*>/gi, '')
    .replace(/<\/div>/gi, '\n')
    .replace(/<span[^>]*>/gi, '')
    .replace(/<\/span>/gi, '')
    .replace(/<p[^>]*>/gi, '')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/style="[^"]*"/gi, '')
    .replace(/class="[^"]*"/gi, '');

  // Remove AI boilerplate patterns
  const boilerplatePatterns = [
    /^Here's my analysis:\s*/i,
    /^Based on the context you provided[,.]?\s*/i,
    /^I apologize, but\s*/i,
    /^Let me analyze this[.:]?\s*/i,
  ];

  for (const pattern of boilerplatePatterns) {
    content = content.replace(pattern, '');
  }

  // Normalize whitespace
  content = content
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\s+|\s+$/g, '');

  return { content, bridgeKey };
}

/**
 * Convert parsed content to ProseMirror JSON
 */
export function contentToProseMirror(content: string): JSONContent {
  // Simple conversion - in production you'd use a proper markdown parser
  const lines = content.split('\n');
  const nodes: JSONContent[] = [];
  let currentParagraph: string[] = [];

  const flushParagraph = () => {
    if (currentParagraph.length > 0) {
      const text = currentParagraph.join('\n').trim();
      if (text) {
        nodes.push({
          type: 'paragraph',
          content: [{ type: 'text', text }],
        });
      }
      currentParagraph = [];
    }
  };

  for (const line of lines) {
    // Check for headings
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      flushParagraph();
      nodes.push({
        type: 'heading',
        attrs: { level: headingMatch[1].length },
        content: [{ type: 'text', text: headingMatch[2] }],
      });
      continue;
    }

    // Check for code blocks
    if (line.startsWith('```')) {
      flushParagraph();
      // Simplified: would need proper multi-line handling
      continue;
    }

    // Check for horizontal rules
    if (line.match(/^-{3,}$/) || line.match(/^_{3,}$/) || line.match(/^\*{3,}$/)) {
      flushParagraph();
      nodes.push({ type: 'horizontalRule' });
      continue;
    }

    // Check for list items
    const listMatch = line.match(/^[-*]\s+(.+)$/);
    if (listMatch) {
      flushParagraph();
      nodes.push({
        type: 'bulletList',
        content: [
          {
            type: 'listItem',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: listMatch[1] }],
              },
            ],
          },
        ],
      });
      continue;
    }

    // Empty line = paragraph break
    if (line.trim() === '') {
      flushParagraph();
      continue;
    }

    // Regular text
    currentParagraph.push(line);
  }

  flushParagraph();

  // Ensure at least one empty paragraph
  if (nodes.length === 0) {
    nodes.push({
      type: 'paragraph',
      content: [],
    });
  }

  return {
    type: 'doc',
    content: nodes,
  };
}
