import assert from "node:assert/strict";
import * as Result from "effect/Result";

export const assertDecisionAccepted = (decision: Result.Result<unknown, unknown>): void => {
  assert.equal(Result.isSuccess(decision), true);
};

export const assertRegisteredAccountState = <State>(actual: State, expected: State): void => {
  assert.deepEqual(actual, expected);
};

export const assertRegistrationOutcome = (actual: unknown, expected: unknown): void => {
  assert.equal(actual, expected);
};

export const assertCompletedBlockIds = (
  actual: ReadonlyArray<string>,
  expected: ReadonlyArray<string>,
): void => {
  assert.deepEqual(actual, expected);
};

export const assertAnswerCorrectness = (actual: boolean, expected: boolean): void => {
  assert.equal(actual, expected);
};

export const assertNoPublishedRevisions = (revisions: ReadonlyArray<unknown>): void => {
  assert.equal(revisions.length, 0);
};

export const assertAdventureStartedFromRevision = (
  decision: Result.Result<unknown, unknown>,
  actualRevisionNumber: number,
  expectedRevisionNumber: number,
): void => {
  assert.equal(Result.isSuccess(decision), true);
  assert.equal(actualRevisionNumber, expectedRevisionNumber);
};

export const assertRevisionUnavailable = (actual: number, expected: number): void => {
  assert.equal(actual, expected);
};

export const assertAcceptedDraft = (
  decision: Result.Result<unknown, unknown>,
  actual: { readonly title: string; readonly manualCheckPrompts: ReadonlyArray<string> },
  expected: { readonly title: string; readonly manualCheckPrompts: ReadonlyArray<string> },
): void => {
  assert.equal(Result.isSuccess(decision), true);
  assert.equal(actual.title, expected.title);
  assert.deepEqual(actual.manualCheckPrompts, expected.manualCheckPrompts);
};

export const assertRevisionExample = (
  actual: { readonly title: string; readonly block: string | undefined },
  expected: { readonly title: string; readonly block: string },
): void => {
  assert.deepEqual(actual, expected);
};

export const assertBlockFound = (found: boolean, description: string): void => {
  assert.equal(found, true, description);
};

export const assertSingleAnswerWithoutOptions = (block: {
  readonly mode: string;
  readonly options: ReadonlyArray<unknown>;
}): void => {
  assert.equal(block.mode, "SingleCorrectAnswer");
  assert.deepEqual(block.options, []);
};

export const assertCounterValue = (actual: number, expected: number): void => {
  assert.equal(actual, expected);
};

export const assertCounterIsActive = (isActive: boolean): void => {
  assert.equal(isActive, true);
};

export const assertPartySizeLimits = (
  actual: { readonly min: number; readonly max: number } | undefined,
  expected: { readonly min: number; readonly max: number },
): void => {
  assert.deepEqual(actual, expected);
};

export const assertPublishedAdventurePartySize = (
  actual: {
    readonly title: string | undefined;
    readonly partySizeLimits: { readonly min: number; readonly max: number } | undefined;
  },
  expected: {
    readonly title: string;
    readonly partySizeLimits: { readonly min: number; readonly max: number };
  },
): void => {
  assert.deepEqual(actual, expected);
};

export const assertPartyPreparing = (
  actual: { readonly title: string; readonly revisionNumber: number },
  expected: { readonly title: string; readonly revisionNumber: number },
): void => {
  assert.deepEqual(actual, expected);
};

export const assertAdventurerRows = (
  actual: ReadonlyArray<{ readonly adventurer: string }>,
  expected: ReadonlyArray<{ readonly adventurer: string }>,
): void => {
  assert.deepEqual(actual, expected);
};

export const assertBlockRows = <Row>(
  actual: ReadonlyArray<Row>,
  expected: ReadonlyArray<Row>,
): void => {
  assert.deepEqual(actual, expected);
};

export const assertOptionRows = <Row>(
  actual: ReadonlyArray<Row>,
  expected: ReadonlyArray<Row>,
): void => {
  assert.deepEqual(actual, expected);
};

export const assertStringRows = (
  actual: ReadonlyArray<string>,
  expected: ReadonlyArray<string>,
): void => {
  assert.deepEqual(actual, expected);
};

export const assertStringValue = (actual: string | undefined, expected: string): void => {
  assert.equal(actual, expected);
};

export const assertBooleanValue = (actual: boolean, expected: boolean): void => {
  assert.equal(actual, expected);
};
