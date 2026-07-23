import * as Schema from "effect/Schema";

export const CounterId = Schema.NonEmptyString.pipe(Schema.brand("CounterId"));
export type CounterId = typeof CounterId.Type;
