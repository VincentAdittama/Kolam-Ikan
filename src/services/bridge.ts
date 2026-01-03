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
        case 'heading': {
          const level = node.attrs?.level || 1;
          text += '#'.repeat(level) + ' ' + nodeText + '\n\n';
          break;
        }
        case 'bulletList':
        case 'orderedList':
          text += nodeText + '\n';
          break;
        case 'listItem':
          text += '- ' + nodeText + '\n';
          break;
        case 'codeBlock': {
          const lang = node.attrs?.language || '';
          text += '```' + lang + '\n' + nodeText + '\n```\n\n';
          break;
        }
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
 * Mark type for ProseMirror text marks
 */
interface Mark {
  type: string;
  attrs?: Record<string, unknown>;
}

/**
 * Parse inline markdown formatting (bold, italic, code, links)
 */
function parseInlineFormatting(text: string): JSONContent[] {
  const result: JSONContent[] = [];
  
  // Regex patterns for inline elements
  // Order matters: more specific patterns first
  const patterns = [
    // Bold + Italic: ***text*** or ___text___
    { regex: /\*\*\*(.+?)\*\*\*|___(.+?)___/g, marks: ['bold', 'italic'] },
    // Bold: **text** or __text__
    { regex: /\*\*(.+?)\*\*|__(.+?)__/g, marks: ['bold'] },
    // Italic: *text* or _text_ (but not inside words for underscore)
    { regex: /\*(.+?)\*|(?<!\w)_(.+?)_(?!\w)/g, marks: ['italic'] },
    // Inline code: `code`
    { regex: /`([^`]+)`/g, marks: ['code'] },
    // Links: [text](url)
    { regex: /\[([^\]]+)\]\(([^)]+)\)/g, marks: ['link'], hasHref: true },
  ];

  // Simple approach: process text character by character looking for patterns
  let remaining = text;
  
  while (remaining.length > 0) {
    let earliestMatch: { index: number; length: number; content: string; marks: Mark[]; } | null = null;
    
    for (const pattern of patterns) {
      pattern.regex.lastIndex = 0;
      const match = pattern.regex.exec(remaining);
      
      if (match && (earliestMatch === null || match.index < earliestMatch.index)) {
        const content = match[1] || match[2] || '';
        const marks: Mark[] = pattern.marks.map(mark => {
          if (mark === 'link' && pattern.hasHref) {
            return { type: 'link', attrs: { href: match[2], target: '_blank' } };
          }
          return { type: mark };
        });
        
        // For links, content is match[1] (the link text)
        const actualContent = pattern.hasHref ? match[1] : content;
        
        earliestMatch = {
          index: match.index,
          length: match[0].length,
          content: actualContent,
          marks,
        };
      }
    }
    
    if (earliestMatch && earliestMatch.index >= 0) {
      // Add plain text before the match
      if (earliestMatch.index > 0) {
        result.push({ type: 'text', text: remaining.slice(0, earliestMatch.index) });
      }
      
      // Add the formatted text
      if (earliestMatch.content) {
        result.push({
          type: 'text',
          text: earliestMatch.content,
          marks: earliestMatch.marks,
        });
      }
      
      remaining = remaining.slice(earliestMatch.index + earliestMatch.length);
    } else {
      // No more patterns found, add remaining text
      if (remaining) {
        result.push({ type: 'text', text: remaining });
      }
      break;
    }
  }
  
  return result.length > 0 ? result : [];
}

/**
 * Parse a single line and return inline content with formatting
 */
function parseLineContent(text: string): JSONContent[] {
  if (!text || text.trim() === '') return [];
  return parseInlineFormatting(text);
}

/**
 * Detect list item type and extract content
 */
interface ListItemInfo {
  type: 'bullet' | 'ordered' | 'task';
  indent: number;
  content: string;
  orderNumber?: number;
  checked?: boolean;
}

function parseListItem(line: string): ListItemInfo | null {
  // Task list: - [ ] or - [x]
  const taskMatch = line.match(/^(\s*)-\s+\[([ xX])\]\s+(.*)$/);
  if (taskMatch) {
    return {
      type: 'task',
      indent: taskMatch[1].length,
      content: taskMatch[3],
      checked: taskMatch[2].toLowerCase() === 'x',
    };
  }
  
  // Ordered list: 1. or 1)
  const orderedMatch = line.match(/^(\s*)(\d+)[.)]\s+(.*)$/);
  if (orderedMatch) {
    return {
      type: 'ordered',
      indent: orderedMatch[1].length,
      content: orderedMatch[3],
      orderNumber: parseInt(orderedMatch[2], 10),
    };
  }
  
  // Bullet list: - or * or +
  const bulletMatch = line.match(/^(\s*)[-*+]\s+(.*)$/);
  if (bulletMatch) {
    return {
      type: 'bullet',
      indent: bulletMatch[1].length,
      content: bulletMatch[2],
    };
  }
  
  return null;
}

/**
 * Convert parsed content to ProseMirror JSON
 */
export function contentToProseMirror(content: string): JSONContent {
  const lines = content.split('\n');
  const nodes: JSONContent[] = [];
  let i = 0;

  const parseBlockquote = (startIndex: number): { node: JSONContent; endIndex: number } => {
    const quoteContent: string[] = [];
    let idx = startIndex;
    
    while (idx < lines.length) {
      const line = lines[idx];
      const quoteMatch = line.match(/^>\s?(.*)$/);
      if (quoteMatch) {
        quoteContent.push(quoteMatch[1]);
        idx++;
      } else {
        break;
      }
    }
    
    // Recursively parse the blockquote content
    const innerContent = contentToProseMirror(quoteContent.join('\n'));
    
    return {
      node: {
        type: 'blockquote',
        content: innerContent.content,
      },
      endIndex: idx,
    };
  };

  const parseCodeBlock = (startIndex: number): { node: JSONContent; endIndex: number } => {
    const firstLine = lines[startIndex];
    const langMatch = firstLine.match(/^```(\w*)$/);
    const language = langMatch ? langMatch[1] : '';
    
    const codeLines: string[] = [];
    let idx = startIndex + 1;
    
    while (idx < lines.length && !lines[idx].match(/^```$/)) {
      codeLines.push(lines[idx]);
      idx++;
    }
    
    // Skip closing ```
    if (idx < lines.length) idx++;
    
    return {
      node: {
        type: 'codeBlock',
        attrs: { language },
        content: codeLines.length > 0 ? [{ type: 'text', text: codeLines.join('\n') }] : [],
      },
      endIndex: idx,
    };
  };

  const parseList = (startIndex: number): { node: JSONContent; endIndex: number } => {
    const items: JSONContent[] = [];
    let idx = startIndex;
    let listType: 'bulletList' | 'orderedList' | 'taskList' | null = null;
    let baseIndent: number | null = null;
    
    while (idx < lines.length) {
      const line = lines[idx];
      const itemInfo = parseListItem(line);
      
      if (!itemInfo) {
        // Check if it's a continuation of the previous item (indented text)
        if (line.match(/^\s{2,}/) && items.length > 0) {
          // This is a continuation - skip for now (simplified)
          idx++;
          continue;
        }
        break;
      }
      
      if (baseIndent === null) {
        baseIndent = itemInfo.indent;
        listType = itemInfo.type === 'ordered' ? 'orderedList' : 
                   itemInfo.type === 'task' ? 'taskList' : 'bulletList';
      }
      
      // If indent is greater, it's a nested list - handle recursively
      if (itemInfo.indent > baseIndent) {
        // Nested list - parse it
        const nested = parseList(idx);
        if (items.length > 0) {
          const lastItem = items[items.length - 1];
          if (lastItem.content) {
            lastItem.content.push(nested.node);
          }
        }
        idx = nested.endIndex;
        continue;
      }
      
      // If indent is less, we're done with this list
      if (itemInfo.indent < baseIndent) {
        break;
      }
      
      // Same indent level - add item
      const itemContent = parseLineContent(itemInfo.content);
      const listItem: JSONContent = {
        type: itemInfo.type === 'task' ? 'taskItem' : 'listItem',
        content: [
          {
            type: 'paragraph',
            content: itemContent,
          },
        ],
      };
      
      if (itemInfo.type === 'task') {
        listItem.attrs = { checked: itemInfo.checked };
      }
      
      items.push(listItem);
      idx++;
    }
    
    return {
      node: {
        type: listType || 'bulletList',
        content: items,
      },
      endIndex: idx,
    };
  };

  while (i < lines.length) {
    const line = lines[i];
    
    // Empty line
    if (line.trim() === '') {
      i++;
      continue;
    }
    
    // Heading
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const headingContent = parseLineContent(headingMatch[2]);
      nodes.push({
        type: 'heading',
        attrs: { level: headingMatch[1].length },
        content: headingContent,
      });
      i++;
      continue;
    }
    
    // Code block
    if (line.match(/^```/)) {
      const result = parseCodeBlock(i);
      nodes.push(result.node);
      i = result.endIndex;
      continue;
    }
    
    // Horizontal rule
    if (line.match(/^[-_*]{3,}\s*$/)) {
      nodes.push({ type: 'horizontalRule' });
      i++;
      continue;
    }
    
    // Blockquote
    if (line.match(/^>/)) {
      const result = parseBlockquote(i);
      nodes.push(result.node);
      i = result.endIndex;
      continue;
    }
    
    // List
    if (parseListItem(line)) {
      const result = parseList(i);
      nodes.push(result.node);
      i = result.endIndex;
      continue;
    }
    
    // Regular paragraph - collect consecutive non-empty, non-special lines
    const paragraphLines: string[] = [];
    while (i < lines.length) {
      const pLine = lines[i];
      // Stop if empty line or special line
      if (pLine.trim() === '' || 
          pLine.match(/^#{1,6}\s/) ||
          pLine.match(/^```/) ||
          pLine.match(/^[-_*]{3,}\s*$/) ||
          pLine.match(/^>/) ||
          parseListItem(pLine)) {
        break;
      }
      paragraphLines.push(pLine);
      i++;
    }
    
    if (paragraphLines.length > 0) {
      const fullText = paragraphLines.join(' ');
      const paragraphContent = parseLineContent(fullText);
      nodes.push({
        type: 'paragraph',
        content: paragraphContent.length > 0 ? paragraphContent : [],
      });
    }
  }

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
