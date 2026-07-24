import * as Application from "@es-ts-example/application";
import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import type * as FileSystem from "effect/FileSystem";
import * as Fn from "effect/Function";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Rec from "effect/Record";

type CommandVerb = "Create" | "Increment" | "Decrement" | "Disable";

type CliAction =
  | {
      readonly _tag: "Command";
      readonly verb: CommandVerb;
      readonly counterId: Application.CounterId;
    }
  | { readonly _tag: "List" }
  | {
      readonly _tag: "ToggleBookmark";
      readonly userId: Application.UserId;
      readonly articleId: Application.ArticleId;
    }
  | { readonly _tag: "ListArticles"; readonly userId: Application.UserId }
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
  "  bookmark <userId> <articleId>  Toggle an article bookmark",
  "  articles <userId>              List articles with bookmark state",
];

export const usage: string = Arr.join(usageLines, "\n");

const verbTags: Readonly<Record<string, CommandVerb>> = {
  create: "Create",
  increment: "Increment",
  decrement: "Decrement",
  disable: "Disable",
};

const helpAction: CliAction = { _tag: "Help", message: usage };

const hasValue = (value: string | undefined): value is string =>
  value !== undefined && value !== "";

const commandAction = (verb: CommandVerb, rawId: string | undefined): CliAction =>
  !hasValue(rawId)
    ? helpAction
    : { _tag: "Command", verb, counterId: Application.CounterId.make(rawId) };

const toggleBookmarkAction = (
  rawUserId: string | undefined,
  rawArticleId: string | undefined,
): CliAction =>
  !hasValue(rawUserId) || !hasValue(rawArticleId)
    ? helpAction
    : {
        _tag: "ToggleBookmark",
        userId: Application.UserId.make(rawUserId),
        articleId: Application.ArticleId.make(rawArticleId),
      };

const listArticlesAction = (rawUserId: string | undefined): CliAction =>
  !hasValue(rawUserId)
    ? helpAction
    : { _tag: "ListArticles", userId: Application.UserId.make(rawUserId) };

export const parseArguments = (argv: ReadonlyArray<string>): CliAction => {
  const [verb, rawId, rawArticleId] = argv;
  if (verb === "list") {
    return { _tag: "List" };
  }
  if (verb === "bookmark") {
    return toggleBookmarkAction(rawId, rawArticleId);
  }
  if (verb === "articles") {
    return listArticlesAction(rawId);
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

export const renderArticle = (article: Application.ArticleRead): string =>
  `#${article.articleId} "${article.title}" ${article.bookmarked ? "[bookmarked]" : "[ ]"}`;

export const renderArticleList = (list: Application.ArticleList): ReadonlyArray<string> =>
  Arr.match(list.articles, {
    onEmpty: () => Arr.of("No articles yet."),
    onNonEmpty: (articles) => Arr.prepend(Arr.map(articles, renderArticle), "Articles:"),
  });

export const renderBookmarkReceipt = (receipt: Application.UserBookmarkReceipt): string =>
  `Toggled bookmarks for ${receipt.userId} (${Arr.length(receipt.bookmarkedArticleIds)})`;

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

const articleLines = (
  userId: Application.UserId,
): Effect.Effect<ReadonlyArray<string>, Application.UserQueryError, Application.UserQueryClient> =>
  Effect.gen(function* () {
    const queries = yield* Application.UserQueryClient;
    const list = yield* queries.ListArticles({ _tag: "ListArticles", userId });
    return renderArticleList(list);
  });

const bookmarkLines = (
  userId: Application.UserId,
  articleId: Application.ArticleId,
): Effect.Effect<
  ReadonlyArray<string>,
  Application.UserCommandError | Application.UserQueryError,
  Application.UserCommandClient | Application.UserQueryClient
> =>
  Effect.gen(function* () {
    const commands = yield* Application.UserCommandClient;
    const receipt = yield* commands.ToggleArticleBookmark({
      _tag: "ToggleArticleBookmark",
      userId,
      articleId,
    });
    const listing = yield* articleLines(userId);
    return Arr.prepend(listing, renderBookmarkReceipt(receipt));
  });

const executeNonHelpAction = (
  action: Exclude<CliAction, { readonly _tag: "Help" }>,
): Effect.Effect<
  ReadonlyArray<string>,
  | Application.CounterCommandError
  | Application.CounterQueryError
  | Application.UserCommandError
  | Application.UserQueryError,
  | Application.CounterCommandClient
  | Application.CounterQueryClient
  | Application.UserCommandClient
  | Application.UserQueryClient
> => {
  if (action._tag === "List") {
    return listLines();
  }
  if (action._tag === "ListArticles") {
    return articleLines(action.userId);
  }
  if (action._tag === "ToggleBookmark") {
    return bookmarkLines(action.userId, action.articleId);
  }
  return commandLines(action.verb, action.counterId);
};

export const executeAction = (
  action: CliAction,
): Effect.Effect<
  ReadonlyArray<string>,
  | Application.CounterCommandError
  | Application.CounterQueryError
  | Application.UserCommandError
  | Application.UserQueryError,
  | Application.CounterCommandClient
  | Application.CounterQueryClient
  | Application.UserCommandClient
  | Application.UserQueryClient
> =>
  action._tag === "Help" ? Effect.succeed(Arr.of(action.message)) : executeNonHelpAction(action);

const cliLayer = (
  filePath: string,
): Layer.Layer<
  | Application.CounterCommandClient
  | Application.CounterQueryClient
  | Application.UserCommandClient
  | Application.UserQueryClient,
  never,
  FileSystem.FileSystem
> =>
  Layer.mergeAll(
    Application.CounterCommandClientLive,
    Application.CounterQueryClientLive,
    Application.UserCommandClientLive,
    Application.UserQueryClientLive,
  ).pipe(Layer.provide(Application.DomainEventStore.jsonFile(filePath)));

export const runCli = (
  argv: ReadonlyArray<string>,
  filePath: string,
): Effect.Effect<
  ReadonlyArray<string>,
  | Application.CounterCommandError
  | Application.CounterQueryError
  | Application.UserCommandError
  | Application.UserQueryError,
  FileSystem.FileSystem
> => executeAction(parseArguments(argv)).pipe(Effect.provide(cliLayer(filePath)));
