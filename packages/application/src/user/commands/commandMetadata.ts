import * as Domain from "@es-ts-example/domain";
import type * as EventStore from "@es-ts-example/event-sourcing/event-store";
import * as Schema from "effect/Schema";

export const UserCommandMetadata = {
  userId: Domain.UserId,
  articleId: Domain.ArticleId,
  correlationId: Schema.optionalKey(Schema.String),
  causationId: Schema.optionalKey(Schema.String),
};

export type UserCommandMetadata = {
  readonly _tag: string;
  readonly userId: Domain.UserId;
  readonly articleId: Domain.ArticleId;
  readonly correlationId?: EventStore.CorrelationId;
  readonly causationId?: EventStore.CausationId;
};

export const userMetadata = (input: UserCommandMetadata): EventStore.AppendMetadata => ({
  correlationId: input.correlationId ?? `${input._tag}:${input.userId}`,
  causationId: input.causationId,
});
