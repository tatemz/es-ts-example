import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import * as HttpRouter from "effect/unstable/http/HttpRouter";
import * as HttpServerRequest from "effect/unstable/http/HttpServerRequest";
import * as HttpServerResponse from "effect/unstable/http/HttpServerResponse";
import { getCounterPageController } from "./controllers/getCounterPage.controller.ts";
import { postCounterCommandController } from "./controllers/postCounterCommand.controller.ts";
import { postCreateCounterController } from "./controllers/postCreateCounter.controller.ts";
import { renderHtml } from "./mvc/html.ts";
import type { CounterPageModel } from "./models/CounterPage.model.ts";
import { webActions, webRoutes } from "./routes.ts";
import { CounterPageView } from "./views/wayfinder/CounterPage.view.tsx";

const HomeQuery = Schema.Struct({
  error: Schema.optionalKey(Schema.String),
  newCounterId: Schema.optionalKey(Schema.String),
});

const CreateCounterBody = Schema.Struct({
  counterId: Schema.String,
});

const RunCounterCommandBody = Schema.Struct({
  counterId: Schema.String,
  verb: Schema.Literals(["increment", "decrement", "disable"]),
});

const htmlPage = (model: CounterPageModel) =>
  HttpServerResponse.text(renderHtml(CounterPageView(model)), {
    contentType: "text/html; charset=utf-8",
  });

const redirect = (location: string) => HttpServerResponse.redirect(location, { status: 303 });

const counterPage = Effect.gen(function* () {
  const input = yield* HttpServerRequest.schemaSearchParams(HomeQuery);
  const model = yield* getCounterPageController(input);
  return htmlPage(model);
}).pipe(
  Effect.catch(() =>
    Effect.succeed(
      HttpServerResponse.text("Counter unavailable.", {
        status: 500,
      }),
    ),
  ),
);

const createCounter = Effect.gen(function* () {
  const body = yield* HttpServerRequest.schemaBodyUrlParams(CreateCounterBody);
  return redirect(yield* postCreateCounterController(body));
}).pipe(Effect.catch(() => Effect.succeed(redirect(webRoutes.home))));

const runCounterCommand = Effect.gen(function* () {
  const body = yield* HttpServerRequest.schemaBodyUrlParams(RunCounterCommandBody);
  return redirect(yield* postCounterCommandController(body));
}).pipe(Effect.catch(() => Effect.succeed(redirect(webRoutes.home))));

const stylesheetPath = `${import.meta.dir}/../public/client.css`;

export const rootPath = webRoutes.home;

export const WebHttpApp = Layer.mergeAll(
  HttpRouter.add("GET", webRoutes.home, counterPage),
  HttpRouter.add("POST", webActions.createCounter, createCounter),
  HttpRouter.add("POST", webActions.runCounterCommand, runCounterCommand),
  HttpRouter.add(
    "GET",
    webRoutes.clientStylesheet,
    HttpServerResponse.file(stylesheetPath, { contentType: "text/css; charset=utf-8" }),
  ),
);
