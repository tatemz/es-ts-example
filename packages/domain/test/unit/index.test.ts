import { expect, test } from "bun:test";
import * as Schema from "effect/Schema";
import * as Domain from "../../src/index.ts";

const counterId = Domain.CounterId.make("counter-1");

test("domain event schema accepts counter events", () => {
  const decodeDomainEvent = Schema.decodeUnknownSync(Domain.DomainEvent);
  const counterCreated = Domain.CounterCreated.make({ counterId });
  const counterIncremented = Domain.CounterIncremented.make({ counterId });

  expect({
    counterCreated: decodeDomainEvent(counterCreated),
    counterIncremented: decodeDomainEvent(counterIncremented),
  }).toEqual({
    counterCreated: Domain.CounterCreated.make({ counterId }),
    counterIncremented: Domain.CounterIncremented.make({ counterId }),
  });
});

test("domain event schema rejects unknown events", () => {
  const isDomainEvent = Schema.is(Domain.DomainEvent);

  expect({
    counter: isDomainEvent(Domain.CounterCreated.make({ counterId })),
    unknown: isDomainEvent({ _tag: "NotACounterEvent", counterId }),
  }).toEqual({
    counter: true,
    unknown: false,
  });
});
