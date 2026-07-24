import { articlesMessages } from "./articles.messages.ts";
import { counterMessages } from "./counter.messages.ts";
import * as I18n from "./I18n.ts";

const messages = {
  ...articlesMessages,
  ...counterMessages,
} as const;

export const webI18n = I18n.make({ messages });
