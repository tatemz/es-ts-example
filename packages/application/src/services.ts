import * as Domain from "@es-ts-example/domain";
import * as EventStore from "@es-ts-example/event-sourcing/event-store";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Fn from "effect/Function";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";

export interface DomainEventStore extends EventStore.EventStore<
  Domain.DomainEvent,
  EventStore.EventStorePersistenceFailure
> {}

const DomainEventStoreTag = Context.Service<DomainEventStore>("DomainEventStore");

export const DomainEventStore = Object.assign(DomainEventStoreTag, {
  inMemory: Layer.effect(
    DomainEventStoreTag,
    EventStore.makeInMemoryEventStore<Domain.DomainEvent>(),
  ),

  jsonFile: (path: string) =>
    Layer.effect(
      DomainEventStoreTag,
      EventStore.makeJsonFileEventStore<Domain.DomainEvent>(Domain.DomainEvent, path),
    ),
});

const decodeEvent =
  <Event extends Domain.DomainEvent>(eventSchema: Schema.Codec<Event, unknown>) =>
  (
    record: EventStore.StoredEvent<Domain.DomainEvent>,
  ): Effect.Effect<EventStore.StoredEvent<Event>, EventStore.EventStorePersistenceFailure> =>
    Effect.map(
      Schema.decodeUnknownEffect(eventSchema)(record.event).pipe(
        Effect.mapError((error) =>
          EventStore.EventStorePersistenceFailure.make({ message: String(error) }),
        ),
      ),
      (event) => ({
        ...record,
        event,
      }),
    );

export const narrowDomainEventStore = <Event extends Domain.DomainEvent, StoreError>(
  eventSchema: Schema.Codec<Event, unknown>,
  store: EventStore.EventStore<Domain.DomainEvent, StoreError>,
): EventStore.EventStore<Event, StoreError | EventStore.EventStorePersistenceFailure> => ({
  fetch: (query) =>
    Effect.flatMap(store.fetch(query), (records) =>
      Effect.forEach(records, decodeEvent(eventSchema)),
    ),
  fetchAll: (query) =>
    Fn.pipe(
      store.fetchAll(query),
      Stream.filter((record) => Schema.is(eventSchema)(record.event)),
      Stream.mapEffect(decodeEvent(eventSchema)),
    ),
  append: (command) =>
    Effect.flatMap(
      store.append({
        aggregateId: command.aggregateId,
        expectedVersion: command.expectedVersion,
        events: command.events,
      }),
      (records) => Effect.forEach(records, decodeEvent(eventSchema)),
    ),
});
