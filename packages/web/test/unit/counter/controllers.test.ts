import { expect } from "bun:test";
import * as Application from "@es-ts-example/application";
import { testEffect } from "@es-ts-example/test-support/TestEffect";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { getCounterPageController } from "../../../src/controllers/getCounterPage.controller.ts";
import { postCounterCommandController } from "../../../src/controllers/postCounterCommand.controller.ts";
import { postCreateCounterController } from "../../../src/controllers/postCreateCounter.controller.ts";

const localClients = Layer.mergeAll(
  Application.CounterCommandClientLive,
  Application.CounterQueryClientLive,
).pipe(Layer.provide(Application.DomainEventStore.inMemory));

const createCounter = (
  commands: Application.CounterCommandClient,
  id: string,
): Effect.Effect<Application.CounterCommandReceipt, Application.CounterCommandError> =>
  commands.CreateCounter({ _tag: "CreateCounter", counterId: Application.CounterId.make(id) });

testEffect("getCounterPageController projects the store and normalizes error hints", () =>
  Effect.gen(function* () {
    const commands = yield* Application.CounterCommandClient;
    yield* createCounter(commands, "alpha");

    const page = yield* getCounterPageController({});
    const missing = yield* getCounterPageController({ error: "missing-id" });
    const failed = yield* getCounterPageController({ error: "command-failed" });
    const unknown = yield* getCounterPageController({ error: "bogus", newCounterId: "beta" });

    expect({
      list: page.list._tag,
      row: page.list._tag === "CounterListPopulated" ? page.list.rows[0].counterId : "none",
      missingField: missing.newCounterField.presentation._tag,
      missingAlert: missing.alert._tag,
      failedAlert: failed.alert._tag,
      failedField: failed.newCounterField.presentation._tag,
      unknownField: unknown.newCounterField.presentation._tag,
      unknownAlert: unknown.alert._tag,
      unknownValue: unknown.newCounterField.value,
    }).toEqual({
      list: "CounterListPopulated",
      row: "alpha",
      missingField: "TextFieldPresentationError",
      missingAlert: "AlertHidden",
      failedAlert: "AlertVisible",
      failedField: "TextFieldPresentationDefault",
      unknownField: "TextFieldPresentationDefault",
      unknownAlert: "AlertHidden",
      unknownValue: "beta",
    });
  }).pipe(Effect.provide(localClients)),
);

testEffect("postCreateCounterController validates, creates, and reports command failures", () =>
  Effect.gen(function* () {
    const blank = yield* postCreateCounterController({ counterId: "   " });
    const created = yield* postCreateCounterController({ counterId: "alpha" });
    const duplicate = yield* postCreateCounterController({ counterId: "alpha" });

    expect({ blank, created, duplicate }).toEqual({
      blank: "/?error=missing-id",
      created: "/",
      duplicate: "/?error=command-failed&newCounterId=alpha",
    });
  }).pipe(Effect.provide(localClients)),
);

testEffect("postCounterCommandController dispatches each verb and guards the rest", () =>
  Effect.gen(function* () {
    const commands = yield* Application.CounterCommandClient;
    yield* createCounter(commands, "alpha");
    yield* createCounter(commands, "gamma");

    const incremented = yield* postCounterCommandController({
      counterId: "alpha",
      verb: "increment",
    });
    const decremented = yield* postCounterCommandController({
      counterId: "alpha",
      verb: "decrement",
    });
    const disabled = yield* postCounterCommandController({ counterId: "alpha", verb: "disable" });
    const unknownOnActive = yield* postCounterCommandController({
      counterId: "gamma",
      verb: "teleport",
    });
    const missing = yield* postCounterCommandController({ counterId: "ghost", verb: "increment" });

    expect({ incremented, decremented, disabled, unknownOnActive, missing }).toEqual({
      incremented: "/",
      decremented: "/",
      disabled: "/",
      unknownOnActive: "/?error=command-failed",
      missing: "/?error=command-failed",
    });
  }).pipe(Effect.provide(localClients)),
);
