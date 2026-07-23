import * as Arr from "effect/Array";
import { webI18n } from "../i18n/messages.ts";
import { CounterPageModel } from "../models/CounterPage.model.ts";
import { webActions } from "../routes.ts";
import { makeEsTsExampleAlertModel } from "./EsTsExampleAlert.factory.ts";
import { makeEsTsExampleHtmlDocumentModel } from "./EsTsExampleHtmlDocument.factory.ts";
import { makeEsTsExamplePostFormModel } from "./EsTsExamplePostForm.factory.ts";
import { makeEsTsExampleSubmitButtonModel } from "./EsTsExampleSubmitButton.factory.ts";
import { makeEsTsExampleTextFieldModel } from "./EsTsExampleTextField.factory.ts";

type CounterView = {
  readonly counterId: string;
  readonly status: "active" | "disabled";
  readonly value: number;
  readonly version: number;
};

type CounterPageError = "missing-id" | "command-failed";

type CounterPageInput = {
  readonly counters: ReadonlyArray<CounterView>;
  readonly error?: CounterPageError;
  readonly newCounterId?: string;
};

const alertMessage = (error: CounterPageError | undefined): string | undefined =>
  error === "command-failed" ? webI18n._({ id: "counter.error.commandFailed" }) : undefined;

const fieldErrorMessage = (error: CounterPageError | undefined): string | undefined =>
  error === "missing-id" ? webI18n._({ id: "counter.error.missingId" }) : undefined;

const counterActions = [
  { labelId: "counter.action.increment", verb: "increment" },
  { labelId: "counter.action.decrement", verb: "decrement" },
  { labelId: "counter.action.disable", verb: "disable" },
] as const;

const makeActionControl = (counterId: string, action: (typeof counterActions)[number]) => ({
  button: makeEsTsExampleSubmitButtonModel({
    label: webI18n._({ id: action.labelId }),
    tone: "secondary",
  }),
  form: makeEsTsExamplePostFormModel({
    action: webActions.runCounterCommand,
    hiddenFields: [
      { name: "counterId", value: counterId },
      { name: "verb", value: action.verb },
    ],
  }),
});

const makeRow = (counter: CounterView) => ({
  actions: Arr.map(counterActions, (action) => makeActionControl(counter.counterId, action)),
  counterId: counter.counterId,
  statusText: `status=${counter.status}`,
  valueText: `value=${counter.value}`,
  versionText: `version=${counter.version}`,
});

const makeList = (counters: ReadonlyArray<CounterView>): CounterPageModel["list"] =>
  Arr.match(counters, {
    onEmpty: () => ({
      _tag: "CounterListEmpty" as const,
      message: webI18n._({ id: "counter.list.empty" }),
    }),
    onNonEmpty: (nonEmpty) => ({
      _tag: "CounterListPopulated" as const,
      rows: Arr.map(nonEmpty, makeRow),
    }),
  });

export const makeCounterPageModel = (input: CounterPageInput): CounterPageModel =>
  CounterPageModel.make({
    _tag: "CounterPageModel",
    alert: makeEsTsExampleAlertModel({ message: alertMessage(input.error) }),
    createButton: makeEsTsExampleSubmitButtonModel({
      label: webI18n._({ id: "counter.create.submit" }),
      tone: "primary",
    }),
    createForm: makeEsTsExamplePostFormModel({
      action: webActions.createCounter,
      hiddenFields: [],
    }),
    document: makeEsTsExampleHtmlDocumentModel({
      title: webI18n._({ id: "counter.documentTitle" }),
    }),
    heading: webI18n._({ id: "counter.heading" }),
    intro: webI18n._({ id: "counter.intro" }),
    list: makeList(input.counters),
    newCounterField: makeEsTsExampleTextFieldModel({
      errorMessage: fieldErrorMessage(input.error),
      id: "new-counter-id",
      label: webI18n._({ id: "counter.create.field.label" }),
      name: "counterId",
      placeholder: webI18n._({ id: "counter.create.field.placeholder" }),
      value: input.newCounterId ?? "",
    }),
  });
