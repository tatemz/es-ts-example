import { expect, test } from "bun:test";
import { testEffect } from "@es-ts-example/test-support/TestEffect";
import * as Effect from "effect/Effect";
import { renderHtml } from "../../src/mvc/html.ts";
import { Fragment, jsx, jsxs } from "../../src/mvc/jsx-runtime.ts";
import {
  Fragment as DevFragment,
  jsx as devJsx,
  jsxDEV,
  jsxs as devJsxs,
} from "../../src/mvc/jsx-dev-runtime.ts";
import { counterHomeHref, webActions, webRoutes } from "../../src/routes.ts";
import { parseStorageBackend } from "../../src/runtime-config.ts";
import { postFormEncodingAttributes } from "../../src/views/es-ts-exampleView.support.ts";

test("web routes and actions expose the counter surface", () => {
  expect({ webRoutes, webActions }).toEqual({
    webRoutes: { clientStylesheet: "/client.css", home: "/" },
    webActions: {
      createCounter: "/actions/counter/create",
      runCounterCommand: "/actions/counter/command",
    },
  });
});

test("counterHomeHref appends only the provided, url-encoded parameters", () => {
  expect({
    empty: counterHomeHref({}),
    errorOnly: counterHomeHref({ error: "missing-id" }),
    idOnly: counterHomeHref({ newCounterId: "a b" }),
    both: counterHomeHref({ error: "x", newCounterId: "y" }),
  }).toEqual({
    empty: "/",
    errorOnly: "/?error=missing-id",
    idOnly: "/?newCounterId=a%20b",
    both: "/?error=x&newCounterId=y",
  });
});

testEffect("parseStorageBackend accepts the supported backends", () =>
  Effect.gen(function* () {
    const memory = yield* parseStorageBackend("memory");
    const jsonFile = yield* parseStorageBackend("json-file");
    expect({ memory, jsonFile }).toEqual({ memory: "memory", jsonFile: "json-file" });
  }),
);

testEffect("parseStorageBackend rejects unknown backends with a helpful message", () =>
  Effect.map(Effect.flip(parseStorageBackend("sqlite")), (error) => {
    expect(error.message).toBe(
      'Unsupported STORAGE_BACKEND "sqlite". Expected one of: memory, json-file.',
    );
  }),
);

test("the automatic jsx runtime renders tags, components, and every child shape", () => {
  const Card = (props: Readonly<Record<string, unknown>> | null) =>
    jsx("section", { children: props?.children, id: props?.id });

  expect({
    element: renderHtml(jsx("p", { children: "hi", id: "x" })),
    arrayChildren: renderHtml(jsx("ul", { children: ["a", 1, null] })),
    noChildren: renderHtml(jsx("br", {})),
    nullProps: renderHtml(jsx("hr", null)),
    component: renderHtml(jsx(Card, { children: "body", id: "z" })),
    jsxsAlias: renderHtml(jsxs("i", { children: "n" })),
    fragment: renderHtml(Fragment({ children: "frag" })),
  }).toEqual({
    element: '<p id="x">hi</p>',
    arrayChildren: "<ul>a1</ul>",
    noChildren: "<br></br>",
    nullProps: "<hr></hr>",
    component: '<section id="z">body</section>',
    jsxsAlias: "<i>n</i>",
    fragment: "frag",
  });
});

test("the automatic jsx runtime rejects children that are not renderable", () => {
  expect(() => jsx("p", { children: { rogue: true } })).toThrow(
    "JSX children must be renderable HTML children.",
  );
});

test("the dev jsx runtime ignores debug arguments and re-exports the runtime", () => {
  expect({
    dev: renderHtml(jsxDEV("p", { children: "hi", id: "x" }, "key", true, "source", "self")),
    reexportsJsx: devJsx === jsx,
    reexportsJsxs: devJsxs === jsxs,
    reexportsFragment: DevFragment === Fragment,
  }).toEqual({
    dev: '<p id="x">hi</p>',
    reexportsJsx: true,
    reexportsJsxs: true,
    reexportsFragment: true,
  });
});

test("postFormEncodingAttributes emits an enctype only when an encoding is provided", () => {
  expect({
    none: postFormEncodingAttributes(undefined),
    some: postFormEncodingAttributes("multipart/form-data"),
  }).toStrictEqual({
    none: {},
    some: { enctype: "multipart/form-data" },
  });
});
