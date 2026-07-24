import * as Schema from "effect/Schema";
import * as Identifiers from "./Identifiers.ts";

export const UserDoesNotExist = Schema.TaggedStruct("UserDoesNotExist", {});
export type UserDoesNotExist = typeof UserDoesNotExist.Type;

export const ExistingUser = Schema.TaggedStruct("ExistingUser", {
  userId: Identifiers.UserId,
  bookmarkedArticleIds: Schema.Array(Identifiers.ArticleId),
});
export type ExistingUser = typeof ExistingUser.Type;

export const UserState = Schema.Union([UserDoesNotExist, ExistingUser]);
export type UserState = typeof UserState.Type;

// A plain type-ascribed literal keeps module load infallible; the compiler governs the tag.
export const initialUserState: UserState = { _tag: "UserDoesNotExist" };
