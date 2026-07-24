import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import * as HttpRouter from "effect/unstable/http/HttpRouter";
import * as HttpServerRequest from "effect/unstable/http/HttpServerRequest";
import * as HttpServerResponse from "effect/unstable/http/HttpServerResponse";
import { getArticlesPageController } from "./controllers/getArticlesPage.controller.ts";
import { getCounterPageController } from "./controllers/getCounterPage.controller.ts";
import { postCounterCommandController } from "./controllers/postCounterCommand.controller.ts";
import { postCreateCounterController } from "./controllers/postCreateCounter.controller.ts";
import { postToggleBookmarkController } from "./controllers/postToggleBookmark.controller.ts";
import { renderHtml } from "./mvc/html.ts";
import type { ArticlesPageModel } from "./models/pages/ArticlesPage.model.ts";
import type { CounterPageModel } from "./models/pages/CounterPage.model.ts";
import { webActions, webRoutes } from "./routes.ts";
import { ArticlesPageView } from "./views/pages/ArticlesPage.view.tsx";
import { CounterPageView } from "./views/pages/CounterPage.view.tsx";

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

const ArticlesQuery = Schema.Struct({
  error: Schema.optionalKey(Schema.String),
});

const ToggleBookmarkBody = Schema.Struct({
  articleId: Schema.String,
});

const counterHtmlPage = (model: CounterPageModel) =>
  HttpServerResponse.text(renderHtml(CounterPageView(model)), {
    contentType: "text/html; charset=utf-8",
  });

const articlesHtmlPage = (model: ArticlesPageModel) =>
  HttpServerResponse.text(renderHtml(ArticlesPageView(model)), {
    contentType: "text/html; charset=utf-8",
  });

const redirect = (location: string) => HttpServerResponse.redirect(location, { status: 303 });

const counterPage = Effect.gen(function* () {
  const input = yield* HttpServerRequest.schemaSearchParams(HomeQuery);
  const model = yield* getCounterPageController(input);
  return counterHtmlPage(model);
}).pipe(
  Effect.catch(() =>
    Effect.succeed(
      HttpServerResponse.text("Counter unavailable.", {
        status: 500,
      }),
    ),
  ),
);

const articlesPage = Effect.gen(function* () {
  const input = yield* HttpServerRequest.schemaSearchParams(ArticlesQuery);
  const model = yield* getArticlesPageController(input);
  return articlesHtmlPage(model);
}).pipe(
  Effect.catch(() =>
    Effect.succeed(
      HttpServerResponse.text("Articles unavailable.", {
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

const toggleBookmark = Effect.gen(function* () {
  const body = yield* HttpServerRequest.schemaBodyUrlParams(ToggleBookmarkBody);
  return redirect(yield* postToggleBookmarkController(body));
}).pipe(Effect.catch(() => Effect.succeed(redirect(webRoutes.articles))));

const stylesheetPath = `${import.meta.dir}/../public/client.css`;

export const rootPath = webRoutes.home;

export const WebHttpApp = Layer.mergeAll(
  HttpRouter.add("GET", webRoutes.home, counterPage),
  HttpRouter.add("GET", webRoutes.articles, articlesPage),
  HttpRouter.add("POST", webActions.createCounter, createCounter),
  HttpRouter.add("POST", webActions.runCounterCommand, runCounterCommand),
  HttpRouter.add("POST", webActions.toggleBookmark, toggleBookmark),
  HttpRouter.add(
    "GET",
    webRoutes.clientStylesheet,
    HttpServerResponse.file(stylesheetPath, { contentType: "text/css; charset=utf-8" }),
  ),
);
