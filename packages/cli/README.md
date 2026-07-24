# @es-ts-example/cli

This package is the terminal view over the application RPC clients. It is the
smallest complete consumer of the application layer: read `src/index.ts` top to
bottom and you have seen a whole command flow, from argv to event store and back
to rendered output.

## Running It

```shell
bun run start:cli -- list
bun run start:cli -- create counter-1
bun run start:cli -- increment counter-1
bun run start:cli -- bookmark user-1 article-1
```

`EVENT_STORE_FILE` selects the json-file event store and defaults to
`.counter-events.json` in the working directory. The CLI is always backed by the
json-file store, so a session survives between runs and you can read the raw
event log with any text editor.

## Shape

The file has three phases, in this order:

1. `parseArguments` turns argv into a tagged `CliAction`. Unrecognized or
   incomplete input becomes `Help`; nothing else in the file has to handle a
   missing id.
2. `render*` functions turn one application read model into strings. They are
   pure, which is why the property tests can drive them directly.
3. `executeAction` and `runCli` do the effectful work: resolve a client tag, send
   the command or query, and hand the result to a renderer.

`bin/main.ts` is the only place that touches `process`, `Bun.argv`, and the
console.

## Boundary

The CLI depends on `@es-ts-example/application` and nothing below it. It never
imports `@es-ts-example/domain` or an event store directly, and it never decides
business rules: a rejected command surfaces as an RPC failure that the runtime
reports. Adding a verb means adding a case here and a contract there, never a
new rule.

## Local Feedback

```shell
bun --filter @es-ts-example/cli test
bun --filter @es-ts-example/cli test:property
bun --filter @es-ts-example/cli e2e
bun --filter @es-ts-example/cli lint
bun --filter @es-ts-example/cli mutation:dev
```
