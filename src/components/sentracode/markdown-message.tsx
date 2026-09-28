"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function MarkdownMessage({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: (p) => <h1 className="mt-4 mb-2 text-lg font-semibold" {...p} />,
        h2: (p) => <h2 className="mt-4 mb-2 text-base font-semibold" {...p} />,
        h3: (p) => <h3 className="mt-3 mb-1 text-sm font-semibold uppercase tracking-wide opacity-80" {...p} />,
        p:  (p) => <p className="my-2 leading-relaxed" {...p} />,
        ul: (p) => <ul className="my-2 ml-5 list-disc space-y-1" {...p} />,
        ol: (p) => <ol className="my-2 ml-5 list-decimal space-y-1" {...p} />,
        li: (p) => <li className="leading-relaxed" {...p} />,
        strong: (p) => <strong className="font-semibold" {...p} />,
        hr: () => <hr className="my-4 border-white/10" />,
        a:  (p) => <a className="underline underline-offset-2" target="_blank" rel="noreferrer" {...p} />,
        blockquote: (p) => (
          <blockquote className="my-2 border-l-2 border-white/20 pl-3 italic opacity-90" {...p} />
        ),
        code: ({ className, children, ...rest }) => {
          const isBlock = /language-/.test(className ?? "");
          return isBlock ? (
            <pre className="my-3 overflow-x-auto rounded-lg bg-black/40 p-3 text-xs">
              <code className={className} {...rest}>{children}</code>
            </pre>
          ) : (
            <code className="rounded bg-white/10 px-1.5 py-0.5 text-[0.85em]" {...rest}>
              {children}
            </code>
          );
        },
        table: (p) => (
          <div className="my-3 overflow-x-auto rounded-lg border border-white/10">
            <table className="w-full border-collapse text-sm" {...p} />
          </div>
        ),
        thead: (p) => <thead className="bg-white/5" {...p} />,
        th: (p) => <th className="border-b border-white/10 px-3 py-2 text-left font-semibold" {...p} />,
        td: (p) => <td className="border-b border-white/5 px-3 py-2 align-top" {...p} />,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}