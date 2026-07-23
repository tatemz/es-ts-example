import { expect, test } from "bun:test";
import * as WebApi from "../../src/index.ts";

test("the package barrel re-exports the public counter web surface", () => {
  expect({
    counterHomeHref: typeof WebApi.counterHomeHref,
    view: typeof WebApi.WayfinderCounterPageView,
    renderHtml: typeof WebApi.renderHtml,
    parseStorageBackend: typeof WebApi.parseStorageBackend,
    commandClient: WebApi.CommandRpcClient !== undefined,
    queryClient: WebApi.QueryRpcClient !== undefined,
  }).toEqual({
    counterHomeHref: "function",
    view: "function",
    renderHtml: "function",
    parseStorageBackend: "function",
    commandClient: true,
    queryClient: true,
  });
});
