import * as Arr from "effect/Array";
import * as Fn from "effect/Function";
import * as Option from "effect/Option";
import type { Reducer } from "./aggregate.ts";
import type { EventStoreSequenceNumber } from "./event-store.ts";

export type ProjectionId = string;

/**
 * A projection is a pure fold over a *narrower* event type extracted from a
 * potentially wider event-store stream.
 *
 * - `WideEvent`: anything the upstream event store can deliver.
 * - `ProjectionEvent`: the subset this projection actually folds over.
 * - `selectEvent`: returns `some(narrow)` when the projection cares about the
 *   wide event, `none()` otherwise. Lets one projection consume a heterogenous
 *   global stream without per-projection event stores.
 */
export type Projection<State, ProjectionEvent, WideEvent, Id extends string = ProjectionId> = {
  readonly projectionId: Id;
  readonly initialState: State;
  readonly applyEvent: Reducer<State, ProjectionEvent>;
  readonly selectEvent: (event: WideEvent) => Option.Option<ProjectionEvent>;
};

/**
 * Storage envelope for a projection. Carries domain state alongside the
 * checkpoint. Optimistic-concurrency versions are owned by `ProjectionStore`,
 * not duplicated inside the stored value.
 *
 * `lastEventStoreSequenceNumber` follows the inclusive-lower-bound convention:
 * the next hydration cycle resumes with `start = lastEventStoreSequenceNumber + 1`.
 * `0` means no events have ever been processed.
 */
export type ProjectionEnvelope<State> = {
  readonly state: State;
  readonly lastEventStoreSequenceNumber: EventStoreSequenceNumber;
};

export const initialEnvelope = <State>(state: State): ProjectionEnvelope<State> => ({
  state,
  lastEventStoreSequenceNumber: 0,
});

/**
 * Pure fold of a wide-event stream through the projection's selectEvent +
 * applyEvent. Useful for testing and ad-hoc replays.
 */
export const foldProjection =
  <State, ProjectionEvent, WideEvent, Id extends string>(
    projection: Projection<State, ProjectionEvent, WideEvent, Id>,
  ) =>
  (events: ReadonlyArray<WideEvent>): State =>
    Fn.pipe(
      events,
      Arr.reduce(projection.initialState, (state, event) =>
        Fn.pipe(
          projection.selectEvent(event),
          Option.match({
            onNone: () => state,
            onSome: (narrowed) => projection.applyEvent(state, narrowed),
          }),
        ),
      ),
    );

export const makeProjection = <State, ProjectionEvent, WideEvent, Id extends string>(options: {
  readonly projectionId: Id;
  readonly initialState: State;
  readonly applyEvent: Reducer<State, ProjectionEvent>;
  readonly selectEvent: (event: WideEvent) => Option.Option<ProjectionEvent>;
}): Projection<State, ProjectionEvent, WideEvent, Id> => ({
  projectionId: options.projectionId,
  initialState: options.initialState,
  applyEvent: options.applyEvent,
  selectEvent: options.selectEvent,
});
