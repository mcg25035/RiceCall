/* eslint-disable @next/next/no-img-element */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import DOMPurify from 'dompurify';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

// Components
import emojis from '@/components/emojis';

// CSS
import markdown from '@/styles/viewers/markdown.module.css';

interface PurifyConfig {
  ALLOWED_TAGS: string[];
  ALLOWED_ATTR: string[];
  ALLOWED_URI_REGEXP: RegExp;
}

const PURIFY_CONFIG: PurifyConfig = {
  ALLOWED_TAGS: [
    'img',
    'p',
    'h1',
    'h2',
    'h3',
    'ul',
    'ol',
    'li',
    'blockquote',
    'a',
    'table',
    'thead',
    'tbody',
    'tr',
    'th',
    'td',
    'hr',
    'br',
    'strong',
    'em',
    'code',
    'pre',
    'video',
    'source',
    'audio',
    'iframe',
  ],
  ALLOWED_ATTR: [
    'src',
    'alt',
    'class',
    'href',
    'controls',
    'width',
    'height',
    'allowfullscreen',
    'type',
  ],
  ALLOWED_URI_REGEXP: /^(https?:\/\/)|^\/smiles\//,
};

interface MarkdownProps {
  markdownText: string;
  isGuest?: boolean;
  forbidGuestUrl?: boolean;
}

const customStyle = {
  keyword: { color: '#ff7b72' }, // 關鍵字
  string: { color: '#79c0ff' }, // 字串
  variable: { color: '#e6edf3' }, // 識別字、變數名稱、識別符號
  function: { color: '#d2a8ff' }, // 函數名稱
  operator: { color: '#e6edf3' }, // 運算子
  punctuation: { color: '#e6edf3' }, // 標點符號
  comment: { color: '#8b949e' }, // 註釋
};

const Markdown: React.FC<MarkdownProps> = React.memo(
  ({ markdownText, isGuest = false, forbidGuestUrl = false }) => {
    const safeMarkdownText =
      typeof markdownText === 'string' ? markdownText : '';
    const processedText = safeMarkdownText.replace(
      /^(>\s*.*(?:\n>.*)*)/gm,
      (match) => {
        const content = match
          .split('\n')
          .map((line) => line.replace(/^>\s*/, ''))
          .join(' ');
        return `> ${content}`;
      },
    );
    const withEmojis = processedText.replace(
      /\[emoji_(\d+)\]/g,
      (match: string, id: string) => {
        const emojiId = parseInt(id);
        if (!emojis.find((emoji) => emoji.id === emojiId)) return match;
        return `<img src="/smiles/${emojiId + 1}.gif" alt="[emoji_${id}]" />`;
      },
    );
    const withSoftBreaks = withEmojis.replace(/(?<!\n)\n(?!\n)/g, '<br />');
    const sanitized = DOMPurify.sanitize(withSoftBreaks, PURIFY_CONFIG);
    const [isCopied, setIsCopied] = useState(false);

    const components: Components = {
      h1: ({ node, ...props }: any) => (
        <h1 className={markdown.heading1} {...props} />
      ),
      h2: ({ node, ...props }: any) => (
        <h2 className={markdown.heading2} {...props} />
      ),
      h3: ({ node, ...props }: any) => (
        <h3 className={markdown.heading3} {...props} />
      ),
      p: ({ node, children, ...props }: any) => {
        const text = String(children);
        if (text.startsWith('> ')) {
          const quoteContent = text.replace(/^>\s*/, '');
          return (
            <blockquote className={markdown.blockquote}>
              <p>{quoteContent}</p>
            </blockquote>
          );
        }
        return (
          <p className={markdown.paragraph} {...props}>
            {children}
          </p>
        );
      },
      ul: ({ node, ...props }: any) => (
        <ul className={markdown.unorderedList} {...props} />
      ),
      ol: ({ node, ...props }: any) => (
        <ol className={markdown.orderedList} {...props} />
      ),
      li: ({ node, ...props }: any) => (
        <li className={markdown.listItem} {...props} />
      ),
      blockquote: ({ node, children, ...props }: any) => {
        return (
          <blockquote className={markdown.blockquote}>{children}</blockquote>
        );
      },
      a: ({ node, href, ...props }: any) => {
        if (isGuest && forbidGuestUrl) {
          return <span className={markdown.disabledLink} {...props} />;
        }
        return (
          <a target="_blank" href={href} className={markdown.link} {...props} />
        );
      },
      table: ({ node, ...props }: any) => (
        <div className={markdown.tableWrapper}>
          <table className={markdown.table} {...props} />
        </div>
      ),
      th: ({ node, ...props }: any) => (
        <th className={markdown.tableHeader} {...props} />
      ),
      td: ({ node, ...props }: any) => (
        <td className={markdown.tableCell} {...props} />
      ),
      hr: ({ node, ...props }: any) => (
        <hr className={markdown.horizontalRule} {...props} />
      ),
      img: ({ node, src, alt, ...props }: any) => {
        if (isGuest && forbidGuestUrl) {
          return <span className={markdown.disabledImage} {...props} />;
        }
        return (
          <img className={markdown.image} src={src} alt={alt} {...props} />
        );
      },
      code: ({ node, inline, className, children, ...props }: any) => {
        const match = /language-(\w+)/.exec(className || '');
        const language = match ? match[1] : 'text';

        if (!inline) {
          const codeString = String(children).replace(/\n$/, '');

          const handleCopy = () => {
            navigator.clipboard.writeText(codeString);
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
          };

          return (
            <div className={markdown.codeWrapper}>
              <button
                className={markdown.copyButton}
                onClick={handleCopy}
                aria-label="複製程式碼"
              >
                {isCopied ? '已複製！' : '複製'}
              </button>
              <SyntaxHighlighter
                language={language}
                style={{ ...vscDarkPlus, ...customStyle }}
                PreTag="div"
                className={markdown.codeBlock}
                {...props}
              >
                {codeString}
              </SyntaxHighlighter>
            </div>
          );
        }

        return (
          <code className={markdown.inlineCode} {...props}>
            {children}
          </code>
        );
      },
      pre: ({ node, ...props }: any) => (
        <pre className={markdown.preBlock} {...props} />
      ),
    };
    return (
      <ReactMarkdown
        className={markdown.markdownContent}
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={components}
        skipHtml={false}
        unwrapDisallowed={false}
      >
        {sanitized}
      </ReactMarkdown>
    );
  },
);

Markdown.displayName = 'Markdown';

interface MarkdownViewerProps {
  markdownText: string;
  isGuest?: boolean;
  forbidGuestUrl?: boolean;
}

const MarkdownViewer: React.FC<MarkdownViewerProps> = React.memo(
  ({ markdownText, isGuest = false, forbidGuestUrl = false }) => {
    return (
      <div className={markdown.container}>
        <div className={markdown.markdownContent}>
          <Markdown
            markdownText={markdownText}
            isGuest={isGuest}
            forbidGuestUrl={forbidGuestUrl}
          />
        </div>
      </div>
    );
  },
);

MarkdownViewer.displayName = 'MarkdownViewer';

export default MarkdownViewer;
