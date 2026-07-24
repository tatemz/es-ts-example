import * as Schema from "effect/Schema";
import { ToggleArticleBookmarkCommand } from "./toggleArticleBookmark.ts";

export * from "./commandMetadata.ts";
export * from "./makeUserHandler.ts";
export * from "./toggleArticleBookmark.ts";

export const UserCommand = Schema.Union([ToggleArticleBookmarkCommand]);
export type UserCommand = typeof UserCommand.Type;
