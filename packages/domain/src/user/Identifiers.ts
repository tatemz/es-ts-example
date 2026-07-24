import * as Schema from "effect/Schema";

export const UserId = Schema.NonEmptyString.pipe(Schema.brand("UserId"));
export type UserId = typeof UserId.Type;

export const ArticleId = Schema.NonEmptyString.pipe(Schema.brand("ArticleId"));
export type ArticleId = typeof ArticleId.Type;
