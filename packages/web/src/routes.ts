import * as Arr from "effect/Array";
import * as Fn from "effect/Function";

export const webRoutes = {
  clientStylesheet: "/client.css",
  home: "/",
} as const;

export const webActions = {
  createCounter: "/actions/counter/create",
  runCounterCommand: "/actions/counter/command",
} as const;

type CounterHomeHrefInput = {
  readonly error?: string;
  readonly newCounterId?: string;
};

const queryParameter = (name: string, value: string | undefined): ReadonlyArray<string> =>
  value === undefined ? [] : [`${name}=${encodeURIComponent(value)}`];

export const counterHomeHref = (input: CounterHomeHrefInput): string => {
  const parameters = Arr.appendAll(
    queryParameter("error", input.error),
    queryParameter("newCounterId", input.newCounterId),
  );

  return Arr.isReadonlyArrayEmpty(parameters)
    ? webRoutes.home
    : `${webRoutes.home}?${Fn.pipe(parameters, Arr.join("&"))}`;
};
