import * as Fn from "effect/Function";
import * as Option from "effect/Option";
import * as Rec from "effect/Record";
import * as FastCheck from "effect/testing/FastCheck";

export const readPositiveInteger = (
  name: string,
  fallback: number,
  values?: Readonly<Record<string, string | undefined>>,
): number => {
  const source = values ?? {};
  const value = Fn.pipe(source, Rec.get(name), Option.getOrUndefined);
  const parsed = value === undefined ? fallback : Number(value);

  if (!isPositiveInteger(parsed)) {
    throw new Error(`${name} must be a positive integer.`);
  }

  return parsed;
};

const isPositiveInteger = (value: number): boolean => Number.isInteger(value) && value > 0;

export const propertyTestParameters = {
  interruptAfterTimeLimit: 5_000,
  markInterruptAsFailure: true,
  numRuns: 1_000,
} satisfies FastCheck.Parameters;

export const greeterNameMaxLength = 100;

export const greeterNameMinLength = 1;

export const greeterName = FastCheck.string({
  minLength: greeterNameMinLength,
  maxLength: greeterNameMaxLength,
});
