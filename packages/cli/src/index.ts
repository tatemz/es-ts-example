import * as Application from "@es-ts-example/application";
import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import type * as FileSystem from "effect/FileSystem";
import * as Fn from "effect/Function";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Rec from "effect/Record";

type CommandVerb = "Create" | "Increment" | "Decrement" | "Disable";

type CounterAction =
  | {
      readonly _tag: "Command";
      readonly verb: CommandVerb;
      readonly counterId: Application.CounterId;
    }
  | { readonly _tag: "List" }
  | { readonly _tag: "Help"; readonly message: string };

const usageLines: ReadonlyArray<string> = [
  "Usage: counter <command> [counterId]",
  "",
  "Commands:",
  "  create <counterId>     Start a new counter at zero",
  "  increment <counterId>  Add one to a counter",
  "  decrement <counterId>  Subtract one from a counter",
  "  disable <counterId>    Retire a counter",
  "  list                   Show every counter rebuilt from its events",
];

export const usage: string = Arr.join(usageLines, "\n");

const verbTags: Readonly<Record<string, CommandVerb>> = {
  create: "Create",
  increment: "Increment",
  decrement: "Decrement",
  disable: "Disable",
};

const helpAction: CounterAction = { _tag: "Help", message: usage };

const commandAction = (verb: CommandVerb, rawId: string | undefined): CounterAction =>
  rawId === undefined || rawId === ""
    ? helpAction
    : { _tag: "Command", verb, counterId: Application.CounterId.make(rawId) };

export const parseArguments = (argv: ReadonlyArray<string>): CounterAction => {
  const [verb, rawId] = argv;
  if (verb === "list") {
    return { _tag: "List" };
  }
  return Fn.pipe(
    Option.fromUndefinedOr(verb),
    Option.flatMap((name) => Rec.get(verbTags, name)),
    Option.match({
      onNone: () => helpAction,
      onSome: (resolved) => commandAction(resolved, rawId),
    }),
  );
};

export const renderCounter = (counter: Application.CounterRead): string =>
  `#${counter.counterId} value=${counter.value} status=${counter.status} version=${counter.version}`;

export const renderReceipt = (counter: Application.CounterRead): string =>
  `Applied ${renderCounter(counter)}`;

export const renderList = (list: Application.CounterList): ReadonlyArray<string> =>
  Arr.match(list.counters, {
    onEmpty: () => Arr.of("No counters yet."),
    onNonEmpty: (counters) => Arr.prepend(Arr.map(counters, renderCounter), "Counters:"),
  });

const dispatch = (
  commands: Application.CounterCommandClient,
  verb: CommandVerb,
  counterId: Application.CounterId,
): Effect.Effect<Application.CounterCommandReceipt, Application.CounterCommandError> => {
  if (verb === "Create") {
    return commands.CreateCounter({ _tag: "CreateCounter", counterId });
  }
  if (verb === "Increment") {
    return commands.IncrementCounter({ _tag: "IncrementCounter", counterId });
  }
  if (verb === "Decrement") {
    return commands.DecrementCounter({ _tag: "DecrementCounter", counterId });
  }
  return commands.DisableCounter({ _tag: "DisableCounter", counterId });
};

const listLines = (): Effect.Effect<
  ReadonlyArray<string>,
  Application.CounterQueryError,
  Application.CounterQueryClient
> =>
  Effect.gen(function* () {
    const queries = yield* Application.CounterQueryClient;
    const list = yield* queries.ListCounters({});
    return renderList(list);
  });

const commandLines = (
  verb: CommandVerb,
  counterId: Application.CounterId,
): Effect.Effect<
  ReadonlyArray<string>,
  Application.CounterCommandError | Application.CounterQueryError,
  Application.CounterCommandClient | Application.CounterQueryClient
> =>
  Effect.gen(function* () {
    const commands = yield* Application.CounterCommandClient;
    const receipt = yield* dispatch(commands, verb, counterId);
    const listing = yield* listLines();
    return Arr.prepend(listing, renderReceipt(receipt));
  });

export const executeAction = (
  action: CounterAction,
): Effect.Effect<
  ReadonlyArray<string>,
  Application.CounterCommandError | Application.CounterQueryError,
  Application.CounterCommandClient | Application.CounterQueryClient
> => {
  if (action._tag === "Help") {
    return Effect.succeed(Arr.of(action.message));
  }
  if (action._tag === "List") {
    return listLines();
  }
  return commandLines(action.verb, action.counterId);
};

const counterCliLayer = (
  filePath: string,
): Layer.Layer<
  Application.CounterCommandClient | Application.CounterQueryClient,
  never,
  FileSystem.FileSystem
> =>
  Layer.mergeAll(Application.CounterCommandClientLive, Application.CounterQueryClientLive).pipe(
    Layer.provide(Application.DomainEventStore.jsonFile(filePath)),
  );

export const runCli = (
  argv: ReadonlyArray<string>,
  filePath: string,
): Effect.Effect<
  ReadonlyArray<string>,
  Application.CounterCommandError | Application.CounterQueryError,
  FileSystem.FileSystem
> => executeAction(parseArguments(argv)).pipe(Effect.provide(counterCliLayer(filePath)));
