import assert from "node:assert/strict";

/**
 * Assertions shared by the BDD step definitions. Each one names the product
 * fact it checks, so a failing scenario reads as a broken promise rather than
 * as a broken expression. Add one only when a step needs it.
 */

export const assertCounterValue = (actual: number, expected: number): void => {
  assert.equal(actual, expected);
};

export const assertCounterIsActive = (isActive: boolean): void => {
  assert.equal(isActive, true);
};

export const assertBookmarkedArticles = (
  actual: ReadonlyArray<string>,
  expected: ReadonlyArray<string>,
): void => {
  assert.deepEqual(actual, expected);
};

export const assertListedArticles = (
  actual: ReadonlyArray<string>,
  expected: ReadonlyArray<string>,
): void => {
  assert.deepEqual(actual, expected);
};
