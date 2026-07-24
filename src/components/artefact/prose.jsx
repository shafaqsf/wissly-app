import katex from 'katex';

/* Generated content arrives as plain strings — every Stage 1 payload field is
   one. Three things inside a string still need rendering, and all three are
   routine in a learning tool rather than an edge case:

     $tex$          inline mathematics
     $$tex$$        a display formula, alone on its own line
     ```lang        a fenced code block

   Blank lines separate paragraphs. Nothing else is markup, so a payload
   survives a round trip through the database and a prompt unchanged. */

// Keywords are the only thing weight distinguishes. Hue is not available and
// would not be used if it were — see docs/DESIGN.md.
const KEYWORDS = {
  python: ['def', 'return', 'import', 'from', 'class', 'if', 'else', 'elif', 'for', 'while', 'in', 'not', 'and', 'or', 'None', 'True', 'False', 'lambda', 'yield', 'with', 'as'],
  javascript: ['const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'class', 'new', 'import', 'export', 'from', 'default', 'await', 'async', 'null', 'true', 'false'],
  sql: ['select', 'from', 'where', 'join', 'on', 'group', 'by', 'order', 'insert', 'update', 'delete', 'create', 'table', 'and', 'or', 'not'],
};

const COMMENT_MARKERS = { python: '#', javascript: '//', sql: '--' };

function renderTex(tex, displayMode) {
  try {
    return katex.renderToString(tex, {
      displayMode,
      // MathML would repeat the raw TeX in the accessibility tree; the label
      // on the wrapper says it better.
      output: 'html',
      throwOnError: true,
    });
  } catch {
    return null;
  }
}

export function Formula({ tex, display = false }) {
  const html = renderTex(tex, display);

  if (html === null) {
    return (
      <span
        role="alert"
        className="block border-l-2 border-ink pl-3 text-body-s text-ink"
      >
        This formula could not be rendered. The source text is shown instead.{' '}
        <code className="font-mono text-caption">{tex}</code>
      </span>
    );
  }

  return (
    <span
      role="math"
      aria-label={tex}
      // KaTeX escapes its input and refuses `\href` and friends unless
      // `trust` is set, which it is not. The string is markup it built, not
      // markup the model wrote.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

/* Splits a string into plain runs and `$tex$` formulae. Exported because a
   glossary definition and a rationale are one line each and want no <p>. */
export function renderInline(text) {
  const parts = [];
  const pattern = /\$([^$]+)\$/g;
  let cursor = 0;
  let match;
  let key = 0;

  while ((match = pattern.exec(String(text ?? ''))) !== null) {
    if (match.index > cursor) parts.push(text.slice(cursor, match.index));
    parts.push(<Formula key={`m${key++}`} tex={match[1]} />);
    cursor = match.index + match[0].length;
  }

  if (cursor < String(text ?? '').length) parts.push(text.slice(cursor));
  return parts;
}

function CodeLine({ line, language }) {
  const marker = COMMENT_MARKERS[language];
  const at = marker ? line.indexOf(marker) : -1;
  const code = at === -1 ? line : line.slice(0, at);
  const comment = at === -1 ? '' : line.slice(at);
  const keywords = KEYWORDS[language] ?? [];

  return (
    <span className="block">
      {code.split(/(\W+)/).map((token, index) =>
        keywords.includes(token) ? (
          <span key={index} className="font-bold">
            {token}
          </span>
        ) : (
          <span key={index}>{token}</span>
        ),
      )}
      {comment ? <span className="italic text-ink-muted">{comment}</span> : null}
    </span>
  );
}

/* Splits a payload string into blocks: fenced code, display formulae and
   paragraphs, in the order they were written. */
export function toBlocks(text) {
  const blocks = [];

  for (const chunk of String(text ?? '').split(/\n{2,}/)) {
    const trimmed = chunk.trim();
    if (trimmed === '') continue;

    const fence = trimmed.match(/^```(\w*)\n([\s\S]*?)\n?```$/);
    if (fence) {
      blocks.push({ type: 'code', language: fence[1] || 'text', code: fence[2] });
      continue;
    }

    const display = trimmed.match(/^\$\$([\s\S]+)\$\$$/);
    if (display) {
      blocks.push({ type: 'math', tex: display[1].trim() });
      continue;
    }

    blocks.push({ type: 'paragraph', text: trimmed });
  }

  return blocks;
}

export default function Prose({ text, className = '' }) {
  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      {toBlocks(text).map((block, index) => {
        if (block.type === 'code') {
          return (
            <pre
              key={index}
              className="overflow-x-auto border border-rule bg-paper-sunk p-4"
            >
              <code className="font-mono text-body-s text-ink">
                {block.code.split('\n').map((line, lineIndex) => (
                  <CodeLine key={lineIndex} line={line} language={block.language} />
                ))}
              </code>
            </pre>
          );
        }

        if (block.type === 'math') {
          return (
            <span key={index} className="block max-w-measure overflow-x-auto py-2">
              <Formula tex={block.tex} display />
            </span>
          );
        }

        return (
          <p key={index} className="max-w-measure text-body">
            {renderInline(block.text)}
          </p>
        );
      })}
    </div>
  );
}
