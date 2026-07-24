import katex from 'katex';
import CitationAnchor from './citation-anchor';

/* Generated content arrives as blocks. Four kinds cover Stage 1: a paragraph
   of running text, a display formula, a code listing and a table.

   Inline, a paragraph may carry `$tex$` for mathematics and `[[1]]` for a
   citation. Both are markers rather than markup, so a payload stays a plain
   string in the database and in a prompt. */

const MEASURE = 'max-w-measure';

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

function Formula({ tex, label, display = false }) {
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
      aria-label={label ?? tex}
      // KaTeX escapes its input and refuses `\href` and friends unless
      // `trust` is set, which it is not. The string is markup it built, not
      // markup the model wrote.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

/* Splits `text` into plain runs, `$tex$` formulae and `[[n]]` citations. */
function inline(text, sources) {
  const parts = [];
  const pattern = /\$([^$]+)\$|\[\[(\d+)\]\]/g;
  let cursor = 0;
  let match;
  let key = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > cursor) parts.push(text.slice(cursor, match.index));

    if (match[1] !== undefined) {
      parts.push(<Formula key={`m${key++}`} tex={match[1]} />);
    } else {
      const number = Number(match[2]);
      const source = sources.find((item) => item.number === number);
      parts.push(<CitationAnchor key={`c${key++}`} source={source} />);
    }

    cursor = match.index + match[0].length;
  }

  if (cursor < text.length) parts.push(text.slice(cursor));
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

function Block({ block, sources }) {
  if (block.type === 'paragraph') {
    return <p className={`${MEASURE} text-body`}>{inline(block.text, sources)}</p>;
  }

  if (block.type === 'math') {
    return (
      <span className={`${MEASURE} block overflow-x-auto py-2`}>
        <Formula tex={block.tex} label={block.label} display />
      </span>
    );
  }

  if (block.type === 'code') {
    return (
      <pre className="overflow-x-auto border border-rule bg-paper-sunk p-4">
        <code className="font-mono text-body-s text-ink">
          {block.code.split('\n').map((line, index) => (
            <CodeLine key={index} line={line} language={block.language} />
          ))}
        </code>
      </pre>
    );
  }

  if (block.type === 'table') {
    return (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-body-s">
          <thead>
            <tr>
              {block.head.map((cell) => (
                <th
                  key={cell}
                  scope="col"
                  className="border-b border-ink py-2 pr-4 text-left font-mono text-label uppercase"
                >
                  {cell}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, index) => (
              <tr key={index}>
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className="border-b border-rule py-2 pr-4 align-top">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return null;
}

export default function Prose({ blocks = [], sources = [], className = '' }) {
  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      {blocks.map((block, index) => (
        <Block key={index} block={block} sources={sources} />
      ))}
    </div>
  );
}

export { inline as renderInline };
