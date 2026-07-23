import * as Domain from "@es-ts-example/domain";
import type * as EventStore from "@es-ts-example/event-sourcing/event-store";
import * as Repository from "@es-ts-example/event-sourcing/repository";

export const makeCounterRepository = <StoreError>(
  store: EventStore.EventStore<Domain.CounterEvent, StoreError>,
): Repository.AggregateRepository<
  Domain.CounterState,
  Domain.CounterEvent,
  Domain.CounterId,
  StoreError
> =>
  Repository.makeAggregateRepository({
    store,
    initialState: Domain.initialCounterState,
    applyEvent: Domain.applyCounterEvent,
  });
