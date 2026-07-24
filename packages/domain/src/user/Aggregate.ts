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

const userAggregateFactory = EventSourcingAggregate.makeAggregateFactory<
  State.UserState,
  Events.UserEvent,
  Identifiers.UserId
>({
  initialState: State.initialUserState,
  applyEvent: Reducer.applyUserEvent,
});

export const emptyUser = (userId: Identifiers.UserId): UserAggregate =>
  userAggregateFactory.empty(userId);

export const recordUserEvent: {
  (event: Events.UserEvent): (aggregate: UserAggregate) => UserAggregate;
  (aggregate: UserAggregate, event: Events.UserEvent): UserAggregate;
} = userAggregateFactory.recordEvent;

export const reconstituteUser =
  (userId: Identifiers.UserId) =>
  (events: ReadonlyArray<Events.UserEvent>): UserAggregate =>
    userAggregateFactory.reconstitute(userId)(events);
