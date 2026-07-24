import * as Domain from "@es-ts-example/domain";
import type * as EventStore from "@es-ts-example/event-sourcing/event-store";
import * as Repository from "@es-ts-example/event-sourcing/repository";

export type CounterEventStore = EventStore.EventStore<
  Domain.CounterEvent,
  EventStore.EventStorePersistenceFailure
>;

export const makeCounterRepository = (
  store: CounterEventStore,
): Repository.AggregateRepository<
  Domain.CounterState,
  Domain.CounterEvent,
  Domain.CounterId,
  EventStore.EventStorePersistenceFailure
> =>
  Repository.makeAggregateRepository({
    store,
    initialState: Domain.initialCounterState,
    applyEvent: Domain.applyCounterEvent,
  });
