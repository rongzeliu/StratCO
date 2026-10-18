import ReactMarkdown, { type Components } from "react-markdown";

// react-markdown passes a `node` prop to custom components; drop it so it
// never reaches the DOM.
function clean<P extends { node?: unknown }>(props: P): Omit<P, "node"> {
  const copy = { ...props };
  delete copy.node;
  return copy;
}

const components: Components = {
  h1: (props) => (
    <h2
      className="mt-6 mb-2 text-section-title first:mt-0"
      {...clean(props)}
    />
  ),
  h2: (props) => (
    <h2
      className="mt-6 mb-2 text-section-title first:mt-0"
      {...clean(props)}
    />
  ),
  h3: (props) => (
    <h3
      className="mt-4 mb-1.5 text-base font-semibold first:mt-0"
      {...clean(props)}
    />
  ),
  p: (props) => <p className="my-3 text-body" {...clean(props)} />,
  ul: (props) => (
    <ul className="my-3 list-disc space-y-1.5 pl-5 text-body" {...clean(props)} />
  ),
  ol: (props) => (
    <ol
      className="my-3 list-decimal space-y-1.5 pl-5 text-body"
      {...clean(props)}
    />
  ),
  li: (props) => <li className="leading-relaxed" {...clean(props)} />,
  blockquote: (props) => (
    <blockquote
      className="my-4 border-l-2 border-border pl-4 text-secondary"
      {...clean(props)}
    />
  ),
  code: (props) => (
    <code
      className="rounded-[10px] bg-secondary px-1.5 py-0.5 text-[0.9em]"
      {...clean(props)}
    />
  ),
  strong: (props) => <strong className="font-semibold" {...clean(props)} />,
  a: (props) => (
    <a
      className="text-primary underline underline-offset-4"
      target="_blank"
      rel="noreferrer"
      {...clean(props)}
    />
  ),
};

function formatTextToken(raw: string): string {
  const unescaped = raw.replace(/\\_/g, "_").trim();
  if (/^[A-Za-z0-9]+(?:_[A-Za-z0-9]+)+$/.test(unescaped)) {
    return `\`${unescaped}\``;
  }
  return unescaped.replace(
    /\b([A-Za-z0-9]+(?:_[A-Za-z0-9]+)+)\b/g,
    "`$1`",
  );
}

function formatInlineMath(markdown: string): string {
  return markdown.replace(
    /\$(?!\d[\d,.]*(?:\s|$|\/))((?:\\\$|[^$\n])+?)\$/g,
    (fullMatch, inner: string) => {
      if (
        !/\\(?:text|times|div|sum|frac|cdot|pm|le|ge|neq|approx|\$|_)/.test(
          inner,
        )
      ) {
        return fullMatch;
      }

      return inner
        .replace(/_\{\\text\{([^}]*)\}\}/g, (_, sub: string) => {
          return ` (${sub.replace(/\\_/g, "_").trim()})`;
        })
        .replace(/\\text\{([^}]*)\}/g, (_, text: string) => {
          return formatTextToken(text);
        })
        .replace(
          /\\frac\{([^}]*)\}\{([^}]*)\}/g,
          (_, num: string, den: string) => `${num.trim()} / ${den.trim()}`,
        )
        .replace(/\\times\b/g, "×")
        .replace(/\\div\b/g, "÷")
        .replace(/\\sum\b/g, "∑")
        .replace(/\\cdot\b/g, "·")
        .replace(/\\pm\b/g, "±")
        .replace(/\\le\b/g, "≤")
        .replace(/\\ge\b/g, "≥")
        .replace(/\\neq\b/g, "≠")
        .replace(/\\approx\b/g, "≈")
        .replace(/\\\$/g, "$")
        .replace(/\\_/g, "_")
        .replace(/\s+-\s+/g, " − ")
        .replace(/\s{2,}/g, " ")
        .trim();
    },
  );
}

export function Markdown({ children }: { children: string }) {
  return (
    <div className="max-w-[65ch] text-body">
      <ReactMarkdown components={components}>
        {formatInlineMath(children)}
      </ReactMarkdown>
    </div>
  );
}
