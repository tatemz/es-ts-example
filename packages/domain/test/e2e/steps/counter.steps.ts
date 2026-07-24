import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import * as Fn from "effect/Function";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import { Bdd } from "effect-bdd";
import * as Domain from "../../../src/index.ts";
import { assertCounterIsActive, assertCounterValue } from "../support/Assertions.ts";

const counterId = Domain.CounterId.make("counter-1");

type CounterStepError =
  | Domain.CreateCounterError
  | Domain.IncrementCounterError
  | Domain.DecrementCounterError
  | Domain.DisableCounterError;

type CounterScenarioState = {
  readonly counter: Domain.CounterAggregate | undefined;
  readonly decision: Domain.CounterDecision<CounterStepError> | undefined;
};

const initialScenarioState: CounterScenarioState = {
  counter: undefined,
  decision: undefined,
};

const resetScenario = (): CounterScenarioState => ({
  ...initialScenarioState,
  counter: Domain.newCounter(counterId),
});

const reject = (message: string): Effect.Effect<never, string> => Effect.fail(message);

const expectCounter = (
  state: CounterScenarioState,
): Effect.Effect<Domain.CounterAggregate, string> => {
  const counter = state.counter;

  return counter === undefined ? reject("Expected a counter aggregate.") : Effect.succeed(counter);
};

const expectDecision = (
  state: CounterScenarioState,
): Effect.Effect<Domain.CounterDecision<CounterStepError>, string> => {
  const decision = state.decision;

  return decision === undefined ? reject("Expected a counter decision.") : Effect.succeed(decision);
};

const expectCounterValue = (state: CounterScenarioState): Effect.Effect<number, string> =>
  Effect.flatMap(expectCounter(state), (counter) =>
    Schema.is(Domain.CounterNotCreated)(counter.state)
      ? reject("Expected the counter to be created.")
      : Effect.succeed(counter.state.value),
  );

const recordDecisionResult = (
  state: CounterScenarioState,
  nextDecision: Domain.CounterDecision<CounterStepError>,
): CounterScenarioState => ({
  ...state,
  counter: Result.isSuccess(nextDecision) ? nextDecision.success : state.counter,
  decision: nextDecision,
});

const createCounter = (state: CounterScenarioState): CounterScenarioState =>
  recordDecisionResult(
    state,
    Domain.createCounter({ counterId })(state.counter ?? Domain.newCounter(counterId)),
  );

const incrementCounter = (state: CounterScenarioState): CounterScenarioState =>
  recordDecisionResult(
    state,
    Domain.incrementCounter()(state.counter ?? Domain.newCounter(counterId)),
  );

const incrementCounterTimes = (state: CounterScenarioState, times: number): CounterScenarioState =>
  Fn.pipe(
    Arr.range(1, times),
    Arr.reduce(state, (current) => incrementCounter(current)),
  );

const decrementCounter = (state: CounterScenarioState): CounterScenarioState =>
  recordDecisionResult(
    state,
    Domain.decrementCounter()(state.counter ?? Domain.newCounter(counterId)),
  );

const disableCounter = (state: CounterScenarioState): CounterScenarioState =>
  recordDecisionResult(
    state,
    Domain.disableCounter()(state.counter ?? Domain.newCounter(counterId)),
  );

const count = Bdd.capture("count", Schema.FiniteFromString);
const expectedValue = Bdd.capture("expectedValue", Schema.FiniteFromString);

type CountCaptures = { readonly count: number };
type ExpectedValueCaptures = { readonly expectedValue: number };

const expectRejectedCounterChange = (
  state: CounterScenarioState,
  tag: CounterStepError["_tag"],
): Effect.Effect<CounterScenarioState, string> =>
  Effect.flatMap(expectDecision(state), (decision) => {
    if (Result.isSuccess(decision)) {
      return reject(`Expected counter decision to be rejected with ${tag}, but it was accepted.`);
    }

    const failureTag = decision.failure._tag;

    return failureTag === tag
      ? Effect.succeed(state)
      : reject(
          `Expected counter decision to be rejected with ${tag}, but it was rejected with ${failureTag}.`,
        );
  });

const givenNoCounterExists = Bdd.given`no counter exists`(() => Effect.succeed(resetScenario()));

const givenCounterWasCreated = Bdd.given`a counter was created`(() =>
  Effect.succeed(createCounter(resetScenario())),
);

const givenCounterAtValue = Bdd.given`a counter at value ${count}`(({ count }: CountCaptures) =>
  Effect.succeed(incrementCounterTimes(createCounter(resetScenario()), count)),
);

const whenCounterIsCreated = Bdd.when`the counter is created`((state: CounterScenarioState) =>
  Effect.succeed(createCounter(state)),
);

const whenCounterIsCreatedAgain = Bdd.when`the counter is created again`(
  (state: CounterScenarioState) => Effect.succeed(createCounter(state)),
);

const whenCounterIsIncremented = Bdd.when`the counter is incremented`(
  (state: CounterScenarioState) => Effect.succeed(incrementCounter(state)),
);

const whenCounterIsIncrementedTimes = Bdd.when`the counter is incremented ${count} times`(
  ({ count }: CountCaptures, state: CounterScenarioState) =>
    Effect.succeed(incrementCounterTimes(state, count)),
);

const whenCounterIsDecremented = Bdd.when`the counter is decremented`(
  (state: CounterScenarioState) => Effect.succeed(decrementCounter(state)),
);

const whenCounterIsDisabled = Bdd.when`the counter is disabled`((state: CounterScenarioState) =>
  Effect.succeed(disableCounter(state)),
);

const thenCounterValueIs = Bdd.then`the counter value is ${expectedValue}`(
  ({ expectedValue }: ExpectedValueCaptures, state: CounterScenarioState) =>
    Effect.map(expectCounterValue(state), (value) => {
      assertCounterValue(value, expectedValue);
      return state;
    }),
);

const thenCounterIsActive = Bdd.then`the counter is active`((state: CounterScenarioState) =>
  Effect.map(expectCounter(state), (counter) => {
    assertCounterIsActive(Schema.is(Domain.ActiveCounter)(counter.state));
    return state;
  }),
);

const thenChangeIsRejectedBecauseCounterReachedMaximum =
  Bdd.then`the change is rejected because the counter reached its maximum`(
    (state: CounterScenarioState) => expectRejectedCounterChange(state, "CounterMaximumReached"),
  );

const thenChangeIsRejectedBecauseCounterReachedMinimum =
  Bdd.then`the change is rejected because the counter reached its minimum`(
    (state: CounterScenarioState) => expectRejectedCounterChange(state, "CounterMinimumReached"),
  );

const thenChangeIsRejectedBecauseCounterIsDisabled =
  Bdd.then`the change is rejected because the counter is disabled`((state: CounterScenarioState) =>
    expectRejectedCounterChange(state, "CounterIsDisabled"),
  );

const thenCounterCannotBeChangedBecauseItDoesNotExist =
  Bdd.then`the counter cannot be changed because it does not exist`((state: CounterScenarioState) =>
    expectRejectedCounterChange(state, "CounterDoesNotExist"),
  );

const creatingACounter = Bdd.scenario("Creating a counter").pipe(
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
  thenChangeIsRejectedBecauseCounterReachedMaximum,
);

const counterNeverCountsBelowZero = Bdd.scenario("The counter never counts below 0").pipe(
  givenCounterWasCreated,
  whenCounterIsDecremented,
  thenChangeIsRejectedBecauseCounterReachedMinimum,
);

const disablingCounterFreezesIt = Bdd.scenario("Disabling a counter freezes it").pipe(
  givenCounterAtValue,
  whenCounterIsDisabled,
  whenCounterIsIncremented,
  thenChangeIsRejectedBecauseCounterIsDisabled,
);

const missingCounterCannotChange = Bdd.scenario("A missing counter cannot change").pipe(
  givenNoCounterExists,
  whenCounterIsIncremented,
  thenCounterCannotBeChangedBecauseItDoesNotExist,
);

export const counter = Bdd.feature("Counter").pipe(
  creatingACounter,
  creatingAgainLeavesExistingCounterActive,
  countingUp,
  countingDown,
  counterNeverCountsAboveFive,
  counterNeverCountsBelowZero,
  disablingCounterFreezesIt,
  missingCounterCannotChange,
);
