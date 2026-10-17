import ReactMarkdown, { type Components } from "react-markdown";

// react-markdown passes a `node` prop to custom components; drop it so it
// never reaches the DOM.
function clean<P extends { node?: unknown }>(props: P): Omit<P, "node"> {
  const copy = { ...props };
  delete copy.node;
  return copy;
}

// Minimal typographic styles (no @tailwindcss/typography dependency).
// react-markdown does not render raw HTML by default, which is what we want.
const components: Components = {
  h1: (props) => (
    <h2 className="mt-6 mb-3 text-xl font-semibold first:mt-0" {...clean(props)} />
  ),
  h2: (props) => (
    <h2 className="mt-6 mb-3 text-lg font-semibold first:mt-0" {...clean(props)} />
  ),
  h3: (props) => (
    <h3 className="mt-5 mb-2 font-semibold first:mt-0" {...clean(props)} />
  ),
  p: (props) => <p className="my-3 leading-relaxed" {...clean(props)} />,
  ul: (props) => (
    <ul className="my-3 list-disc space-y-1 pl-5" {...clean(props)} />
  ),
  ol: (props) => (
    <ol className="my-3 list-decimal space-y-1 pl-5" {...clean(props)} />
  ),
  li: (props) => <li className="leading-relaxed" {...clean(props)} />,
  blockquote: (props) => (
    <blockquote
      className="my-4 border-l-2 pl-4 text-muted-foreground italic"
      {...clean(props)}
    />
  ),
  code: (props) => (
    <code
      className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em]"
      {...clean(props)}
    />
  ),
  strong: (props) => <strong className="font-semibold" {...clean(props)} />,
  a: (props) => (
    <a
      className="underline underline-offset-4"
      target="_blank"
      rel="noreferrer"
      {...clean(props)}
    />
  ),
};

export function Markdown({ children }: { children: string }) {
  return (
    <div className="text-sm">
      <ReactMarkdown components={components}>{children}</ReactMarkdown>
    </div>
  );
}
