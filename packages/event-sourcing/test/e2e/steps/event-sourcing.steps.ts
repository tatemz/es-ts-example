import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { Bdd } from "effect-bdd";
import * as EventSourcing from "../../../src/index.ts";
import {
  type CounterEvent,
  applyCounterEvent,
  applyNewCounterEvent,
  counterClosed,
  created,
  decideIncrement,
  incremented,
  reset,
} from "../../support/Counter.ts";
import {
  appendEvents,
  assertCleanAggregate,
  assertConflictVersions,
  assertCounterState,
  assertCounterVersion,
  assertDecisionAccepted,
  assertDecisionRejected,
  assertDecisionRejectedWith,
  assertExpectedVersionConflict,
  assertIsolatedRepositoryFacts,
  assertNoPendingEvents,
  assertPendingEvents,
  assertStreamContainsFacts,
  assertStreamContainsOnlyCreated,
  assertStreamEmpty,
  assertStreamVersion,
  fetchRecords,
} from "../support/EventSourcingAssertions.ts";
import {
  type FactRow,
  eventsFromRows,
  readFactValue,
  readGlobalPosition,
  readStreamVersion,
} from "../support/CounterFacts.ts";
import {
  type EventSourcingScenarioState,
  initialEventSourcingScenarioState,
  makeRepository,
  requiredScenarioValue,
} from "../support/EventSourcingWorld.ts";

const aggregateId = Bdd.capture("aggregateId", Schema.String);
const increment = Bdd.capture("increment", Schema.NumberFromString);
const stateValue = Bdd.capture("state", Schema.NumberFromString);
const version = Bdd.capture("version", Schema.NumberFromString);
const expectedVersion = Bdd.capture("expectedVersion", Schema.NumberFromString);
const actualVersion = Bdd.capture("actualVersion", Schema.NumberFromString);
const globalPosition = Bdd.capture("globalPosition", Schema.NumberFromString);
const streamVersion = Bdd.capture("streamVersion", Schema.NumberFromString);

const FactRowSchema = Schema.Struct({
  fact: Schema.String,
  value: Schema.optionalKey(Schema.String),
  "stream version": Schema.optionalKey(Schema.String),
  "global position": Schema.optionalKey(Schema.String),
});

type CounterStateCapture = { readonly state: number };
type VersionCapture = { readonly version: number };
type AggregateIdCapture = { readonly aggregateId: string };
type StreamCreationCapture = { readonly aggregateId: string; readonly expectedVersion: number };
type StreamIncrementCapture = {
  readonly aggregateId: string;
  readonly increment: number;
  readonly expectedVersion: number;
};
type GlobalPositionCapture = { readonly aggregateId: string; readonly globalPosition: number };
type StreamVersionCapture = { readonly aggregateId: string; readonly streamVersion: number };
type ConflictVersionCapture = { readonly expectedVersion: number; readonly actualVersion: number };

const expectCounterAggregate = (
  state: EventSourcingScenarioState,
): Effect.Effect<EventSourcing.Aggregate<number, CounterEvent>, string> =>
  requiredScenarioValue(state.counterAggregate, "counterAggregate");

const expectEventStore = (
  state: EventSourcingScenarioState,
): Effect.Effect<EventSourcing.EventStore<CounterEvent>, string> =>
  requiredScenarioValue(state.store, "store");

const expectRepository = (
  state: EventSourcingScenarioState,
): Effect.Effect<EventSourcing.AggregateRepository<number, CounterEvent>, string> =>
  requiredScenarioValue(state.repository, "repository");

const expectLoadedCounter = (
  state: EventSourcingScenarioState,
): Effect.Effect<EventSourcing.Aggregate<number, CounterEvent>, string> =>
  requiredScenarioValue(state.loadedCounter, "loadedCounter");

const expectSavedCounter = (
  state: EventSourcingScenarioState,
): Effect.Effect<EventSourcing.Aggregate<number, CounterEvent>, string> =>
  requiredScenarioValue(state.savedCounter, "savedCounter");

const withEventStore = (
  state: EventSourcingScenarioState,
): Effect.Effect<EventSourcingScenarioState, never> =>
  Effect.map(EventSourcing.makeInMemoryEventStore<CounterEvent>(), (store) => ({
    ...state,
    store,
  }));

const withCounterStreams = (
  state: EventSourcingScenarioState,
): Effect.Effect<EventSourcingScenarioState, never> =>
  Effect.map(EventSourcing.makeInMemoryEventStore<CounterEvent>(), (store) => ({
    ...state,
    store,
    repository: makeRepository(store),
  }));

const saveLoadedCounter = (
  state: EventSourcingScenarioState,
): Effect.Effect<EventSourcingScenarioState, EventSourcing.ExpectedVersionConflict | string> =>
  Effect.gen(function* () {
    const repo = yield* expectRepository(state);
    const loaded = yield* expectLoadedCounter(state);
    const saved = yield* repo.save(loaded);

    return {
      ...state,
      savedCounter: saved,
    };
  });

const sharedRepository = (
  store: EventSourcing.EventStore<CounterEvent>,
  streamPrefix: string,
): EventSourcing.AggregateRepository<number, CounterEvent> =>
  EventSourcing.makeAggregateRepository({
    store,
    initialState: 0,
    applyEvent: applyCounterEvent,
    streamName: (id: string) => `${streamPrefix}:${id}`,
  });

type ScenarioStepError = string | EventSourcing.ExpectedVersionConflict;

const expectConflict = (
  state: EventSourcingScenarioState,
): Effect.Effect<EventSourcing.ExpectedVersionConflict, string> =>
  requiredScenarioValue(state.saveConflict ?? state.appendConflict, "conflict");

const appendCreation = (
  state: EventSourcingScenarioState,
  aggregateId: string,
  expectedVersion: number,
): Effect.Effect<EventSourcingScenarioState, ScenarioStepError> =>
  Effect.flatMap(readStreamVersion(expectedVersion), (version) =>
    Effect.map(appendEvents(state, aggregateId, version, [created()]), () => state),
  );

const appendCreationAndIncrement = (
  state: EventSourcingScenarioState,
  aggregateId: string,
  increment: number,
  expectedVersion: number,
): Effect.Effect<EventSourcingScenarioState, ScenarioStepError> =>
  Effect.gen(function* () {
    const version = yield* readStreamVersion(expectedVersion);
    const incrementValue = yield* readFactValue(increment);

    yield* appendEvents(state, aggregateId, version, [created(), incremented(incrementValue)]);

    return state;
  });

const appendIncrement = (
  state: EventSourcingScenarioState,
  aggregateId: string,
  increment: number,
  expectedVersion: number,
): Effect.Effect<EventSourcingScenarioState, ScenarioStepError> =>
  Effect.gen(function* () {
    const version = yield* readStreamVersion(expectedVersion);
    const incrementValue = yield* readFactValue(increment);

    yield* appendEvents(state, aggregateId, version, [incremented(incrementValue)]);

    return state;
  });

const givenEventSourcedCounterAggregateExists =
  Bdd.given`an event-sourced counter aggregate exists`(() =>
    Effect.succeed({
      ...initialEventSourcingScenarioState,
      counterAggregate: EventSourcing.makeAggregate<number, CounterEvent, "counter-1">(
        "counter-1",
        0,
      ),
    }),
  );

const givenCounterHistoryContainsIncrementsOf2And3 =
  Bdd.given`the counter history contains increments of 2 and 3`(
    (state: EventSourcingScenarioState) =>
      Effect.succeed({
        ...state,
        counterHistory: [incremented(2), incremented(3)],
      }),
  );

const givenCounterHistoryContainsIncrementResetAndIncrement =
  Bdd.given`the counter history contains an increment of 2, a reset, and an increment of 3`(
    (state: EventSourcingScenarioState) =>
      Effect.succeed({
        ...state,
        counterHistory: [incremented(2), reset(), incremented(3)],
      }),
  );

const givenCounterReconstitutedAtVersion2 =
  Bdd.given`the counter has been reconstituted at version 2`((state: EventSourcingScenarioState) =>
    Effect.succeed({
      ...state,
      counterAggregate: EventSourcing.reconstituteAggregate({
        aggregateId: "counter-1",
        initialState: 0,
        applyEvent: applyCounterEvent,
        events: [incremented(2), incremented(3)],
      }),
    }),
  );

const whenNewCounterAggregateCreated = Bdd.when`a new counter aggregate is created`(
  (state: EventSourcingScenarioState) =>
    Effect.succeed({
      ...state,
      counterAggregate: EventSourcing.makeAggregate<number, CounterEvent, "counter-1">(
        "counter-1",
        0,
      ),
    }),
);

const whenAggregateReconstitutedFromHistory =
  Bdd.when`the aggregate is reconstituted from its history`((state: EventSourcingScenarioState) =>
    Effect.succeed({
      ...state,
      counterAggregate: EventSourcing.reconstituteAggregate({
        aggregateId: "counter-1",
        initialState: 0,
        applyEvent: applyCounterEvent,
        events: state.counterHistory,
      }),
    }),
  );

const whenCounterIncrementedBy4 = Bdd.when`the counter is incremented by 4`(
  (state: EventSourcingScenarioState) =>
    Effect.flatMap(expectCounterAggregate(state), (aggregate) =>
      Effect.succeed({
        ...state,
        counterAggregate: applyNewCounterEvent(incremented(4))(aggregate),
      }),
    ),
);

const whenCounterIncrementedBy1 = Bdd.when`the counter is incremented by 1`(
  (state: EventSourcingScenarioState) =>
    Effect.flatMap(expectCounterAggregate(state), (aggregate) =>
      Effect.succeed({
        ...state,
        counterAggregate: applyNewCounterEvent(incremented(1))(aggregate),
      }),
    ),
);

const thenCounterStateIs = Bdd.then`the counter state is ${stateValue}`(
  ({ state: expected }: CounterStateCapture, state: EventSourcingScenarioState) =>
    Effect.gen(function* () {
      const aggregate = yield* expectCounterAggregate(state);
      const factValue = yield* readFactValue(expected);

      assertCounterState(aggregate, factValue);

      return state;
    }),
);

const thenAggregateVersionIs = Bdd.then`the aggregate version is ${version}`(
  ({ version }: VersionCapture, state: EventSourcingScenarioState) =>
    Effect.gen(function* () {
      const aggregate = yield* expectCounterAggregate(state);
      const streamVersionValue = yield* readStreamVersion(version);

      assertCounterVersion(aggregate, streamVersionValue);

      return state;
    }),
);

const thenAggregateHasNoUnsavedFacts = Bdd.then`the aggregate has no unsaved facts`(
  (state: EventSourcingScenarioState) =>
    Effect.flatMap(expectCounterAggregate(state), (aggregate) =>
      Effect.sync(() => {
        assertNoPendingEvents(aggregate);
        return state;
      }),
    ),
);

const thenAggregateHasUnsavedFacts = Bdd.then`the aggregate has unsaved facts:`(
  Bdd.table(FactRowSchema),
  (rows: ReadonlyArray<FactRow>, state: EventSourcingScenarioState) =>
    Effect.gen(function* () {
      const aggregate = yield* expectCounterAggregate(state);

      yield* assertPendingEvents(aggregate, rows);

      return state;
    }),
);

const thenAggregateHasUnsavedFactsInOrder = Bdd.then`the aggregate has unsaved facts in order:`(
  Bdd.table(FactRowSchema),
  (rows: ReadonlyArray<FactRow>, state: EventSourcingScenarioState) =>
    Effect.gen(function* () {
      const aggregate = yield* expectCounterAggregate(state);

      yield* assertPendingEvents(aggregate, rows);

      return state;
    }),
);

const newAggregatesStartClean = Bdd.scenario("New aggregates start clean").pipe(
  givenEventSourcedCounterAggregateExists,
  whenNewCounterAggregateCreated,
  thenCounterStateIs,
  thenAggregateVersionIs,
  thenAggregateHasNoUnsavedFacts,
);

const historyRebuildsCurrentAggregateState = Bdd.scenario(
  "History rebuilds current aggregate state",
).pipe(
  givenEventSourcedCounterAggregateExists,
  givenCounterHistoryContainsIncrementsOf2And3,
  whenAggregateReconstitutedFromHistory,
  thenCounterStateIs,
  thenAggregateVersionIs,
  thenAggregateHasNoUnsavedFacts,
);

const historyIsReplayedInRecordedOrder = Bdd.scenario("History is replayed in recorded order").pipe(
  givenEventSourcedCounterAggregateExists,
  givenCounterHistoryContainsIncrementResetAndIncrement,
  whenAggregateReconstitutedFromHistory,
  thenCounterStateIs,
  thenAggregateVersionIs,
  thenAggregateHasNoUnsavedFacts,
);

const oneNewChangeIsTrackedAsPending = Bdd.scenario("One new change is tracked as pending").pipe(
  givenEventSourcedCounterAggregateExists,
  givenCounterReconstitutedAtVersion2,
  whenCounterIncrementedBy4,
  thenCounterStateIs,
  thenAggregateVersionIs,
  thenAggregateHasUnsavedFacts,
);

const multipleNewChangesAreTrackedInOrder = Bdd.scenario(
  "Multiple new changes are tracked in order",
).pipe(
  givenEventSourcedCounterAggregateExists,
  givenCounterReconstitutedAtVersion2,
  whenCounterIncrementedBy4,
  whenCounterIncrementedBy1,
  thenCounterStateIs,
  thenAggregateVersionIs,
  thenAggregateHasUnsavedFactsInOrder,
);

export const eventSourcedAggregateLifecycleContract = Bdd.feature(
  "Event-sourced aggregate lifecycle contract",
).pipe(
  newAggregatesStartClean,
  historyRebuildsCurrentAggregateState,
  historyIsReplayedInRecordedOrder,
  oneNewChangeIsTrackedAsPending,
  multipleNewChangesAreTrackedInOrder,
);

const givenCounterCommandHandlerUsesEventSourcedDecisions =
  Bdd.given`a counter command handler uses event-sourced decisions`(() =>
    Effect.succeed({
      ...initialEventSourcingScenarioState,
      decision: undefined,
    }),
  );

const givenCounterIsOpen = Bdd.given`the counter is open`((state: EventSourcingScenarioState) =>
  Effect.succeed({
    ...state,
    counterStatus: "open" as const,
  }),
);

const givenCounterIsClosed = Bdd.given`the counter is closed`((state: EventSourcingScenarioState) =>
  Effect.succeed({
    ...state,
    counterStatus: "closed" as const,
  }),
);

const whenIncrementCommandFor1Handled = Bdd.when`an increment command for 1 is handled`(
  (state: EventSourcingScenarioState) =>
    Effect.flatMap(requiredScenarioValue(state.counterStatus, "counterStatus"), (counterStatus) =>
      Effect.succeed({
        ...state,
        decision: decideIncrement(counterStatus, 1),
      }),
    ),
);

const thenDecisionSucceedsWithFacts = Bdd.then`the decision succeeds with facts:`(
  Bdd.table(FactRowSchema),
  (rows: ReadonlyArray<FactRow>, state: EventSourcingScenarioState) =>
    Effect.gen(function* () {
      const decision = yield* requiredScenarioValue(state.decision, "decision");
      const events = yield* eventsFromRows(rows);

      assertDecisionAccepted(decision, EventSourcing.accept(events));

      return state;
    }),
);

const thenDecisionFailsWithCounterClosedError =
  Bdd.then`the decision fails with a counter closed error`((state: EventSourcingScenarioState) =>
    Effect.flatMap(requiredScenarioValue(state.decision, "decision"), (decision) =>
      Effect.sync(() => {
        assertDecisionRejectedWith(decision, EventSourcing.reject(counterClosed()));
        return state;
      }),
    ),
  );

const thenDecisionProducesNoFacts = Bdd.then`the decision produces no facts`(
  (state: EventSourcingScenarioState) =>
    Effect.flatMap(requiredScenarioValue(state.decision, "decision"), (decision) =>
      Effect.sync(() => {
        assertDecisionRejected(decision);
        return state;
      }),
    ),
);

const acceptedCommandsProduceFacts = Bdd.scenario("Accepted commands produce facts").pipe(
  givenCounterCommandHandlerUsesEventSourcedDecisions,
  givenCounterIsOpen,
  whenIncrementCommandFor1Handled,
  thenDecisionSucceedsWithFacts,
);

const rejectedCommandsProduceTypedErrorsWithoutFacts = Bdd.scenario(
  "Rejected commands produce typed errors without facts",
).pipe(
  givenCounterCommandHandlerUsesEventSourcedDecisions,
  givenCounterIsClosed,
  whenIncrementCommandFor1Handled,
  thenDecisionFailsWithCounterClosedError,
  thenDecisionProducesNoFacts,
);

export const eventSourcedDecisionContract = Bdd.feature("Event-sourced decision contract").pipe(
  acceptedCommandsProduceFacts,
  rejectedCommandsProduceTypedErrorsWithoutFacts,
);

const givenEmptyEventStore = Bdd.given`an empty event store`(() =>
  withEventStore(initialEventSourcingScenarioState),
);

const givenStreamRecordsCounterCreationAtExpectedVersion =
  Bdd.given`stream ${aggregateId} records a counter creation at expected version ${expectedVersion}`(
    ({ aggregateId, expectedVersion }: StreamCreationCapture, state: EventSourcingScenarioState) =>
      appendCreation(state, aggregateId, expectedVersion),
  );

const givenStreamRecordsCounterCreationAndIncrementAtExpectedVersion =
  Bdd.given`stream ${aggregateId} records a counter creation and an increment of ${increment} at expected version ${expectedVersion}`(
    (
      { aggregateId, increment, expectedVersion }: StreamIncrementCapture,
      state: EventSourcingScenarioState,
    ) => appendCreationAndIncrement(state, aggregateId, increment, expectedVersion),
  );

const givenStreamRecordsIncrementAtExpectedVersion =
  Bdd.given`stream ${aggregateId} records an increment of ${increment} at expected version ${expectedVersion}`(
    (
      { aggregateId, increment, expectedVersion }: StreamIncrementCapture,
      state: EventSourcingScenarioState,
    ) => appendIncrement(state, aggregateId, increment, expectedVersion),
  );

const whenStreamRecordsCounterCreationAndIncrementAtExpectedVersion =
  Bdd.when`stream ${aggregateId} records a counter creation and an increment of ${increment} at expected version ${expectedVersion}`(
    (
      { aggregateId, increment, expectedVersion }: StreamIncrementCapture,
      state: EventSourcingScenarioState,
    ) => appendCreationAndIncrement(state, aggregateId, increment, expectedVersion),
  );

const whenStreamRecordsNoFactsAtExpectedVersion =
  Bdd.when`stream ${aggregateId} records no facts at expected version ${expectedVersion}`(
    ({ aggregateId, expectedVersion }: StreamCreationCapture, state: EventSourcingScenarioState) =>
      Effect.flatMap(readStreamVersion(expectedVersion), (version) =>
        Effect.map(appendEvents(state, aggregateId, version, []), () => state),
      ),
  );

const whenStreamTriesToRecordIncrementAtExpectedVersion =
  Bdd.when`stream ${aggregateId} tries to record an increment of ${increment} at expected version ${expectedVersion}`(
    (
      { aggregateId, increment, expectedVersion }: StreamIncrementCapture,
      state: EventSourcingScenarioState,
    ) =>
      Effect.gen(function* () {
        const store = yield* expectEventStore(state);
        const incrementValue = yield* readFactValue(increment);
        const version = yield* readStreamVersion(expectedVersion);
        const appendConflict = yield* store
          .append({
            aggregateId,
            expectedVersion: version,
            events: [incremented(incrementValue)],
          })
          .pipe(Effect.flip);

        return {
          ...state,
          appendConflict,
        };
      }),
  );

const whenStreamIsFetched = Bdd.when`stream ${aggregateId} is fetched`(
  ({ aggregateId }: AggregateIdCapture, state: EventSourcingScenarioState) =>
    Effect.flatMap(expectEventStore(state), (store) =>
      Effect.sync(() => ({
        ...state,
        fetchedStream: aggregateId,
        fetchedRecords: fetchRecords(store, aggregateId),
      })),
    ),
);

const whenStreamIsFetchedFromGlobalPosition =
  Bdd.when`stream ${aggregateId} is fetched from global position ${globalPosition}`(
    ({ aggregateId, globalPosition }: GlobalPositionCapture, state: EventSourcingScenarioState) =>
      Effect.gen(function* () {
        const store = yield* expectEventStore(state);
        const startingEventSequenceNumber = yield* readGlobalPosition(globalPosition);
        const fetchedRecords = yield* store.fetch({
          aggregateId,
          startingEventSequenceNumber,
        });

        return {
          ...state,
          fetchedStream: aggregateId,
          fetchedRecords,
        };
      }),
  );

const thenStreamContainsFactsInOrder = Bdd.then`stream ${aggregateId} contains facts in order:`(
  Bdd.table(FactRowSchema),
  (
    { aggregateId }: AggregateIdCapture,
    rows: ReadonlyArray<FactRow>,
    state: EventSourcingScenarioState,
  ) =>
    Effect.flatMap(assertStreamContainsFacts(state, aggregateId, rows), () =>
      Effect.succeed(state),
    ),
);

const thenStreamContainsNoFacts = Bdd.then`stream ${aggregateId} contains no facts`(
  ({ aggregateId }: AggregateIdCapture, state: EventSourcingScenarioState) =>
    Effect.flatMap(assertStreamEmpty(state, aggregateId), () => Effect.succeed(state)),
);

const thenStreamStillContainsOnlyCounterCreation =
  Bdd.then`stream ${aggregateId} still contains only the counter creation`(
    ({ aggregateId }: AggregateIdCapture, state: EventSourcingScenarioState) =>
      Effect.flatMap(expectEventStore(state), (store) =>
        Effect.sync(() => {
          assertStreamContainsOnlyCreated(store, aggregateId);
          return state;
        }),
      ),
  );

const thenNextRecordedFactHasStreamVersion =
  Bdd.then`the next recorded fact in stream ${aggregateId} has stream version ${streamVersion}`(
    ({ aggregateId, streamVersion }: StreamVersionCapture, state: EventSourcingScenarioState) =>
      Effect.gen(function* () {
        const [record] = yield* appendEvents(state, aggregateId, 0, [incremented(1)]);
        const recorded = yield* requiredScenarioValue(record, "record");
        const expectedStreamVersion = yield* readStreamVersion(streamVersion);

        assertStreamVersion(recorded.aggregateVersion, expectedStreamVersion);

        return state;
      }),
  );

const thenAppendRejectedWithExpectedVersionConflict =
  Bdd.then`the append is rejected with an expected version conflict`(
    (state: EventSourcingScenarioState) =>
      Effect.flatMap(requiredScenarioValue(state.appendConflict, "appendConflict"), (conflict) =>
        Effect.sync(() => {
          assertExpectedVersionConflict(conflict);
          return state;
        }),
      ),
  );

const thenConflictReportsExpectedAndActualVersion =
  Bdd.then`the conflict reports expected version ${expectedVersion} and actual version ${actualVersion}`(
    (
      { expectedVersion, actualVersion }: ConflictVersionCapture,
      state: EventSourcingScenarioState,
    ) =>
      Effect.gen(function* () {
        const conflict = yield* expectConflict(state);
        const expected = yield* readStreamVersion(expectedVersion);
        const actual = yield* readStreamVersion(actualVersion);

        assertConflictVersions(conflict, expected, actual);

        return state;
      }),
  );

const aNewStreamStartsAtVersionOne = Bdd.scenario("A new stream starts at version one").pipe(
  givenEmptyEventStore,
  whenStreamRecordsCounterCreationAndIncrementAtExpectedVersion,
  thenStreamContainsFactsInOrder,
);

const streamReadsExcludeRecordsFromOtherStreams = Bdd.scenario(
  "Stream reads exclude records from other streams",
).pipe(
  givenEmptyEventStore,
  givenStreamRecordsCounterCreationAtExpectedVersion,
  givenStreamRecordsCounterCreationAndIncrementAtExpectedVersion,
  whenStreamIsFetched,
  thenStreamContainsFactsInOrder,
);

const streamReadsCanResumeFromInclusiveGlobalPosition = Bdd.scenario(
  "Stream reads can resume from an inclusive global position",
).pipe(
  givenEmptyEventStore,
  givenStreamRecordsCounterCreationAtExpectedVersion,
  givenStreamRecordsCounterCreationAndIncrementAtExpectedVersion,
  givenStreamRecordsIncrementAtExpectedVersion,
  whenStreamIsFetchedFromGlobalPosition,
  thenStreamContainsFactsInOrder,
);

const staleAppendsAreRejected = Bdd.scenario("Stale appends are rejected").pipe(
  givenEmptyEventStore,
  givenStreamRecordsCounterCreationAtExpectedVersion,
  whenStreamTriesToRecordIncrementAtExpectedVersion,
  thenAppendRejectedWithExpectedVersionConflict,
  thenConflictReportsExpectedAndActualVersion,
  thenStreamStillContainsOnlyCounterCreation,
);

const emptyAppendsPreserveNextStreamVersion = Bdd.scenario(
  "Empty appends preserve the next stream version",
).pipe(
  givenEmptyEventStore,
  whenStreamRecordsNoFactsAtExpectedVersion,
  thenStreamContainsNoFacts,
  thenNextRecordedFactHasStreamVersion,
);

export const eventStoreStreamContract = Bdd.feature("Event store stream contract").pipe(
  aNewStreamStartsAtVersionOne,
  streamReadsExcludeRecordsFromOtherStreams,
  streamReadsCanResumeFromInclusiveGlobalPosition,
  staleAppendsAreRejected,
  emptyAppendsPreserveNextStreamVersion,
);

const givenEventStoreContainsCounterStreams = Bdd.given`an event store contains counter streams`(
  () => withCounterStreams(initialEventSourcingScenarioState),
);

const givenStreamContainsCounterCreationAndIncrementOf2 =
  Bdd.given`stream ${aggregateId} contains a counter creation and an increment of 2`(
    ({ aggregateId }: AggregateIdCapture, state: EventSourcingScenarioState) =>
      appendCreationAndIncrement(state, aggregateId, 2, 0),
  );

const givenTwoCopiesOfCounter1LoadedAtSameVersion =
  Bdd.given`two copies of counter-1 are loaded at the same version`(
    (state: EventSourcingScenarioState) =>
      Effect.gen(function* () {
        const repo = yield* expectRepository(state);
        const firstCopy = yield* repo.load("counter-1");
        const secondCopy = yield* repo.load("counter-1");

        return {
          ...state,
          firstCopy,
          secondCopy,
        };
      }),
  );

const givenFirstCopySavedIncrementOf1 =
  Bdd.given`the first copy has already saved an increment of 1`(
    (state: EventSourcingScenarioState) =>
      Effect.gen(function* () {
        const repo = yield* expectRepository(state);
        const firstCopy = yield* requiredScenarioValue(state.firstCopy, "firstCopy");

        yield* repo.save(applyNewCounterEvent(incremented(1))(firstCopy));

        return state;
      }),
  );

const givenCounterRepositoryLoadedCounter1 = Bdd.given`the counter repository has loaded counter-1`(
  (state: EventSourcingScenarioState) =>
    Effect.flatMap(expectRepository(state), (repo) =>
      Effect.map(repo.load("counter-1"), (loadedCounter) => ({
        ...state,
        loadedCounter,
      })),
    ),
);

const givenTwoCounterRepositoriesUseDifferentStreamNames =
  Bdd.given`two counter repositories use different stream names`(
    (state: EventSourcingScenarioState) =>
      Effect.flatMap(expectEventStore(state), (store) =>
        Effect.succeed({
          ...state,
          firstRepository: sharedRepository(store, "first"),
          secondRepository: sharedRepository(store, "second"),
        }),
      ),
  );

const whenCounterRepositoryLoadsCounter1 = Bdd.when`the counter repository loads counter-1`(
  (state: EventSourcingScenarioState) =>
    Effect.flatMap(expectRepository(state), (repo) =>
      Effect.map(repo.load("counter-1"), (loadedCounter) => ({
        ...state,
        loadedCounter,
      })),
    ),
);

const whenLoadedCounterIncrementedBy3 = Bdd.when`the loaded counter is incremented by 3`(
  (state: EventSourcingScenarioState) =>
    Effect.flatMap(expectLoadedCounter(state), (loaded) =>
      Effect.succeed({
        ...state,
        loadedCounter: applyNewCounterEvent(incremented(3))(loaded),
      }),
    ),
);

const whenLoadedCounterSaved = Bdd.when`the loaded counter is saved`(
  (state: EventSourcingScenarioState) => saveLoadedCounter(state),
);

const whenSecondCopyTriesToSaveIncrementOf2 =
  Bdd.when`the second copy tries to save an increment of 2`((state: EventSourcingScenarioState) =>
    Effect.gen(function* () {
      const repo = yield* expectRepository(state);
      const secondCopy = yield* requiredScenarioValue(state.secondCopy, "secondCopy");
      const saveConflict = yield* repo
        .save(applyNewCounterEvent(incremented(2))(secondCopy))
        .pipe(Effect.flip);

      return {
        ...state,
        saveConflict,
      };
    }),
  );

const whenBothRepositoriesSaveCounterNamedSharedId =
  Bdd.when`both repositories save a counter named shared-id`((state: EventSourcingScenarioState) =>
    Effect.gen(function* () {
      const firstRepository = yield* requiredScenarioValue(
        state.firstRepository,
        "firstRepository",
      );
      const secondRepository = yield* requiredScenarioValue(
        state.secondRepository,
        "secondRepository",
      );

      yield* firstRepository.save(
        applyNewCounterEvent(incremented(1))(yield* firstRepository.load("shared-id")),
      );
      yield* secondRepository.save(
        applyNewCounterEvent(incremented(2))(yield* secondRepository.load("shared-id")),
      );

      const firstLoadedCounter = yield* firstRepository.load("shared-id");
      const secondLoadedCounter = yield* secondRepository.load("shared-id");

      return {
        ...state,
        firstLoadedCounter,
        secondLoadedCounter,
      };
    }),
  );

const thenLoadedCounterStateIs2 = Bdd.then`the loaded counter state is 2`(
  (state: EventSourcingScenarioState) =>
    Effect.flatMap(expectLoadedCounter(state), (loaded) =>
      Effect.sync(() => {
        assertCounterState(loaded, 2);
        return state;
      }),
    ),
);

const thenLoadedCounterStateIs0 = Bdd.then`the loaded counter state is 0`(
  (state: EventSourcingScenarioState) =>
    Effect.flatMap(expectLoadedCounter(state), (loaded) =>
      Effect.sync(() => {
        assertCounterState(loaded, 0);
        return state;
      }),
    ),
);

const thenLoadedCounterVersionIs2 = Bdd.then`the loaded counter version is 2`(
  (state: EventSourcingScenarioState) =>
    Effect.flatMap(expectLoadedCounter(state), (loaded) =>
      Effect.sync(() => {
        assertCounterVersion(loaded, 2);
        return state;
      }),
    ),
);

const thenLoadedCounterVersionIs0 = Bdd.then`the loaded counter version is 0`(
  (state: EventSourcingScenarioState) =>
    Effect.flatMap(expectLoadedCounter(state), (loaded) =>
      Effect.sync(() => {
        assertCounterVersion(loaded, 0);
        return state;
      }),
    ),
);

const thenLoadedCounterHasNoUnsavedFacts = Bdd.then`the loaded counter has no unsaved facts`(
  (state: EventSourcingScenarioState) =>
    Effect.flatMap(expectLoadedCounter(state), (loaded) =>
      Effect.sync(() => {
        assertNoPendingEvents(loaded);
        return state;
      }),
    ),
);

const thenSavedCounterStateIs3 = Bdd.then`the saved counter state is 3`(
  (state: EventSourcingScenarioState) =>
    Effect.flatMap(expectSavedCounter(state), (saved) =>
      Effect.sync(() => {
        assertCounterState(saved, 3);
        return state;
      }),
    ),
);

const thenSavedCounterStateIs0 = Bdd.then`the saved counter state is 0`(
  (state: EventSourcingScenarioState) =>
    Effect.flatMap(expectSavedCounter(state), (saved) =>
      Effect.sync(() => {
        assertCounterState(saved, 0);
        return state;
      }),
    ),
);

const thenSavedCounterVersionIs1 = Bdd.then`the saved counter version is 1`(
  (state: EventSourcingScenarioState) =>
    Effect.flatMap(expectSavedCounter(state), (saved) =>
      Effect.sync(() => {
        assertCounterVersion(saved, 1);
        return state;
      }),
    ),
);

const thenSavedCounterVersionIs0 = Bdd.then`the saved counter version is 0`(
  (state: EventSourcingScenarioState) =>
    Effect.flatMap(expectSavedCounter(state), (saved) =>
      Effect.sync(() => {
        assertCounterVersion(saved, 0);
        return state;
      }),
    ),
);

const thenSavedCounterHasNoUnsavedFacts = Bdd.then`the saved counter has no unsaved facts`(
  (state: EventSourcingScenarioState) =>
    Effect.flatMap(expectSavedCounter(state), (saved) =>
      Effect.sync(() => {
        assertNoPendingEvents(saved);
        return state;
      }),
    ),
);

const thenSaveRejectedWithExpectedVersionConflict =
  Bdd.then`the save is rejected with an expected version conflict`(
    (state: EventSourcingScenarioState) =>
      Effect.flatMap(requiredScenarioValue(state.saveConflict, "saveConflict"), (conflict) =>
        Effect.sync(() => {
          assertExpectedVersionConflict(conflict);
          return state;
        }),
      ),
  );

const thenFirstRepositoryLoadsSharedIdWithState1 =
  Bdd.then`the first repository loads shared-id with state 1`((state: EventSourcingScenarioState) =>
    Effect.flatMap(
      requiredScenarioValue(state.firstLoadedCounter, "firstLoadedCounter"),
      (loaded) =>
        Effect.sync(() => {
          assertCleanAggregate(loaded, 1, 1);
          return state;
        }),
    ),
  );

const thenSecondRepositoryLoadsSharedIdWithState2 =
  Bdd.then`the second repository loads shared-id with state 2`(
    (state: EventSourcingScenarioState) =>
      Effect.flatMap(
        requiredScenarioValue(state.secondLoadedCounter, "secondLoadedCounter"),
        (loaded) =>
          Effect.sync(() => {
            assertCleanAggregate(loaded, 2, 1);
            return state;
          }),
      ),
  );

const thenEachRepositoryOnlySeesItsOwnFacts = Bdd.then`each repository only sees its own facts`(
  (state: EventSourcingScenarioState) =>
    Effect.flatMap(expectEventStore(state), (store) =>
      Effect.sync(() => {
        assertIsolatedRepositoryFacts(store, [
          ["first:shared-id", [incremented(1)]],
          ["second:shared-id", [incremented(2)]],
        ]);
        return state;
      }),
    ),
);

const missingAggregatesLoadAsCleanInitialState = Bdd.scenario(
  "Missing aggregates load as clean initial state",
).pipe(
  givenEventStoreContainsCounterStreams,
  whenCounterRepositoryLoadsCounter1,
  thenLoadedCounterStateIs0,
  thenLoadedCounterVersionIs0,
  thenLoadedCounterHasNoUnsavedFacts,
);

const existingAggregatesRehydrateFromRecordedFacts = Bdd.scenario(
  "Existing aggregates rehydrate from recorded facts",
).pipe(
  givenEventStoreContainsCounterStreams,
  givenStreamContainsCounterCreationAndIncrementOf2,
  whenCounterRepositoryLoadsCounter1,
  thenLoadedCounterStateIs2,
  thenLoadedCounterVersionIs2,
  thenLoadedCounterHasNoUnsavedFacts,
);

const changedAggregatesAppendOnlyPendingFacts = Bdd.scenario(
  "Changed aggregates append only pending facts",
).pipe(
  givenEventStoreContainsCounterStreams,
  givenCounterRepositoryLoadedCounter1,
  whenLoadedCounterIncrementedBy3,
  whenLoadedCounterSaved,
  thenSavedCounterStateIs3,
  thenSavedCounterVersionIs1,
  thenSavedCounterHasNoUnsavedFacts,
  thenStreamContainsFactsInOrder,
);

const unchangedAggregatesDoNotAppendFacts = Bdd.scenario(
  "Unchanged aggregates do not append facts",
).pipe(
  givenEventStoreContainsCounterStreams,
  givenCounterRepositoryLoadedCounter1,
  whenLoadedCounterSaved,
  thenSavedCounterStateIs0,
  thenSavedCounterVersionIs0,
  thenStreamContainsNoFacts,
);

const staleAggregateCopiesCannotOverwriteNewerFacts = Bdd.scenario(
  "Stale aggregate copies cannot overwrite newer facts",
).pipe(
  givenEventStoreContainsCounterStreams,
  givenTwoCopiesOfCounter1LoadedAtSameVersion,
  givenFirstCopySavedIncrementOf1,
  whenSecondCopyTriesToSaveIncrementOf2,
  thenSaveRejectedWithExpectedVersionConflict,
  thenConflictReportsExpectedAndActualVersion,
  thenStreamContainsFactsInOrder,
);

const streamNamingIsolatesRepositoriesThatShareDomainIds = Bdd.scenario(
  "Stream naming isolates repositories that share domain ids",
).pipe(
  givenEventStoreContainsCounterStreams,
  givenTwoCounterRepositoriesUseDifferentStreamNames,
  whenBothRepositoriesSaveCounterNamedSharedId,
  thenFirstRepositoryLoadsSharedIdWithState1,
  thenSecondRepositoryLoadsSharedIdWithState2,
  thenEachRepositoryOnlySeesItsOwnFacts,
);

export const aggregateRepositoryContract = Bdd.feature("Aggregate repository contract").pipe(
  missingAggregatesLoadAsCleanInitialState,
  existingAggregatesRehydrateFromRecordedFacts,
  changedAggregatesAppendOnlyPendingFacts,
  unchangedAggregatesDoNotAppendFacts,
  staleAggregateCopiesCannotOverwriteNewerFacts,
  streamNamingIsolatesRepositoriesThatShareDomainIds,
);
