import * as Effect from "effect/Effect";
import * as Fn from "effect/Function";
import * as Option from "effect/Option";
import * as Rec from "effect/Record";
import * as Result from "effect/Result";

type Tagged = {
  readonly _tag: string;
};

const describeValue = (value: unknown): string => {
  const description = Effect.try({
    try: () => JSON.stringify(value),
    catch: () => String(value),
  });

  return Effect.runSync(
    Effect.match(description, {
      onFailure: (fallback) => fallback,
      onSuccess: (json) => json,
    }),
  );
};

const taggedFailureDescription = (failure: unknown): string =>
  isTaggedFailure(failure) ? String(failure._tag) : "unknown";

const isTaggedFailure = (failure: unknown): failure is Tagged =>
  typeof failure === "object" && failure !== null && "_tag" in failure;

export const requireAcceptedDecision = <Success, Error>(
  decision: Result.Result<Success, Error>,
  label: string,
): Success => {
  if (Result.isSuccess(decision)) {
    return decision.success;
  }

  const failure = decision.failure;
  const tag = taggedFailureDescription(failure);
  throw new Error(`Expected ${label} to be accepted, but it was rejected with ${tag}.`);
};

export const requireRejectedDecision = <Success, Error extends Tagged, Tag extends Error["_tag"]>(
  decision: Result.Result<Success, Error>,
  tag: Tag,
  label: string,
): Extract<Error, { readonly _tag: Tag }> => {
  if (Result.isSuccess(decision)) {
    throw new Error(`Expected ${label} to be rejected with ${tag}, but it was accepted.`);
  }

  const failure = decision.failure;
  const failureTag = failure._tag;
  if (failureTag !== tag) {
    throw new Error(
      `Expected ${label} to be rejected with ${tag}, but it was rejected with ${failureTag}: ${describeValue(
        failure,
      )}.`,
    );
  }

  return failure as Extract<Error, { readonly _tag: Tag }>;
};

export const matchRejection = <
  Success,
  Error extends Tagged,
  Cases extends Partial<{
    readonly [Tag in Error["_tag"]]: (error: Extract<Error, { readonly _tag: Tag }>) => void;
  }>,
>(
  decision: Result.Result<Success, Error>,
  cases: Cases,
  label: string,
): void => {
  if (Result.isSuccess(decision)) {
    throw new Error(`Expected ${label} to be rejected, but it was accepted.`);
  }

  const failure = decision.failure;
  const handler = Fn.pipe(
    cases as Readonly<Record<Error["_tag"], unknown>>,
    Rec.get(failure._tag),
    Option.map((handler) => handler as (error: Error) => void),
    Option.getOrUndefined,
  );
  if (handler === undefined) {
    throw new Error(`No rejection handler for ${failure._tag}: ${describeValue(failure)}.`);
  }

  handler(failure);
};
