export type MarkdownBlock =
  | {
      type: 'heading';
      level: 1 | 2 | 3;
      text: string;
    }
  | {
      type: 'paragraph';
      text: string;
    }
  | {
      type: 'list';
      items: string[];
    };

/**
 * Parses the small Markdown subset supported by application-managed documents.
 *
 * Supports headings, paragraphs, and dash-prefixed unordered lists. Raw HTML is
 * not interpreted and remains plain text when rendered by React.
 *
 * @param {string} markdown Raw Markdown source.
 * @returns {MarkdownBlock[]} Ordered Markdown blocks ready for rendering.
 */
export function parseMarkdownBlocks(markdown: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  let paragraphLines: string[] = [];
  let listItems: string[] = [];

  const flushParagraph = () => {
    if (!paragraphLines.length) {
      return;
    }

    blocks.push({
      type: 'paragraph',
      text: paragraphLines.join(' ').trim(),
    });
    paragraphLines = [];
  };

  const flushList = () => {
    if (!listItems.length) {
      return;
    }

    blocks.push({
      type: 'list',
      items: listItems,
    });
    listItems = [];
  };

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (!trimmedLine) {
      flushParagraph();
      flushList();
      continue;
    }

    const headingMatch = /^(#{1,3})\s+(.+)$/.exec(trimmedLine);

    if (headingMatch) {
      flushParagraph();
      flushList();
      blocks.push({
        type: 'heading',
        level: headingMatch[1].length as 1 | 2 | 3,
        text: headingMatch[2].trim(),
      });
      continue;
    }

    const listMatch = /^-\s+(.+)$/.exec(trimmedLine);

    if (listMatch) {
      flushParagraph();
      listItems.push(listMatch[1].trim());
      continue;
    }

    flushList();
    paragraphLines.push(trimmedLine);
  }

  flushParagraph();
  flushList();

  return blocks;
}

/**
 * Checks whether a Markdown link href is safe for client-side rendering.
 *
 * @param {string} href Raw href from Markdown.
 * @returns {boolean} True when the href uses an allowed application or browser scheme.
 */
export function isSafeMarkdownHref(href: string): boolean {
  const trimmedHref = href.trim();

  if (trimmedHref.startsWith('/') && !trimmedHref.startsWith('//')) {
    return true;
  }

  if (trimmedHref.startsWith('#')) {
    return true;
  }

  try {
    const url = new URL(trimmedHref);
    return ['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol);
  } catch (_error) {
    return false;
  }
}

/**
 * Checks whether a Markdown link href points to an internal application route.
 *
 * @param {string} href Raw href from Markdown.
 * @returns {boolean} True when the href should use React Router navigation.
 */
export function isInternalMarkdownHref(href: string): boolean {
  const trimmedHref = href.trim();

  return trimmedHref.startsWith('/') && !trimmedHref.startsWith('//');
}
