import * as Schema from "effect/Schema";
import { EsTsExampleAlertModel } from "./EsTsExampleAlert.model.ts";
import { EsTsExampleHtmlDocumentModel } from "./EsTsExampleHtmlDocument.model.ts";
import { EsTsExamplePostFormModel } from "./EsTsExamplePostForm.model.ts";
import { EsTsExampleSubmitButtonModel } from "./EsTsExampleSubmitButton.model.ts";
import { EsTsExampleTextFieldModel } from "./EsTsExampleTextField.model.ts";

const CounterActionControl = Schema.Struct({
  button: EsTsExampleSubmitButtonModel,
  form: EsTsExamplePostFormModel,
});

const CounterRow = Schema.Struct({
  actions: Schema.NonEmptyArray(CounterActionControl),
  counterId: Schema.String,
  statusText: Schema.String,
  valueText: Schema.String,
  versionText: Schema.String,
});

const CounterListEmpty = Schema.TaggedStruct("CounterListEmpty", {
  message: Schema.String,
});

const CounterListPopulated = Schema.TaggedStruct("CounterListPopulated", {
  rows: Schema.NonEmptyArray(CounterRow),
});

const CounterListPresentation = Schema.Union([CounterListEmpty, CounterListPopulated]);

export const CounterPageModel = Schema.TaggedStruct("CounterPageModel", {
  alert: EsTsExampleAlertModel,
  createButton: EsTsExampleSubmitButtonModel,
  createForm: EsTsExamplePostFormModel,
  document: EsTsExampleHtmlDocumentModel,
  heading: Schema.String,
  intro: Schema.String,
  list: CounterListPresentation,
  newCounterField: EsTsExampleTextFieldModel,
});

export type CounterPageModel = typeof CounterPageModel.Type;
