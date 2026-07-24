import * as BunServices from "@effect/platform-bun/BunServices";
import { expect, test } from "bun:test";
import * as Application from "@es-ts-example/application";
import { testEffect } from "@es-ts-example/test-support/TestEffect";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import {
  executeAction,
  parseArguments,
  renderArticle,
  renderArticleList,
  renderBookmarkReceipt,
  renderCounter,
  renderList,
  renderReceipt,
  runCli,
  usage,
} from "../../src/index.ts";

const counterId = Application.CounterId.make("c1");
const userId = Application.UserId.make("user-1");
const articleId = Application.ArticleId.make("events-over-state");

const inProcessClients = Layer.mergeAll(
  Application.CounterCommandClientLive,
  Application.CounterQueryClientLive,
  Application.UserCommandClientLive,
  Application.UserQueryClientLive,
).pipe(Layer.provide(Application.DomainEventStore.inMemory));

const sampleCounter: Application.CounterSummary = {
  _tag: "ActiveCounterSummary",
  counterId,
  value: 2,
  version: 3,
};

const sampleDisabledCounter: Application.CounterSummary = {
  _tag: "DisabledCounterSummary",
  counterId,
  value: 2,
  version: 4,
};

const help = { _tag: "Help", message: usage } as const;

test("parseArguments maps every verb, rejects unknowns, and requires a non-empty id", () => {
  expect({
    empty: parseArguments([]),
    unknown: parseArguments(["bogus"]),
    missingId: parseArguments(["create"]),
    blankId: parseArguments(["create", ""]),
    list: parseArguments(["list"]),
    create: parseArguments(["create", "c1"]),
    increment: parseArguments(["increment", "c1"]),
    decrement: parseArguments(["decrement", "c1"]),
    disable: parseArguments(["disable", "c1"]),
    missingBookmarkUser: parseArguments(["bookmark"]),
    missingBookmarkArticle: parseArguments(["bookmark", "user-1"]),
    bookmark: parseArguments(["bookmark", "user-1", "events-over-state"]),
    missingArticlesUser: parseArguments(["articles"]),
    articles: parseArguments(["articles", "user-1"]),
  }).toEqual({
    empty: help,
    unknown: help,
    missingId: help,
    blankId: help,
    list: { _tag: "List" },
    create: { _tag: "Command", verb: "Create", counterId },
    increment: { _tag: "Command", verb: "Increment", counterId },
    decrement: { _tag: "Command", verb: "Decrement", counterId },
    disable: { _tag: "Command", verb: "Disable", counterId },
    missingBookmarkUser: help,
    missingBookmarkArticle: help,
    bookmark: { _tag: "ToggleBookmark", userId, articleId },
    missingArticlesUser: help,
    articles: { _tag: "ListArticles", userId },
  });
});

test("usage documents every command on its own line", () => {
  expect(usage).toBe(
    [
      "Usage: counter <command> [counterId]",
      "",
      "Commands:",
      "  create <counterId>     Start a new counter at zero",
      "  increment <counterId>  Add one to a counter",
      "  decrement <counterId>  Subtract one from a counter",
      "  disable <counterId>    Retire a counter",
      "  list                   Show every counter rebuilt from its events",
      "  bookmark <userId> <articleId>  Toggle an article bookmark",
      "  articles <userId>              List articles with bookmark state",
    ].join("\n"),
  );
});

test("renderCounter shows counter state and renderReceipt acknowledges the write", () => {
  expect({
    active: renderCounter(sampleCounter),
    disabled: renderCounter(sampleDisabledCounter),
    receipt: renderReceipt({ counterId, version: 3 }),
  }).toEqual({
    active: "#c1 value=2 status=active version=3",
    disabled: "#c1 value=2 status=disabled version=4",
    receipt: "Applied #c1 version=3",
  });
});

test("renderList labels populated and empty listings", () => {
  expect({
    empty: renderList({ counters: [] }),
    populated: renderList({ counters: [sampleCounter] }),
  }).toEqual({
    empty: ["No counters yet."],
    populated: ["Counters:", "#c1 value=2 status=active version=3"],
  });
});

test("article renderers include projected bookmark status", () => {
  const article: Application.ArticleRead = {
    articleId,
    title: "Events Over State",
    bookmarked: true,
  };
  const receipt: Application.UserBookmarkReceipt = {
    userId,
    bookmarkedArticleIds: [articleId],
  };

  expect({
    article: renderArticle(article),
    empty: renderArticleList({ articles: [] }),
    populated: renderArticleList({ articles: [article] }),
    receipt: renderBookmarkReceipt(receipt),
  }).toEqual({
    article: '#events-over-state "Events Over State" [bookmarked]',
    empty: ["No articles yet."],
    populated: ["Articles:", '#events-over-state "Events Over State" [bookmarked]'],
    receipt: "Toggled bookmarks for user-1 (1)",
  });
});

testEffect("executeAction returns usage for help without touching clients", () =>
  Effect.map(executeAction(parseArguments(["bogus"])), (lines) => {
    expect(lines).toEqual([usage]);
  }).pipe(Effect.provide(inProcessClients)),
);

testEffect("executeAction lists an empty store", () =>
  Effect.map(executeAction(parseArguments(["list"])), (lines) => {
    expect(lines).toEqual(["No counters yet."]);
  }).pipe(Effect.provide(inProcessClients)),
);

testEffect("executeAction dispatches each command verb and appends the rebuilt list", () =>
  Effect.gen(function* () {
    const created = yield* executeAction(parseArguments(["create", "c1"]));
    const incremented = yield* executeAction(parseArguments(["increment", "c1"]));
    const decremented = yield* executeAction(parseArguments(["decrement", "c1"]));
    const disabled = yield* executeAction(parseArguments(["disable", "c1"]));

    expect({ created, incremented, decremented, disabled }).toEqual({
      created: ["Applied #c1 version=1", "Counters:", "#c1 value=0 status=active version=1"],
      incremented: ["Applied #c1 version=2", "Counters:", "#c1 value=1 status=active version=2"],
      decremented: ["Applied #c1 version=3", "Counters:", "#c1 value=0 status=active version=3"],
      disabled: ["Applied #c1 version=4", "Counters:", "#c1 value=0 status=disabled version=4"],
    });
  }).pipe(Effect.provide(inProcessClients)),
);

testEffect("executeAction toggles bookmarks and lists combined article rows", () =>
  Effect.gen(function* () {
    const initial = yield* executeAction(parseArguments(["articles", "user-1"]));
    const bookmarked = yield* executeAction(
      parseArguments(["bookmark", "user-1", "events-over-state"]),
    );
    const removed = yield* executeAction(
      parseArguments(["bookmark", "user-1", "events-over-state"]),
    );

    expect({
      initial: initial[1],
      bookmarkedReceipt: bookmarked[0],
      bookmarkedArticle: bookmarked[2],
      removedReceipt: removed[0],
      removedArticle: removed[2],
    }).toEqual({
      initial: '#events-over-state "Events Over State" [ ]',
      bookmarkedReceipt: "Toggled bookmarks for user-1 (1)",
      bookmarkedArticle: '#events-over-state "Events Over State" [bookmarked]',
      removedReceipt: "Toggled bookmarks for user-1 (0)",
      removedArticle: '#events-over-state "Events Over State" [ ]',
    });
  }).pipe(Effect.provide(inProcessClients)),
);

testEffect("runCli persists a replayable event stream to the given json file", () =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = `/tmp/es-cli-runcli-${process.pid}.json`;
    yield* Effect.ignore(fs.remove(path));

    const created = yield* runCli(["create", "c1"], path);
    const listed = yield* runCli(["list"], path);
    const contents = yield* fs.readFileString(path);

    yield* Effect.ignore(fs.remove(path));

    expect({ created, listed, storedCreated: contents.includes("CounterCreated") }).toEqual({
      created: ["Applied #c1 version=1", "Counters:", "#c1 value=0 status=active version=1"],
      listed: ["Counters:", "#c1 value=0 status=active version=1"],
      storedCreated: true,
    });
  }).pipe(Effect.provide(BunServices.layer)),
);
