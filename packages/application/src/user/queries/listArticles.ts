import * as Domain from "@es-ts-example/domain";
import * as EventSourcingProjection from "@es-ts-example/event-sourcing/projection";
import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import * as Fn from "effect/Function";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";
import {
  applyBookmarkEvent,
  articlesWithBookmarks,
  type BookmarkProjectionState,
  initialBookmarkProjectionState,
} from "../readModels.ts";
import type { UserEventStore } from "../repository.ts";

export const ListArticlesQuery = Schema.TaggedStruct("ListArticles", {
  userId: Domain.UserId,
});
export type ListArticlesQuery = typeof ListArticlesQuery.Type;

export const BookmarkProjection = EventSourcingProjection.makeProjection<
  BookmarkProjectionState,
  Domain.UserEvent,
  Domain.UserEvent,
  "user-bookmarks"
>({
  projectionId: "user-bookmarks",
  initialState: initialBookmarkProjectionState,
  reducer: applyBookmarkEvent,
  matchesProjection: (event) =>
    Schema.is(Domain.UserEvent)(event) ? Option.some(event) : Option.none(),
});

/**
 * Bookmarks fold into one projection across every user, because the read model
 * joins bookmark state against a static catalog rather than describing a single
 * stream. Contrast `makeListCountersHandler`, which replays each counter's own
 * stream: pick per-aggregate replay when a row *is* one stream, and a global
 * fold when a row joins several sources.
 */
export const makeListArticlesHandler = (store: UserEventStore) => (query: ListArticlesQuery) =>
  Fn.pipe(
    store.fetchAll({}),
    Stream.map((record) => record.event),
    Stream.runCollect,
    Effect.map((events) =>
      articlesWithBookmarks(
        EventSourcingProjection.replayProjection(BookmarkProjection)(Arr.fromIterable(events)),
        query.userId,
      ),
    ),
  );
