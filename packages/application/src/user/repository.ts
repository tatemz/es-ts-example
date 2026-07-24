import * as Domain from "@es-ts-example/domain";
import type * as EventStore from "@es-ts-example/event-sourcing/event-store";
import * as Repository from "@es-ts-example/event-sourcing/repository";

export const makeUserRepository = <StoreError>(
  store: EventStore.EventStore<Domain.UserEvent, StoreError>,
): Repository.AggregateRepository<Domain.UserState, Domain.UserEvent, Domain.UserId, StoreError> =>
  Repository.makeAggregateRepository({
    store,
    initialState: Domain.initialUserState,
    applyEvent: Domain.applyUserEvent,
  });
