import * as Domain from "@es-ts-example/domain";
import type * as EventStore from "@es-ts-example/event-sourcing/event-store";
import * as Repository from "@es-ts-example/event-sourcing/repository";

export type UserEventStore = EventStore.EventStore<
  Domain.UserEvent,
  EventStore.EventStorePersistenceFailure
>;

export const makeUserRepository = (
  store: UserEventStore,
): Repository.AggregateRepository<
  Domain.UserState,
  Domain.UserEvent,
  Domain.UserId,
  EventStore.EventStorePersistenceFailure
> =>
  Repository.makeAggregateRepository({
    store,
    initialState: Domain.initialUserState,
    reducer: Domain.applyUserEvent,
  });
