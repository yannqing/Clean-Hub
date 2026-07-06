/* eslint-disable @typescript-eslint/no-empty-object-type, @typescript-eslint/no-namespace */
import {
  Fragment,
  jsxDEV as reactJsxDEV,
} from "react/jsx-dev-runtime";
import type { JSX as ReactJSX } from "react";

import { localizeJsxProps } from "./shared";

export { Fragment };

export namespace JSX {
  export type Element = ReactJSX.Element;
  export type ElementType = ReactJSX.ElementType;
  export interface ElementClass extends ReactJSX.ElementClass {}
  export interface ElementAttributesProperty
    extends ReactJSX.ElementAttributesProperty {}
  export interface ElementChildrenAttribute
    extends ReactJSX.ElementChildrenAttribute {}
  export interface IntrinsicAttributes
    extends ReactJSX.IntrinsicAttributes {}
  export interface IntrinsicClassAttributes<T>
    extends ReactJSX.IntrinsicClassAttributes<T> {}
  export interface IntrinsicElements extends ReactJSX.IntrinsicElements {}
}

export function jsxDEV(
  type: Parameters<typeof reactJsxDEV>[0],
  props: Parameters<typeof reactJsxDEV>[1],
  key: Parameters<typeof reactJsxDEV>[2],
  isStaticChildren: Parameters<typeof reactJsxDEV>[3],
  source: Parameters<typeof reactJsxDEV>[4],
  self: Parameters<typeof reactJsxDEV>[5],
) {
  return reactJsxDEV(
    type,
    localizeJsxProps(props),
    key,
    isStaticChildren,
    source,
    self,
  );
}
