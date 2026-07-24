import * as Arr from "effect/Array";
import { webI18n } from "../../i18n/messages.ts";
import { CounterPageModel } from "../../models/pages/CounterPage.model.ts";
import { webActions } from "../../routes.ts";
import { makeAlertModel } from "../controls/Alert.factory.ts";
import { makeHtmlDocumentModel } from "../controls/HtmlDocument.factory.ts";
import { makePostFormModel } from "../controls/PostForm.factory.ts";
import { makeSubmitButtonModel } from "../controls/SubmitButton.factory.ts";
import { makeTextFieldModel } from "../controls/TextField.factory.ts";

type CounterView = {
  readonly _tag: "ActiveCounterSummary" | "DisabledCounterSummary";
  readonly counterId: string;
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
  button: makeSubmitButtonModel({
    label: webI18n._({ id: action.labelId }),
    tone: "secondary",
  }),
  form: makePostFormModel({
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
  statusText: `status=${counter._tag === "DisabledCounterSummary" ? "disabled" : "active"}`,
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
    alert: makeAlertModel({ message: alertMessage(input.error) }),
    createButton: makeSubmitButtonModel({
      label: webI18n._({ id: "counter.create.submit" }),
      tone: "primary",
    }),
    createForm: makePostFormModel({
      action: webActions.createCounter,
      hiddenFields: [],
    }),
    document: makeHtmlDocumentModel({
      title: webI18n._({ id: "counter.documentTitle" }),
    }),
    heading: webI18n._({ id: "counter.heading" }),
    intro: webI18n._({ id: "counter.intro" }),
    list: makeList(input.counters),
    newCounterField: makeTextFieldModel({
      errorMessage: fieldErrorMessage(input.error),
      id: "new-counter-id",
      label: webI18n._({ id: "counter.create.field.label" }),
      name: "counterId",
      placeholder: webI18n._({ id: "counter.create.field.placeholder" }),
      value: input.newCounterId ?? "",
    }),
  });
