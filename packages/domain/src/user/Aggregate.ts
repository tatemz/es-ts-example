import * as EventSourcingAggregate from "@es-ts-example/event-sourcing/aggregate";
import type * as Events from "./Events.ts";
import type * as Identifiers from "./Identifiers.ts";
import * as Reducer from "./Reducer.ts";
import * as State from "./State.ts";

export type UserAggregate = EventSourcingAggregate.Aggregate<
  State.UserState,
  Events.UserEvent,
  Identifiers.UserId
>;

const userAggregate = EventSourcingAggregate.defineAggregate<
  State.UserState,
  Events.UserEvent,
  Identifiers.UserId
>({
  initialState: State.initialUserState,
  reducer: Reducer.applyUserEvent,
});

/** A user with no history yet. Nothing has happened to them. */
export const newUser = (userId: Identifiers.UserId): UserAggregate => userAggregate.empty(userId);

export const recordUserEvent: {
  (event: Events.UserEvent): (aggregate: UserAggregate) => UserAggregate;
  (aggregate: UserAggregate, event: Events.UserEvent): UserAggregate;
} = userAggregate.recordEvent;

export const replayUser =
  (userId: Identifiers.UserId) =>
  (events: ReadonlyArray<Events.UserEvent>): UserAggregate =>
    userAggregate.replay(userId)(events);
