import type { ReactNode } from "react";

import { translatePosText } from "../pos-runtime-text";

const TRANSLATABLE_PROPS = [
  "aria-label",
  "alt",
  "placeholder",
  "title",
] as const;

type JsxProps = {
  children?: ReactNode;
  [key: string]: unknown;
};

export function localizeJsxProps<TProps>(props: TProps): TProps {
  if (!props || typeof props !== "object") {
    return props;
  }

  const source = props as JsxProps;
  let next: JsxProps | null = null;

  function setProp(key: string, value: unknown): void {
    next ??= { ...source };
    next[key] = value;
  }

  if (source.children !== undefined) {
    const children = localizeNode(source.children);
    if (children !== source.children) {
      setProp("children", children);
    }
  }

  for (const propName of TRANSLATABLE_PROPS) {
    const propValue = source[propName];
    if (typeof propValue !== "string") {
      continue;
    }

    const translated = translatePosText(propValue);
    if (translated !== propValue) {
      setProp(propName, translated);
    }
  }

  return (next ?? source) as TProps;
}

function localizeNode(node: ReactNode): ReactNode {
  if (typeof node === "string") {
    return translatePosText(node);
  }

  if (Array.isArray(node)) {
    let changed = false;
    const next = node.map((child) => {
      const translated = localizeNode(child);
      if (translated !== child) {
        changed = true;
      }
      return translated;
    });

    return changed ? next : node;
  }

  return node;
}
