import clsx from "clsx";
import { Fragment, useMemo } from "react";

/** Pretty-printed, syntax-coloured JSON. Rendered as text nodes, never as HTML. */

const TOKEN_PATTERN = /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g;

function highlight(json: string) {
  const parts: JSX.Element[] = [];
  let lastIndex = 0;
  let key = 0;

  for (const match of json.matchAll(TOKEN_PATTERN)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      parts.push(<Fragment key={key++}>{json.slice(lastIndex, index)}</Fragment>);
    }
    const [text, stringToken, colon, literal, number] = match;
    if (stringToken !== undefined && colon !== undefined) {
      parts.push(
        <span key={key++} className="text-ink">
          {stringToken}
        </span>,
        <Fragment key={key++}>{colon}</Fragment>
      );
    } else if (stringToken !== undefined) {
      parts.push(
        <span key={key++} className="text-primary">
          {stringToken}
        </span>
      );
    } else if (literal !== undefined) {
      parts.push(
        <span key={key++} className="text-warn">
          {literal}
        </span>
      );
    } else if (number !== undefined) {
      parts.push(
        <span key={key++} className="text-info">
          {number}
        </span>
      );
    } else {
      parts.push(<Fragment key={key++}>{text}</Fragment>);
    }
    lastIndex = index + text.length;
  }
  if (lastIndex < json.length) {
    parts.push(<Fragment key={key++}>{json.slice(lastIndex)}</Fragment>);
  }
  return parts;
}

export function toJson(value: unknown): string {
  if (value === undefined) {
    return "";
  }
  return JSON.stringify(value, (_, item: unknown) => (typeof item === "bigint" ? item.toString() : item), 2);
}

export function JsonView({ value, className }: { value: unknown; className?: string }) {
  const content = useMemo(() => highlight(toJson(value)), [value]);

  if (value === undefined) {
    return <p className="text-xs text-ink-faint">No body.</p>;
  }
  return (
    <pre
      className={clsx(
        "overflow-auto whitespace-pre rounded-md bg-surface-base p-3 font-mono text-[12px] leading-5 text-ink-muted",
        className
      )}
    >
      {content}
    </pre>
  );
}
