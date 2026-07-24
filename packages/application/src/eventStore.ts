import * as Domain from "@es-ts-example/domain";
import * as EventStore from "@es-ts-example/event-sourcing/event-store";
import * as Arr from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
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

/**
 * Every slice shares one `DomainEvent` stream, so every read is a narrowing.
 * The store hands back events that are already decoded, so narrowing is a
 * refinement rather than a second decode: an event belonging to another slice
 * is expected and skipped, and there is no failure mode to invent.
 *
 * One policy, used by every operation. Reads see only this slice's events, and
 * an append echoes back only what this slice wrote.
 */
const belongsToSlice =
  <Event extends Domain.DomainEvent>(eventSchema: Schema.Codec<Event, unknown>) =>
  (record: EventStore.StoredEvent<Domain.DomainEvent>): record is EventStore.StoredEvent<Event> =>
    Schema.is(eventSchema)(record.event);

export const eventStoreFor = <Event extends Domain.DomainEvent, StoreError>(
  eventSchema: Schema.Codec<Event, unknown>,
  store: EventStore.EventStore<Domain.DomainEvent, StoreError>,
): EventStore.EventStore<Event, StoreError> => ({
  fetch: (query) => Effect.map(store.fetch(query), Arr.filter(belongsToSlice(eventSchema))),
  fetchAll: (query) => Stream.filter(store.fetchAll(query), belongsToSlice(eventSchema)),
  append: (command) =>
    Effect.map(
      store.append({
        aggregateId: command.aggregateId,
        expectedVersion: command.expectedVersion,
        events: command.events,
      }),
      Arr.filter(belongsToSlice(eventSchema)),
    ),
});
