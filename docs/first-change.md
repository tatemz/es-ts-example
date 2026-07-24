# Your First Change: Add `resetCounter`

This walks one new command from the domain out to both views. `resetCounter`
sets an active counter back to zero and refuses to touch a disabled one.

Work outward from the domain and run the cheapest check after each step. If a
step needs a rule the previous layer does not have, you are going the wrong way:
business rules only live in `packages/domain`.

## 1. Say what happened

`packages/domain/src/counter/Events.ts` — add the fact, in the past tense, and
put it in the `CounterEvent` union.

```typescript
export const CounterReset = Schema.TaggedStruct("CounterReset", {
  counterId: Identifiers.CounterId,
});
export type CounterReset = typeof CounterReset.Type;
```

## 2. Decide what each state does with it

`packages/domain/src/counter/Reducer.ts` — the reducer branches on state first,
so the compiler will now demand an arm in all three states. Answer each one:

- `CounterNotCreated` ignores it. A log that resets a counter that was never
  created stays not-created.
- `ActiveCounter` becomes value zero.
- `DisabledCounter` ignores it. Disable freezes the counter, during replay too.

The property tests in `packages/domain/test/property` generate arbitrary logs,
including ones no decision would ever write. They will fail if your arm breaks
those invariants, which is the point.

## 3. Say why it can be refused

`packages/domain/src/counter/Rejections.ts` — reuse `counterDoesNotExist` and
`counterIsDisabled`, and add a `ResetCounterError` union next to the existing
per-decision error types.

## 4. Write the decision

`packages/domain/src/counter/Decisions.ts` — name it for the command, not the
event. Guard the rejections first, then accept:

```typescript
export const resetCounter =
  () =>
  (aggregate: Aggregate.CounterAggregate): CounterDecision<ResetCounterError> => {
    if (Schema.is(State.CounterNotCreated)(aggregate.state)) {
      return rejectMissingCounter(aggregate);
    }
    if (Schema.is(State.DisabledCounter)(aggregate.state)) {
      return rejectDisabledCounter(aggregate);
    }

    return EventSourcingDecision.accept(
      Aggregate.recordCounterEvent(Events.CounterReset.make({ counterId: aggregate.aggregateId }))(
        aggregate,
      ),
    );
  };
```

```shell
bun --filter @es-ts-example/domain test
```

The domain is done. Nothing below this point makes another business decision.

## 5. Name the command

`packages/application/src/counter/commands.ts` — add `ResetCounterCommand` and
put it in the `CounterCommand` union.

## 6. Publish the contract

`packages/application/src/counter/rpc.ts` — add the `Rpc.make` entry and widen
`CounterDomainError` with any new rejection tags. The error union is the whole
point of this file: a caller must be able to tell "counter is disabled" from
"the disk is full" without a cast.

## 7. Route the command

`packages/application/src/counter/handlers.ts` — add the arm to `decide` and the
entry to `CounterCommandApi.of`. `Match.valueTags` is exhaustive, so the
compiler tells you both places.

```shell
bun --filter @es-ts-example/application test
```

## 8. Add the terminal verb

`packages/cli/src/index.ts` — add `reset` to `verbsByArgument`, a line to
`usageLines`, and an arm to `sendCounterCommand`.

```shell
bun --filter @es-ts-example/cli test
```

## 9. Add the web action

The web layer is four files with one job each:

1. `packages/web/src/factories/pages/CounterPage.factory.ts` — add the reset
   entry to `counterActions`, and its label to
   `packages/web/src/i18n/counter.messages.ts`. Every presentation decision
   happens here.
2. `packages/web/src/controllers/postCounterCommand.controller.ts` — accept the
   new verb and map its failure to a redirect.
3. `packages/web/src/server.ts` — widen `RunCounterCommandBody`'s verb literals.
4. The view needs no change: it renders whatever actions the factory produced.

```shell
bun --filter @es-ts-example/web test
```

The view unit tests assert whole rendered HTML strings, so expect to update
those expected strings. Read the diff before you paste it: that is the moment
you find out whether you rendered what you meant to.

## 10. Run the gate

```shell
bun run check:without-mutation
bun run check
```

`check` includes mutation testing at a 100% threshold. A surviving mutant almost
always means a test asserted that something happened rather than asserting what
happened. Fix the assertion, not the threshold.
