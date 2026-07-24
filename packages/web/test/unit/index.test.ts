import { expect, test } from "bun:test";
import * as Arr from "effect/Array";
import * as Fn from "effect/Function";
import * as Order from "effect/Order";
import * as Rec from "effect/Record";
import * as WebApi from "../../src/index.ts";

/**
 * The slice tests prove each export behaves. This is the only place that can
 * prove the barrel is exactly the intended surface: an accidental export leaks
 * internals to every view, and a dropped one breaks callers silently.
 */
test("the package barrel exports exactly the public web surface", () => {
  expect(Fn.pipe(WebApi, Rec.keys, Arr.sort(Order.String))).toEqual([
    "ArticlesPageModel",
    "ArticlesPageView",
    "CounterPageModel",
    "CounterPageView",
    "Fragment",
    "articlesHref",
    "counterHomeHref",
    "html",
    "htmlDocument",
    "joinHtml",
    "jsx",
    "parseStorageBackend",
    "renderHtml",
    "webActions",
    "webRoutes",
  ]);
});
