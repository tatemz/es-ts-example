import * as Counter from "./counter/index.ts";
import * as Schema from "effect/Schema";
import * as User from "./user/index.ts";

export * from "./counter/index.ts";
export * from "./user/index.ts";

export const DomainEvent = Schema.Union([Counter.CounterEvent, User.UserEvent]);
export type DomainEvent = typeof DomainEvent.Type;
