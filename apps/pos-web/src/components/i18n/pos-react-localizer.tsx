"use client";

import {
  Children,
  cloneElement,
  isValidElement,
  useCallback,
  type ReactElement,
  type ReactNode,
} from "react";
import { useTranslation } from "@cleanhub/i18n/react";

import { translatePosText } from "./pos-runtime-text";

const TRANSLATABLE_PROPS = [
  "aria-label",
  "alt",
  "placeholder",
  "title",
] as const;

type PosReactLocalizerProps = {
  children: ReactNode;
};

type ElementProps = {
  children?: ReactNode;
  [key: string]: unknown;
};

export function PosReactLocalizer({ children }: PosReactLocalizerProps) {
  const { locale } = useTranslation();

  const translateText = useCallback(
    (value: string): string => translatePosText(value, locale),
    [locale],
  );

  const translateNode = useCallback(
    function translateNode(node: ReactNode): ReactNode {
      if (typeof node === "string") {
        return translateText(node);
      }

      if (Array.isArray(node)) {
        return node.map((child) => translateNode(child));
      }

      if (!isValidElement(node)) {
        return node;
      }

      const element = node as ReactElement<ElementProps>;
      const props = element.props;
      const nextProps: ElementProps = {};
      let changed = false;

      for (const propName of TRANSLATABLE_PROPS) {
        const propValue = props[propName];
        if (typeof propValue === "string") {
          const translated = translateText(propValue);
          if (translated !== propValue) {
            nextProps[propName] = translated;
            changed = true;
          }
        }
      }

      if (props.children !== undefined) {
        const nextChildren = Children.map(props.children, (child) =>
          translateNode(child),
        );
        nextProps.children = nextChildren;
        changed = true;
      }

      return changed ? cloneElement(element, nextProps) : element;
    },
    [translateText],
  );

  return <>{Children.map(children, (child) => translateNode(child))}</>;
}
