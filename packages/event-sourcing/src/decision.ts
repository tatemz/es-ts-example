import * as Result from "effect/Result";

export type Decision<Success, Error> = Result.Result<Success, Error>;

export const accept = <Success>(value: Success): Decision<Success, never> => Result.succeed(value);

export const reject = <Error>(error: Error): Decision<never, Error> => Result.fail(error);
