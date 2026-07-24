import * as Arr from "effect/Array";
import * as Fn from "effect/Function";
import * as Option from "effect/Option";
import type { Reducer } from "./aggregate.ts";
import type { EventStoreSequenceNumber } from "./event-store.ts";

export type ProjectionId = string;

/**
 * A projection replays a *narrower* event type out of a potentially wider
 * event-store stream.
 *
 * - `SourceEvent`: anything the upstream event store can deliver.
 * - `SelectedEvent`: the subset this projection actually replays.
 * - `matchesProjection`: returns `some(selected)` when the projection cares
 *   about a source event, `none()` otherwise. Lets one projection consume a
 *   heterogenous global stream without a per-projection event store.
 */
export type Projection<State, SelectedEvent, SourceEvent, Id extends string = ProjectionId> = {
  readonly projectionId: Id;
  readonly initialState: State;
  readonly reducer: Reducer<State, SelectedEvent>;
  readonly matchesProjection: (event: SourceEvent) => Option.Option<SelectedEvent>;
};

/**
 * What a projection stores: its state plus how far through the stream it got.
 * Optimistic-concurrency versions are owned by `ProjectionStore`, not duplicated
 * inside the stored value.
 *
 * `lastEventStoreSequenceNumber` follows the inclusive-lower-bound convention:
 * the next hydration cycle resumes with `start = lastEventStoreSequenceNumber + 1`.
 * `0` means no events have ever been processed.
 */
export type ProjectionCheckpoint<State> = {
  readonly state: State;
  readonly lastEventStoreSequenceNumber: EventStoreSequenceNumber;
};

export const initialCheckpoint = <State>(state: State): ProjectionCheckpoint<State> => ({
  state,
  lastEventStoreSequenceNumber: 0,
});

/**
 * Replays a source stream through the projection's selector and reducer. Useful
 * for testing and ad-hoc replays.
 */
export const replayProjection =
  <State, SelectedEvent, SourceEvent, Id extends string>(
    projection: Projection<State, SelectedEvent, SourceEvent, Id>,
  ) =>
  (events: ReadonlyArray<SourceEvent>): State =>
    Fn.pipe(
      events,
      Arr.reduce(projection.initialState, (state, event) =>
        Fn.pipe(
          projection.matchesProjection(event),
          Option.match({
            onNone: () => state,
            onSome: (selected) => projection.reducer(state, selected),
          }),
        ),
      ),
    );

export const makeProjection = <State, SelectedEvent, SourceEvent, Id extends string>(options: {
  readonly projectionId: Id;
  readonly initialState: State;
  readonly reducer: Reducer<State, SelectedEvent>;
  readonly matchesProjection: (event: SourceEvent) => Option.Option<SelectedEvent>;
}): Projection<State, SelectedEvent, SourceEvent, Id> => ({
  projectionId: options.projectionId,
  initialState: options.initialState,
  reducer: options.reducer,
  matchesProjection: options.matchesProjection,
});
