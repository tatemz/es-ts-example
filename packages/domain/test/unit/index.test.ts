import { expect, test } from "bun:test";
import * as Schema from "effect/Schema";
import * as Domain from "../../src/index.ts";

const counterId = Domain.CounterId.make("counter-1");
const userId = Domain.UserId.make("user-1");
const articleId = Domain.ArticleId.make("article-1");

test("domain event schema accepts counter and user events", () => {
  const decodeDomainEvent = Schema.decodeUnknownSync(Domain.DomainEvent);
  const counterCreated = Domain.CounterCreated.make({ counterId });
  const counterIncremented = Domain.CounterIncremented.make({ counterId });
  const articleBookmarked = Domain.ArticleBookmarked.make({ userId, articleId });
  const articleBookmarkRemoved = Domain.ArticleBookmarkRemoved.make({ userId, articleId });

  expect({
    counterCreated: decodeDomainEvent(counterCreated),
    counterIncremented: decodeDomainEvent(counterIncremented),
    articleBookmarked: decodeDomainEvent(articleBookmarked),
    articleBookmarkRemoved: decodeDomainEvent(articleBookmarkRemoved),
  }).toEqual({
    counterCreated: Domain.CounterCreated.make({ counterId }),
    counterIncremented: Domain.CounterIncremented.make({ counterId }),
    articleBookmarked: Domain.ArticleBookmarked.make({ userId, articleId }),
    articleBookmarkRemoved: Domain.ArticleBookmarkRemoved.make({ userId, articleId }),
  });
});

test("domain event schema rejects unknown events", () => {
  const isDomainEvent = Schema.is(Domain.DomainEvent);

  expect({
    counter: isDomainEvent(Domain.CounterCreated.make({ counterId })),
    user: isDomainEvent(Domain.ArticleBookmarked.make({ userId, articleId })),
    unknown: isDomainEvent({ _tag: "NotACounterEvent", counterId }),
  }).toEqual({
    counter: true,
    user: true,
    unknown: false,
  });
});
