import * as Domain from "@es-ts-example/domain";
import * as EventStore from "@es-ts-example/event-sourcing/event-store";
import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import * as Fn from "effect/Function";
import * as Option from "effect/Option";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import { Bdd } from "effect-bdd";
import {
  type CounterCommandError,
  type CounterRead,
  makeCreateCounterHandler,
  makeDecrementCounterHandler,
  makeDisableCounterHandler,
  makeIncrementCounterHandler,
  makeListCountersHandler,
} from "../../../src/index.ts";
import { assertCounterIsActive, assertCounterValue } from "../support/Assertions.ts";

const counterId = Domain.CounterId.make("counter-1");

type CounterScenarioState = {
  readonly store: EventStore.EventStore<Domain.CounterEvent> | undefined;
  readonly result: Result.Result<Domain.CounterAggregate, CounterCommandError> | undefined;
};

const initialScenarioState: CounterScenarioState = {
  store: undefined,
  result: undefined,
};

const resetScenario = (): Effect.Effect<CounterScenarioState> =>
  Effect.map(EventStore.makeInMemoryEventStore<Domain.CounterEvent>(), (store) => ({
    ...initialScenarioState,
    store,
  }));

const reject = (message: string): Effect.Effect<never, string> => Effect.fail(message);

const expectStore = (
  state: CounterScenarioState,
): Effect.Effect<EventStore.EventStore<Domain.CounterEvent>, string> => {
  const store = state.store;

  return store === undefined ? reject("Expected a counter event store.") : Effect.succeed(store);
};

const expectResult = (
  state: CounterScenarioState,
): Effect.Effect<Result.Result<Domain.CounterAggregate, CounterCommandError>, string> => {
  const result = state.result;

  return result === undefined
    ? reject("Expected a counter command result.")
    : Effect.succeed(result);
};

const recordCommandResult = (
  state: CounterScenarioState,
  handled: Effect.Effect<Domain.CounterAggregate, CounterCommandError>,
): Effect.Effect<CounterScenarioState> =>
  Effect.map(Effect.result(handled), (result) => ({
    ...state,
    result,
  }));

const createCounter = (state: CounterScenarioState): Effect.Effect<CounterScenarioState, string> =>
  Effect.flatMap(expectStore(state), (store) =>
    recordCommandResult(
      state,
      makeCreateCounterHandler(store)({ _tag: "CreateCounter", counterId }),
    ),
  );

const incrementCounter = (
  state: CounterScenarioState,
): Effect.Effect<CounterScenarioState, string> =>
  Effect.flatMap(expectStore(state), (store) =>
    recordCommandResult(
      state,
      makeIncrementCounterHandler(store)({ _tag: "IncrementCounter", counterId }),
    ),
  );

const incrementCounterTimes = (
  state: CounterScenarioState,
  times: number,
): Effect.Effect<CounterScenarioState, string> =>
  Fn.pipe(
    Arr.range(1, times),
    Arr.reduce(Effect.succeed(state) as Effect.Effect<CounterScenarioState, string>, (pending) =>
      Effect.flatMap(pending, incrementCounter),
    ),
  );

const decrementCounter = (
  state: CounterScenarioState,
): Effect.Effect<CounterScenarioState, string> =>
  Effect.flatMap(expectStore(state), (store) =>
    recordCommandResult(
      state,
      makeDecrementCounterHandler(store)({ _tag: "DecrementCounter", counterId }),
    ),
  );

const disableCounter = (state: CounterScenarioState): Effect.Effect<CounterScenarioState, string> =>
  Effect.flatMap(expectStore(state), (store) =>
    recordCommandResult(
      state,
      makeDisableCounterHandler(store)({ _tag: "DisableCounter", counterId }),
    ),
  );

const projectedCounter = (state: CounterScenarioState): Effect.Effect<CounterRead, string> =>
  Effect.flatMap(expectStore(state), (store) =>
    Effect.flatMap(makeListCountersHandler(store)(), (projection) => {
      const counter = Fn.pipe(projection.counters, Arr.head, Option.getOrUndefined);

      return counter === undefined
        ? reject("Expected the counter to be projected.")
        : Effect.succeed(counter);
    }),
  );

const count = Bdd.capture("count", Schema.FiniteFromString);
const expectedValue = Bdd.capture("expectedValue", Schema.FiniteFromString);

type CountCaptures = { readonly count: number };
type ExpectedValueCaptures = { readonly expectedValue: number };

const rejectCounterChange = (
  state: CounterScenarioState,
  tag: CounterCommandError["_tag"],
): Effect.Effect<CounterScenarioState, string> =>
  Effect.flatMap(expectResult(state), (result) => {
    if (Result.isSuccess(result)) {
      return reject(
        `Expected counter command result to be rejected with ${tag}, but it was accepted.`,
      );
    }

    const failureTag = result.failure._tag;

    return failureTag === tag
      ? Effect.succeed(state)
      : reject(
          `Expected counter command result to be rejected with ${tag}, but it was rejected with ${failureTag}.`,
        );
  });

const givenNoCounterExists = Bdd.given`no counter exists`(() => resetScenario());

const givenCounterWasCreated = Bdd.given`a counter was created`(() =>
  Effect.flatMap(resetScenario(), createCounter),
);

const givenCounterAtValue = Bdd.given`a counter at value ${count}`(({ count }: CountCaptures) =>
  Effect.flatMap(Effect.flatMap(resetScenario(), createCounter), (created) =>
    incrementCounterTimes(created, count),
  ),
);

const whenCounterIsCreated = Bdd.when`the counter is created`((state: CounterScenarioState) =>
  createCounter(state),
);

const whenCounterIsCreatedAgain = Bdd.when`the counter is created again`(
  (state: CounterScenarioState) => createCounter(state),
);

const whenCounterIsIncremented = Bdd.when`the counter is incremented`(
  (state: CounterScenarioState) => incrementCounter(state),
);

const whenCounterIsIncrementedTimes = Bdd.when`the counter is incremented ${count} times`(
  ({ count }: CountCaptures, state: CounterScenarioState) => incrementCounterTimes(state, count),
);

const whenCounterIsDecremented = Bdd.when`the counter is decremented`(
  (state: CounterScenarioState) => decrementCounter(state),
);

const whenCounterIsDisabled = Bdd.when`the counter is disabled`((state: CounterScenarioState) =>
  disableCounter(state),
);

const thenCounterValueIs = Bdd.then`the counter value is ${expectedValue}`(
  ({ expectedValue }: ExpectedValueCaptures, state: CounterScenarioState) =>
    Effect.map(projectedCounter(state), (read) => {
      assertCounterValue(read.value, expectedValue);
      return state;
    }),
);

const thenCounterIsActive = Bdd.then`the counter is active`((state: CounterScenarioState) =>
  Effect.map(projectedCounter(state), (read) => {
    assertCounterIsActive(read.status === "active");
    return state;
  }),
);

const thenChangeRejectedBecauseCounterReachedMaximum =
  Bdd.then`the change is rejected because the counter reached its maximum`(
    (state: CounterScenarioState) => rejectCounterChange(state, "CounterMaximumReached"),
  );

const thenChangeRejectedBecauseCounterReachedMinimum =
  Bdd.then`the change is rejected because the counter reached its minimum`(
    (state: CounterScenarioState) => rejectCounterChange(state, "CounterMinimumReached"),
  );

const thenChangeRejectedBecauseCounterIsDisabled =
  Bdd.then`the change is rejected because the counter is disabled`((state: CounterScenarioState) =>
    rejectCounterChange(state, "CounterIsDisabled"),
  );

const thenCounterCannotBeChangedBecauseItDoesNotExist =
  Bdd.then`the counter cannot be changed because it does not exist`((state: CounterScenarioState) =>
    rejectCounterChange(state, "CounterDoesNotExist"),
  );

const creatingCounter = Bdd.scenario("Creating a counter").pipe(
  givenNoCounterExists,
  whenCounterIsCreated,
  thenCounterValueIs,
  thenCounterIsActive,
);

const creatingAgainLeavesExistingCounterActive = Bdd.scenario(
  "Creating again leaves the existing counter active",
).pipe(givenCounterWasCreated, whenCounterIsCreatedAgain, thenCounterIsActive);

const countingUp = Bdd.scenario("Counting up").pipe(
  givenCounterWasCreated,
  whenCounterIsIncrementedTimes,
  thenCounterValueIs,
);

const countingDown = Bdd.scenario("Counting down").pipe(
  givenCounterAtValue,
  whenCounterIsDecremented,
  thenCounterValueIs,
);

const counterNeverCountsAboveFive = Bdd.scenario("The counter never counts above 5").pipe(
  givenCounterAtValue,
  whenCounterIsIncremented,
  thenChangeRejectedBecauseCounterReachedMaximum,
);

const counterNeverCountsBelowZero = Bdd.scenario("The counter never counts below 0").pipe(
  givenCounterWasCreated,
  whenCounterIsDecremented,
  thenChangeRejectedBecauseCounterReachedMinimum,
);

const disablingCounterFreezesIt = Bdd.scenario("Disabling a counter freezes it").pipe(
  givenCounterAtValue,
  whenCounterIsDisabled,
  whenCounterIsIncremented,
  thenChangeRejectedBecauseCounterIsDisabled,
);

const missingCounterCannotChange = Bdd.scenario("A missing counter cannot change").pipe(
  givenNoCounterExists,
  whenCounterIsIncremented,
  thenCounterCannotBeChangedBecauseItDoesNotExist,
);

export const counter = Bdd.feature("Counter").pipe(
  creatingCounter,
  creatingAgainLeavesExistingCounterActive,
  countingUp,
  countingDown,
  counterNeverCountsAboveFive,
  counterNeverCountsBelowZero,
  disablingCounterFreezesIt,
  missingCounterCannotChange,
);
