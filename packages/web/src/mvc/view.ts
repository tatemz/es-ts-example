import type { Html } from "./html.ts";

export type HtmlSlotContent = Html | undefined;

export type View<Model, Slot = never> = [Slot] extends [never]
  ? (model: Model) => Html
  : (model: Model, slot?: Slot) => Html;
