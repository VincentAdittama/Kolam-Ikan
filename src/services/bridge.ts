import type { Entry, DirectiveType, BridgeExport } from "@/types";
import { DIRECTIVES } from "@/types";
import { estimateTokens } from "@/lib/utils";
import { generateBridgeKey as generateKey } from "./api";
import type { JSONContent } from "@tiptap/react";

/**
 * Convert ProseMirror JSON content to plain text for export
 */
function contentToText(content: JSONContent): string {
  if (!content) return "";

  let text = "";

  if (content.text) {
    text += content.text;
  }

  if (content.content && Array.isArray(content.content)) {
    for (const node of content.content) {
      const nodeText = contentToText(node);

      // Handle different node types
      switch (node.type) {
        case "paragraph":
          text += nodeText + "\n\n";
          break;
        case "heading": {
          const level = node.attrs?.level || 1;
          text += "#".repeat(level) + " " + nodeText + "\n\n";
          break;
        }
        case "bulletList":
        case "orderedList":
          text += nodeText + "\n";
          break;
        case "listItem":
          text += "- " + nodeText + "\n";
          break;
        case "codeBlock": {
          const lang = node.attrs?.language || "";
          text += "```" + lang + "\n" + nodeText + "\n```\n\n";
          break;
        }
        case "blockquote":
          text += "> " + nodeText.replace(/\n/g, "\n> ") + "\n\n";
          break;
        case "horizontalRule":
          text += "---\n\n";
          break;
        case "table":
          text += "\n" + nodeText + "\n";
          break;
        case "tableRow": {
          const cells =
            node.content?.map((cell) => contentToText(cell).trim()) || [];
          text += "| " + cells.join(" | ") + " |\n";
          // Add a separator row if this is a header row (contains tableHeader)
          const hasHeader = node.content?.some(
            (child) => child.type === "tableHeader"
          );
          if (hasHeader) {
            text += "| " + cells.map(() => "---").join(" | ") + " |\n";
          }
          break;
        }
        case "tableCell":
        case "tableHeader":
          text += nodeText.trim();
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

  return `<${entry.role}_entry id="${entry.id}" sequence="${
    entry.sequenceId
  }" timestamp="${timestamp}">
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
  const formattedEntries = entries.map(formatEntryForExport).join("\n\n");

  // Build the prompt - inject both staged blocks and bridge key
  const prompt = directiveConfig.template
    .replace("{STAGED_BLOCKS}", formattedEntries)
    .replace(/{BRIDGE_KEY}/g, bridgeKey);

  // Calculate token estimate
  const tokenEstimate = estimateTokens(prompt);

  // Store entry IDs with their current version numbers
  // Format: "entryId:versionNumber" - this allows synapse visualization
  // to point to the correct version that was staged
  const stagedEntryIds = entries.map((e) => `${e.id}:${e.versionHead}`);

  return {
    bridgeKey,
    prompt,
    stagedEntryIds,
    directive,
    timestamp: Date.now(),
    tokenEstimate,
  };
}

/**
 * Structured response from AI parsed from kolam_response envelope
 */
export interface ParsedAIResponse {
  content: string;
  bridgeKey: string | null;
  aiModel: string | null;
  directive: DirectiveType | null;
  summary: string | null;
  metadata: Record<string, string[]>; // changes, references, sources, etc.
  isStructured: boolean; // whether response was in proper kolam_response format
  parseWarnings: string[]; // any issues encountered during parsing
}

/**
 * Safely extract text between XML-like tags
 * Handles edge cases like newlines, whitespace, and missing tags
 */
function safeExtractTag(text: string, tagName: string): string | null {
  // Try multiple patterns from most specific to most lenient
  const patterns = [
    // Standard format: <tag>content</tag>
    new RegExp(`<${tagName}>([\\s\\S]*?)<\\/${tagName}>`, "i"),
    // With attributes: <tag attr="val">content</tag>
    new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i"),
    // Self-closing or malformed: <tag>content (no closing)
    new RegExp(
      `<${tagName}[^>]*>([\\s\\S]*?)(?=<[a-z_]+>|<\\/kolam_response>|$)`,
      "i"
    ),
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  return null;
}

/**
 * Format raw parse warnings into a user-friendly message
 */
export function formatParseErrors(warnings: string[]): string {
  if (!warnings || warnings.length === 0)
    return "Unknown error parsing response.";

  // Prioritize most critical errors
  if (warnings.some((w) => w.includes("placeholder markers"))) {
    return "The AI response contains placeholder tags (like [INSERT_KEY_HERE]). Please ask the AI to provide the actual bridge key.";
  }

  if (warnings.some((w) => w.includes("Invalid bridge key format"))) {
    const keyMatch = warnings
      .find((w) => w.includes("Invalid bridge key format"))
      ?.match(/"([^"]+)"/);
    const key = keyMatch ? keyMatch[1] : "unknown";
    return `The AI provided an invalid bridge key: "${key}". The key must be alphanumeric.`;
  }

  if (warnings.some((w) => w.includes("Missing bridge key"))) {
    return "The AI response is missing the 'bridge' attribute in the <kolam_response> tag.";
  }

  const missingTags = warnings
    .filter((w) => w.includes("Missing <"))
    .map((w) => w.match(/<([^>]+)>/)?.[0])
    .filter(Boolean);

  if (missingTags.length > 0) {
    return `The AI response is missing required tags: ${missingTags.join(
      ", "
    )}. Please ensure the AI uses the full <kolam_response> structure.`;
  }

  if (warnings.some((w) => w.includes("Content extraction failed"))) {
    return "Could not find any content to import. The AI response might be empty or severely malformed.";
  }

  return "The AI response format is incorrect. Please ensure the AI wraps its response in the <kolam_response> tag with all required sub-tags.";
}

/**
 * Parse and sanitize AI response from clipboard
 * Supports both legacy format (<!-- bridge:xxx -->) and new structured format
 * Designed to be robust and handle malformed AI responses gracefully
 */
export function parseAIResponse(rawText: string): ParsedAIResponse {
  let content = rawText;
  let bridgeKey: string | null = null;
  let aiModel: string | null = null;
  let directive: DirectiveType | null = null;
  let summary: string | null = null;
  const metadata: Record<string, string[]> = {};
  let isStructured = false;
  const parseWarnings: string[] = [];

  // Try to parse new structured format first
  // More lenient pattern - allows for whitespace variations and attribute order variations
  const kolamPatterns = [
    // Standard format
    /<kolam_response\s+bridge="([a-zA-Z0-9]+)"\s+directive="([A-Z]+)"[^>]*>([\s\S]*?)<\/kolam_response>/i,
    // Reversed attribute order
    /<kolam_response\s+directive="([A-Z]+)"\s+bridge="([a-zA-Z0-9]+)"[^>]*>([\s\S]*?)<\/kolam_response>/i,
    // Very lenient - just find the opening and closing tags
    /<kolam_response[^>]*>([\s\S]*?)<\/kolam_response>/i,
  ];

  let kolamMatch: RegExpMatchArray | null = null;
  let patternIndex = 0;

  for (let i = 0; i < kolamPatterns.length; i++) {
    kolamMatch = rawText.match(kolamPatterns[i]);
    if (kolamMatch) {
      patternIndex = i;
      break;
    }
  }

  if (kolamMatch) {
    isStructured = true;
    let innerContent: string;

    if (patternIndex === 0) {
      // Standard format
      bridgeKey = kolamMatch[1]?.toLowerCase() || null;
      directive = (kolamMatch[2]?.toUpperCase() as DirectiveType) || null;
      innerContent = kolamMatch[3] || "";
    } else if (patternIndex === 1) {
      // Reversed attribute order
      directive = (kolamMatch[1]?.toUpperCase() as DirectiveType) || null;
      bridgeKey = kolamMatch[2]?.toLowerCase() || null;
      innerContent = kolamMatch[3] || "";
    } else {
      // Very lenient - extract from attributes manually
      innerContent = kolamMatch[1] || "";

      // Try to extract bridge and directive from opening tag
      const openingTag = rawText.match(/<kolam_response([^>]*)>/i);
      if (openingTag) {
        const attrs = openingTag[1];
        const bridgeMatch = attrs.match(/bridge="([a-zA-Z0-9]+)"/i);
        const directiveMatch = attrs.match(/directive="([A-Z]+)"/i);
        bridgeKey = bridgeMatch ? bridgeMatch[1].toLowerCase() : null;
        directive = directiveMatch
          ? (directiveMatch[1].toUpperCase() as DirectiveType)
          : null;
      }
      parseWarnings.push("Used lenient parsing for kolam_response tag");
    }

    // Extract AI model - be lenient
    aiModel = safeExtractTag(innerContent, "ai_model");
    if (!aiModel) {
      parseWarnings.push("Could not extract ai_model");
    }

    // Extract summary - be lenient
    summary = safeExtractTag(innerContent, "summary");
    if (!summary) {
      parseWarnings.push("Could not extract summary");
    }

    // Extract main content - this is critical, try multiple approaches
    const extractedContent = safeExtractTag(innerContent, "content");
    if (extractedContent) {
      content = extractedContent;
    } else {
      // Fallback: try to find content between </summary> and <changes> or end
      const fallbackMatch = innerContent.match(
        /<\/summary>([\s\S]*?)(?:<changes>|<\/kolam_response>|$)/i
      );
      if (fallbackMatch && fallbackMatch[1]?.trim()) {
        content = fallbackMatch[1].trim();
        // Remove any stray content tags
        content = content.replace(/<\/?content>/gi, "").trim();
        parseWarnings.push("Used fallback content extraction");
      } else {
        // Last resort: use everything after summary, stripping known tags
        content = innerContent
          .replace(/<ai_model>[\s\S]*?<\/ai_model>/gi, "")
          .replace(/<summary>[\s\S]*?<\/summary>/gi, "")
          .replace(/<changes>[\s\S]*?<\/changes>/gi, "")
          .replace(/<references>[\s\S]*?<\/references>/gi, "")
          .replace(/<sources>[\s\S]*?<\/sources>/gi, "")
          .replace(/<\/?content>/gi, "")
          .trim();
        parseWarnings.push("Used last-resort content extraction");
      }
    }

    // Extract optional metadata sections (changes, references, sources)
    const metaSections = ["changes", "references", "sources"];
    for (const section of metaSections) {
      const sectionContent = safeExtractTag(innerContent, section);
      if (sectionContent) {
        // Parse as list items (lines starting with - or *)
        const items = sectionContent
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line.startsWith("-") || line.startsWith("*"))
          .map((line) => line.substring(1).trim())
          .filter((item) => item.length > 0);
        if (items.length > 0) {
          metadata[section] = items;
        }
      }
    }
  } else {
    // Fallback to legacy format: <!-- bridge:xxx -->
    const bridgePattern =
      /(?:<|&lt;)!-{2}\s*bridge\s*:\s*([a-zA-Z0-9]+)\s*-{2}(?:>|&gt;)/i;
    const match = content.match(bridgePattern);
    bridgeKey = match ? match[1].toLowerCase() : null;

    // Remove bridge key from content
    content = content.replace(bridgePattern, "").trim();

    // Also try to detect if this looks like a kolam_response that failed to parse
    if (
      rawText.includes("<kolam_response") ||
      rawText.includes("kolam_response>")
    ) {
      parseWarnings.push(
        "Detected kolam_response tags but failed to parse - using legacy fallback"
      );
    }
  }

  // Clean up HTML artifacts regardless of format
  content = content
    .replace(/<div[^>]*>/gi, "")
    .replace(/<\/div>/gi, "\n")
    .replace(/<span[^>]*>/gi, "")
    .replace(/<\/span>/gi, "")
    .replace(/<p[^>]*>/gi, "")
    .replace(/<\/p>/gi, "\n\n")
    // Only replace <br> with \n if it's not likely to be part of a markdown table line.
    // Markdown tables use <br> for internal cell line breaks.
    .split("\n")
    .map((line) => {
      if (line.includes("|")) return line;
      return line.replace(/<br\s*\/?>/gi, "\n");
    })
    .join("\n")
    .replace(/style="[^"]*"/gi, "")
    .replace(/class="[^"]*"/gi, "");

  // Remove AI boilerplate patterns (only for unstructured responses)
  if (!isStructured) {
    const boilerplatePatterns = [
      /^Here's my analysis:\s*/i,
      /^Based on the context you provided[,.]?\s*/i,
      /^I apologize, but\s*/i,
      /^Let me analyze this[.:]?\s*/i,
    ];

    for (const pattern of boilerplatePatterns) {
      content = content.replace(pattern, "");
    }
  }

  // Normalize whitespace
  content = content.replace(/\n{3,}/g, "\n\n").replace(/^\s+|\s+$/g, "");

  // Final safety check - ensure we have some content
  if (!content || content.length === 0) {
    content = rawText;
    parseWarnings.push("Content extraction failed completely - using raw text");
  }

  // STRICT VALIDATION: Reject malformed structured responses
  // A valid structured response MUST have:
  // 1. A valid alphanumeric bridge key (no placeholders like [INSERT_KEY_HERE])
  // 2. Required elements: ai_model, summary, and content
  if (isStructured) {
    const validationErrors: string[] = [];

    // Validate bridge key - must be alphanumeric only, no brackets or placeholders
    if (!bridgeKey) {
      validationErrors.push("Missing bridge key");
    } else if (!/^[a-zA-Z0-9]+$/.test(bridgeKey)) {
      validationErrors.push(`Invalid bridge key format: "${bridgeKey}"`);
    }

    // Check for placeholder patterns in the bridge attribute
    const openingTag = rawText.match(/<kolam_response([^>]*)>/i);
    if (openingTag) {
      const attrs = openingTag[1];
      // Detect placeholder patterns like [INSERT_KEY_HERE], {BRIDGE_KEY}, etc.
      if (/bridge=["'][^"']*[[]{}<>][^"']*["']/i.test(attrs)) {
        validationErrors.push("Bridge key contains placeholder markers");
      }
    }

    // Validate required elements
    if (!aiModel) {
      validationErrors.push("Missing <ai_model> element");
    }
    if (!summary) {
      validationErrors.push("Missing <summary> element");
    }

    // Check if content was properly extracted (not fallback)
    const contentWasFallback = parseWarnings.some(
      (w) =>
        w.includes("fallback content extraction") ||
        w.includes("last-resort content extraction")
    );
    if (contentWasFallback && !safeExtractTag(rawText, "content")) {
      validationErrors.push("Missing <content> element");
    }

    // If validation failed, reject as structured response
    if (validationErrors.length > 0) {
      console.warn(
        "[Bridge Parser] Structured response validation failed:",
        validationErrors
      );
      parseWarnings.push(...validationErrors);
      parseWarnings.push(
        "Response rejected - does not match required kolam_response format"
      );

      // Reset to unstructured state
      isStructured = false;
      bridgeKey = null;
      aiModel = null;
      directive = null;
      summary = null;

      // Use raw text as content (after cleaning)
      content = rawText
        .replace(/<kolam_response[^>]*>/gi, "")
        .replace(/<\/kolam_response>/gi, "")
        .replace(/<\/?ai_model>/gi, "")
        .replace(/<\/?summary>/gi, "")
        .replace(/<\/?content>/gi, "")
        .replace(/<\/?sources>/gi, "")
        .trim();
    }
  }

  // Log warnings for debugging
  if (parseWarnings.length > 0) {
    console.warn("[Bridge Parser] Warnings:", parseWarnings);
  }

  return {
    content,
    bridgeKey,
    aiModel,
    directive,
    summary,
    metadata,
    isStructured,
    parseWarnings,
  };
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
  interface Pattern {
    regex: RegExp;
    marks?: string[];
    hasHref?: boolean;
    nodeType?: string;
  }

  const patterns: Pattern[] = [
    // Bold + Italic: ***text*** or ___text___
    { regex: /\*\*\*(.+?)\*\*\*|___(.+?)___/g, marks: ["bold", "italic"] },
    // Bold: **text** or __text__
    { regex: /\*\*(.+?)\*\*|__(.+?)__/g, marks: ["bold"] },
    // Italic: *text* or _text_ (but not inside words for underscore)
    { regex: /\*(.+?)\*|(?<!\w)_(.+?)_(?!\w)/g, marks: ["italic"] },
    // Inline code: `code`
    { regex: /`([^`]+)`/g, marks: ["code"] },
    // Links: [text](url)
    { regex: /\[([^\]]+)\]\(([^)]+)\)/g, marks: ["link"], hasHref: true },
    // Hard break: <br>
    { regex: /<br\s*\/?>/gi, nodeType: "hardBreak" },
  ];

  // Simple approach: process text character by character looking for patterns
  let remaining = text;

  while (remaining.length > 0) {
    let earliestMatch: {
      index: number;
      length: number;
      content: string;
      marks?: Mark[];
      nodeType?: string;
    } | null = null;

    for (const pattern of patterns) {
      pattern.regex.lastIndex = 0;
      const match = pattern.regex.exec(remaining);

      if (
        match &&
        (earliestMatch === null || match.index < earliestMatch.index)
      ) {
        if (pattern.nodeType) {
          earliestMatch = {
            index: match.index,
            length: match[0].length,
            content: "",
            nodeType: pattern.nodeType,
          };
        } else {
          const content = match[1] || match[2] || "";
          const marks: Mark[] = (pattern.marks || []).map((mark) => {
            if (mark === "link" && pattern.hasHref) {
              return {
                type: "link",
                attrs: { href: match[2], target: "_blank" },
              };
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
    }

    if (earliestMatch && earliestMatch.index >= 0) {
      // Add plain text before the match
      if (earliestMatch.index > 0) {
        result.push({
          type: "text",
          text: remaining.slice(0, earliestMatch.index),
        });
      }

      // Add the formatted text or node
      if (earliestMatch.nodeType) {
        result.push({ type: earliestMatch.nodeType });
      } else if (earliestMatch.content) {
        result.push({
          type: "text",
          text: earliestMatch.content,
          marks: earliestMatch.marks,
        });
      }

      remaining = remaining.slice(earliestMatch.index + earliestMatch.length);
    } else {
      // No more patterns found, add remaining text
      if (remaining) {
        result.push({ type: "text", text: remaining });
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
  if (!text || text.trim() === "") return [];
  return parseInlineFormatting(text);
}

/**
 * Detect list item type and extract content
 */
interface ListItemInfo {
  type: "bullet" | "ordered" | "task";
  indent: number;
  content: string;
  orderNumber?: number;
  checked?: boolean;
}

function parseListItem(line: string): ListItemInfo | null {
  // Task list: - [ ] or - [x]
  const taskMatch = line.match(/^(\s*)-\s+\[([ xX])\]\s*(.*)$/);
  if (taskMatch) {
    return {
      type: "task",
      indent: taskMatch[1].length,
      content: taskMatch[3] || "",
      checked: taskMatch[2].toLowerCase() === "x",
    };
  }

  // Ordered list: 1. or 1)
  const orderedMatch = line.match(/^(\s*)(\d+)[.)]\s*(.*)$/);
  if (orderedMatch) {
    return {
      type: "ordered",
      indent: orderedMatch[1].length,
      content: orderedMatch[3] || "",
      orderNumber: parseInt(orderedMatch[2], 10),
    };
  }

  // Bullet list: - or * or +
  const bulletMatch = line.match(/^(\s*)[-*+]\s+(.*)$/);
  if (bulletMatch) {
    return {
      type: "bullet",
      indent: bulletMatch[1].length,
      content: bulletMatch[2] || "",
    };
  }

  return null;
}

/**
 * Convert parsed content to ProseMirror JSON
 */
export function contentToProseMirror(content: string): JSONContent {
  const lines = content.split("\n");
  const nodes: JSONContent[] = [];
  let i = 0;

  const parseBlockquote = (
    startIndex: number
  ): { node: JSONContent; endIndex: number } => {
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
    const innerContent = contentToProseMirror(quoteContent.join("\n"));

    return {
      node: {
        type: "blockquote",
        content: innerContent.content,
      },
      endIndex: idx,
    };
  };

  const parseCodeBlock = (
    startIndex: number
  ): { node: JSONContent; endIndex: number } => {
    const firstLine = lines[startIndex];
    const langMatch = firstLine.match(/^```(\w*)$/);
    const language = langMatch ? langMatch[1] : "";

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
        type: "codeBlock",
        attrs: { language },
        content:
          codeLines.length > 0
            ? [{ type: "text", text: codeLines.join("\n") }]
            : [],
      },
      endIndex: idx,
    };
  };

  const parseList = (
    startIndex: number
  ): { node: JSONContent; endIndex: number } => {
    const items: JSONContent[] = [];
    let idx = startIndex;
    let listType: "bulletList" | "orderedList" | "taskList" | null = null;
    let baseIndent: number | null = null;

    while (idx < lines.length) {
      const line = lines[idx];
      const itemInfo = parseListItem(line);

      if (!itemInfo) {
        // Handle empty lines (loose lists)
        if (line.trim() === "") {
          let peekIdx = idx + 1;
          while (peekIdx < lines.length && lines[peekIdx].trim() === "") {
            peekIdx++;
          }

          if (peekIdx < lines.length) {
            const nextLine = lines[peekIdx];
            const nextInfo = parseListItem(nextLine);

            // Check if next content belongs to this list
            if (baseIndent !== null) {
              if (nextInfo) {
                // If nested list item (indented deeper)
                if (nextInfo.indent > baseIndent) {
                  idx = peekIdx;
                  continue;
                }

                // If sibling list item (same indent) - must be same type for it to be the same list
                // (Markdown allows mixing types sometimes, but strict parsing is safer for structure)
                if (nextInfo.indent === baseIndent) {
                  const nextType =
                    nextInfo.type === "ordered"
                      ? "orderedList"
                      : nextInfo.type === "task"
                      ? "taskList"
                      : "bulletList";
                  if (nextType === listType) {
                    idx = peekIdx;
                    continue;
                  }
                }
              } else if (nextLine.match(/^\s+/)) {
                // Indented continuation text
                const indentMatch = nextLine.match(/^(\s+)/);
                const nextIndent = indentMatch ? indentMatch[1].length : 0;
                if (nextIndent > baseIndent) {
                  idx = peekIdx;
                  continue;
                }
              }
            }
          }
        }

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
        listType =
          itemInfo.type === "ordered"
            ? "orderedList"
            : itemInfo.type === "task"
            ? "taskList"
            : "bulletList";
      }

      const nextListType =
        itemInfo.type === "ordered"
          ? "orderedList"
          : itemInfo.type === "task"
          ? "taskList"
          : "bulletList";

      // If indent is significantly greater, it's a nested list
      // Only recurse if:
      // 1. It's a different list type (e.g., bullet inside ordered)
      // 2. The indent is at least 2 spaces deeper (standard for nesting)
      if (
        itemInfo.indent > baseIndent &&
        (nextListType !== listType || itemInfo.indent >= baseIndent + 2)
      ) {
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

      // If indent is significantly less, we're done with this list
      // Be lenient with small decreases unless it's a different type
      if (
        itemInfo.indent < baseIndent &&
        (nextListType !== listType || itemInfo.indent <= baseIndent - 2)
      ) {
        break;
      }

      // Same indent level (or close enough) - add item
      const itemContent = parseLineContent(itemInfo.content);
      const listItem: JSONContent = {
        type: itemInfo.type === "task" ? "taskItem" : "listItem",
        content: [
          {
            type: "paragraph",
            content: itemContent,
          },
        ],
      };

      if (itemInfo.type === "task") {
        listItem.attrs = { checked: itemInfo.checked };
      }

      items.push(listItem);
      idx++;
    }

    return {
      node: {
        type: listType || "bulletList",
        content: items,
      },
      endIndex: idx,
    };
  };

  while (i < lines.length) {
    const line = lines[i];

    // Empty line
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Heading
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const headingContent = parseLineContent(headingMatch[2]);
      nodes.push({
        type: "heading",
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
      nodes.push({ type: "horizontalRule" });
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

    // Table
    if (line.trim().startsWith("|") && line.includes("|")) {
      const parseTable = (
        startIndex: number
      ): { node: JSONContent; endIndex: number } => {
        let idx = startIndex;
        const tableRows: JSONContent[] = [];

        const splitRow = (rowLine: string) => {
          const cleaned = rowLine.trim().replace(/^\|/, "").replace(/\|$/, "");
          return cleaned.split("|").map((cell) => cell.trim());
        };

        const isSeparator = (rowLine: string) => {
          const cells = splitRow(rowLine);
          return (
            cells.length > 0 && cells.every((cell) => cell.match(/^:?-+:?$/))
          );
        };

        // Header or first row
        const firstCells = splitRow(lines[idx]);
        idx++;

        let hasHeader = false;
        if (idx < lines.length && isSeparator(lines[idx])) {
          hasHeader = true;
          idx++;
        }

        if (hasHeader) {
          tableRows.push({
            type: "tableRow",
            content: firstCells.map((cell) => {
              const cellContent = contentToProseMirror(
                cell.replace(/<br\s*\/?>/gi, "\n")
              ).content;
              return {
                type: "tableHeader",
                content:
                  cellContent && cellContent.length > 0
                    ? cellContent
                    : [{ type: "paragraph" }],
              };
            }),
          });
        } else {
          tableRows.push({
            type: "tableRow",
            content: firstCells.map((cell) => {
              const cellContent = contentToProseMirror(
                cell.replace(/<br\s*\/?>/gi, "\n")
              ).content;
              return {
                type: "tableCell",
                content:
                  cellContent && cellContent.length > 0
                    ? cellContent
                    : [{ type: "paragraph" }],
              };
            }),
          });
        }

        while (idx < lines.length) {
          const bodyLine = lines[idx];
          if (!bodyLine.trim().startsWith("|") && !bodyLine.includes("|"))
            break;
          if (isSeparator(bodyLine)) break;

          const cells = splitRow(bodyLine);
          tableRows.push({
            type: "tableRow",
            content: cells.map((cell) => {
              // Replace all <br> variations with \n for recursive parsing
              const normalizedContent = cell
                .replace(/<br\s*\/?>/gi, "\n")
                .trim();
              const result = contentToProseMirror(normalizedContent);

              // If the result is just a single paragraph, extract its contents
              // to keep the cell structure clean, but for complex content like lists,
              // keep the original structure. Tiptap cells need block elements.
              let cellNodes = result.content || [];
              if (cellNodes.length === 0) {
                cellNodes = [{ type: "paragraph" }];
              }

              return {
                type: "tableCell",
                content: cellNodes,
              };
            }),
          });
          idx++;
        }

        return {
          node: {
            type: "table",
            content: tableRows,
          },
          endIndex: idx,
        };
      };

      const result = parseTable(i);
      nodes.push(result.node);
      i = result.endIndex;
      continue;
    }

    // Regular paragraph - collect consecutive non-empty, non-special lines
    const paragraphLines: string[] = [];
    while (i < lines.length) {
      const pLine = lines[i];
      // Stop if empty line or special line
      if (
        pLine.trim() === "" ||
        pLine.match(/^#{1,6}\s/) ||
        pLine.match(/^```/) ||
        pLine.match(/^[-_*]{3,}\s*$/) ||
        pLine.match(/^>/) ||
        parseListItem(pLine)
      ) {
        break;
      }
      paragraphLines.push(pLine);
      i++;
    }

    if (paragraphLines.length > 0) {
      const fullText = paragraphLines.join(" ");
      const paragraphContent = parseLineContent(fullText);
      nodes.push({
        type: "paragraph",
        content: paragraphContent.length > 0 ? paragraphContent : [],
      });
    }
  }

  // Ensure at least one empty paragraph
  if (nodes.length === 0) {
    nodes.push({
      type: "paragraph",
      content: [],
    });
  }

  return {
    type: "doc",
    content: nodes,
  };
}
