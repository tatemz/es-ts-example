import * as Counter from "./counter/index.ts";

export * from "./counter/index.ts";

export const DomainEvent = Counter.CounterEvent;
export type DomainEvent = typeof DomainEvent.Type;
