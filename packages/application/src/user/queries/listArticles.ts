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
  articleCatalogList,
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
  applyEvent: applyBookmarkEvent,
  selectEvent: (event) => (Schema.is(Domain.UserEvent)(event) ? Option.some(event) : Option.none()),
});

export const makeListArticlesHandler = (store: UserEventStore) => (query: ListArticlesQuery) =>
  Fn.pipe(
    store.fetchAll({}),
    Stream.map((record) => record.event),
    Stream.runCollect,
    Effect.map((events) =>
      articleCatalogList(
        EventSourcingProjection.foldProjection(BookmarkProjection)(Arr.fromIterable(events)),
        query.userId,
      ),
    ),
  );
