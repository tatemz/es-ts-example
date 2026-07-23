import * as Domain from "@es-ts-example/domain";
import type * as EventStore from "@es-ts-example/event-sourcing/event-store";
import * as EventSourcingProjection from "@es-ts-example/event-sourcing/projection";
import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import * as Fn from "effect/Function";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";
import {
  applyCounterListEvent,
  type CounterListProjectionState,
  initialCounterListProjectionState,
} from "../readModels.ts";

export const CounterListProjection = EventSourcingProjection.makeProjection<
  CounterListProjectionState,
  Domain.CounterEvent,
  Domain.CounterEvent,
  "counter-list"
>({
  projectionId: "counter-list",
  initialState: initialCounterListProjectionState,
  applyEvent: applyCounterListEvent,
  selectEvent: (event) =>
    Schema.is(Domain.CounterEvent)(event) ? Option.some(event) : Option.none(),
});

export const makeListCountersHandler =
  <StoreError>(store: EventStore.EventStore<Domain.CounterEvent, StoreError>) =>
  (): Effect.Effect<CounterListProjectionState, StoreError> =>
    Fn.pipe(
      store.fetchAll({}),
      Stream.map((record) => record.event),
      Stream.runCollect,
      Effect.map((events) =>
        EventSourcingProjection.foldProjection(CounterListProjection)(Arr.fromIterable(events)),
      ),
    );
