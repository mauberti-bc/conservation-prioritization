import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import { ReactNode } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { isInternalMarkdownHref, isSafeMarkdownHref, parseMarkdownBlocks } from 'utils/markdown';

interface MarkdownContentProps {
  markdown: string;
}

/**
 * Renders application-managed Markdown with shared document styling.
 *
 * @param {MarkdownContentProps} props Component props.
 * @returns {JSX.Element} Rendered Markdown content.
 */
export const MarkdownContent = ({ markdown }: MarkdownContentProps) => {
  const blocks = parseMarkdownBlocks(markdown);

  return (
    <Box
      data-testid="markdown-content"
      sx={{
        '& h1': { mb: 2 },
        '& h2': { mt: 4, mb: 1.5 },
        '& h3': { mt: 3, mb: 1 },
        '& p': { mb: 2, lineHeight: 1.7 },
        '& ul': { mt: 0, mb: 2, pl: 3 },
        '& li': { mb: 0.75, lineHeight: 1.6 },
      }}>
      {blocks.map((block, index) => {
        if (block.type === 'heading') {
          const variant = block.level === 1 ? 'h1' : block.level === 2 ? 'h2' : 'h3';

          return (
            <Typography key={index} component={variant} variant={variant}>
              {renderInlineMarkdown(block.text)}
            </Typography>
          );
        }

        if (block.type === 'list') {
          return (
            <Box key={index} component="ul">
              {block.items.map((item, itemIndex) => (
                <Typography key={itemIndex} component="li">
                  {renderInlineMarkdown(item)}
                </Typography>
              ))}
            </Box>
          );
        }

        return (
          <Typography key={index} component="p">
            {renderInlineMarkdown(block.text)}
          </Typography>
        );
      })}
    </Box>
  );
};

/**
 * Renders the supported inline Markdown subset.
 *
 * @param {string} text Raw inline Markdown text.
 * @returns {ReactNode[]} Rendered inline content.
 */
function renderInlineMarkdown(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const token = match[0];

    if (token.startsWith('**')) {
      parts.push(<strong key={parts.length}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith('*')) {
      parts.push(<em key={parts.length}>{token.slice(1, -1)}</em>);
    } else {
      parts.push(renderMarkdownLink(token, parts.length));
    }

    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

/**
 * Renders a safe Markdown link token.
 *
 * @param {string} token Raw Markdown link token.
 * @param {number} key React key.
 * @returns {ReactNode} Rendered link or text fallback for unsafe hrefs.
 */
function renderMarkdownLink(token: string, key: number): ReactNode {
  const match = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token);

  if (!match) {
    return token;
  }

  const label = match[1];
  const href = match[2].trim();

  if (!isSafeMarkdownHref(href)) {
    return label;
  }

  if (isInternalMarkdownHref(href)) {
    return (
      <Link key={key} component={RouterLink} to={href}>
        {label}
      </Link>
    );
  }

  return (
    <Link key={key} href={href} target={href.startsWith('#') ? undefined : '_blank'} rel="noopener noreferrer">
      {label}
    </Link>
  );
}
