import { expect, test } from "bun:test";
import { propertyTestParameters } from "@es-ts-example/test-support/PropertyTest";
import * as Arr from "effect/Array";
import * as FastCheck from "effect/testing/FastCheck";
import { makeArticlesPageModel } from "../../src/factories/ArticlesPage.factory.ts";
import { makeCounterPageModel } from "../../src/factories/CounterPage.factory.ts";
import { articlesHref, counterHomeHref } from "../../src/routes.ts";

const counterViewArb = FastCheck.record({
  counterId: FastCheck.string({ minLength: 1 }),
  status: FastCheck.constantFrom("active" as const, "disabled" as const),
  value: FastCheck.integer(),
  version: FastCheck.integer({ min: 0 }),
});

const articleViewArb = FastCheck.record({
  articleId: FastCheck.string({ minLength: 1 }),
  bookmarked: FastCheck.boolean(),
  title: FastCheck.string(),
});

test("property: counterHomeHref encodes parameters that survive a query round-trip", () => {
  FastCheck.assert(
    FastCheck.property(FastCheck.string(), FastCheck.string(), (error, newCounterId) => {
      const href = counterHomeHref({ error, newCounterId });
      const params = new URLSearchParams(href.slice(href.indexOf("?") + 1));
      expect({ error: params.get("error"), newCounterId: params.get("newCounterId") }).toEqual({
        error,
        newCounterId,
      });
    }),
    propertyTestParameters,
  );
});

test("property: the counter page list mirrors the emptiness and size of its counters", () => {
  FastCheck.assert(
    FastCheck.property(FastCheck.array(counterViewArb), (counters) => {
      const model = makeCounterPageModel({ counters });
      expect({
        tag: model.list._tag,
        rows: model.list._tag === "CounterListPopulated" ? Arr.length(model.list.rows) : 0,
      }).toEqual({
        tag: Arr.isReadonlyArrayEmpty(counters) ? "CounterListEmpty" : "CounterListPopulated",
        rows: Arr.length(counters),
      });
    }),
    propertyTestParameters,
  );
});

test("property: articlesHref preserves encoded error text", () => {
  FastCheck.assert(
    FastCheck.property(FastCheck.string(), (error) => {
      const href = articlesHref({ error });
      const params = new URLSearchParams(href.slice(href.indexOf("?") + 1));
      expect(params.get("error")).toBe(error);
    }),
    propertyTestParameters,
  );
});

test("property: the articles page list mirrors the static rows passed to its factory", () => {
  FastCheck.assert(
    FastCheck.property(FastCheck.array(articleViewArb), (articles) => {
      const model = makeArticlesPageModel({ articles });
      expect({
        tag: model.list._tag,
        rows: model.list._tag === "ArticleListPopulated" ? Arr.length(model.list.rows) : 0,
      }).toEqual({
        tag: Arr.isReadonlyArrayEmpty(articles) ? "ArticleListEmpty" : "ArticleListPopulated",
        rows: Arr.length(articles),
      });
    }),
    propertyTestParameters,
  );
});
