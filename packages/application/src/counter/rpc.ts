import * as Domain from "@es-ts-example/domain";
import * as EventStore from "@es-ts-example/event-sourcing/event-store";
import * as Schema from "effect/Schema";
import * as Rpc from "effect/unstable/rpc/Rpc";
import * as RpcGroup from "effect/unstable/rpc/RpcGroup";
import {
  CreateCounterCommand,
  DecrementCounterCommand,
  DisableCounterCommand,
  IncrementCounterCommand,
} from "./commands/index.ts";
import { CounterCommandReceipt, CounterList } from "./readModels.ts";

export const CounterDomainError = Schema.Union([
  Domain.CounterAlreadyExists,
  Domain.CounterDoesNotExist,
  Domain.CounterIsDisabled,
  Domain.CounterMinimumReached,
  Domain.CounterMaximumReached,
]);
export type CounterDomainError = typeof CounterDomainError.Type;

export const CounterCommandError = Schema.Union([
  CounterDomainError,
  EventStore.ExpectedVersionConflict,
  EventStore.EventStorePersistenceFailure,
]);
export type CounterCommandError = typeof CounterCommandError.Type;

export const CounterQueryError = EventStore.EventStorePersistenceFailure;
export type CounterQueryError = typeof CounterQueryError.Type;

export const CreateCounter = Rpc.make("CreateCounter", {
  payload: CreateCounterCommand,
  success: CounterCommandReceipt,
  error: CounterCommandError,
});

export const IncrementCounter = Rpc.make("IncrementCounter", {
  payload: IncrementCounterCommand,
  success: CounterCommandReceipt,
  error: CounterCommandError,
});

export const DecrementCounter = Rpc.make("DecrementCounter", {
  payload: DecrementCounterCommand,
  success: CounterCommandReceipt,
  error: CounterCommandError,
});

export const DisableCounter = Rpc.make("DisableCounter", {
  payload: DisableCounterCommand,
  success: CounterCommandReceipt,
  error: CounterCommandError,
});

export const ListCounters = Rpc.make("ListCounters", {
  payload: {},
  success: CounterList,
  error: CounterQueryError,
});

export const CounterCommandApi = RpcGroup.make(
  CreateCounter,
  IncrementCounter,
  DecrementCounter,
  DisableCounter,
);
export const CounterQueryApi = RpcGroup.make(ListCounters);
