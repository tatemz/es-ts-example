import * as Schema from "effect/Schema";
import { AlertModel } from "../controls/Alert.model.ts";
import { HtmlDocumentModel } from "../controls/HtmlDocument.model.ts";
import { PostFormModel } from "../controls/PostForm.model.ts";
import { SubmitButtonModel } from "../controls/SubmitButton.model.ts";
import { TextFieldModel } from "../controls/TextField.model.ts";

const CounterActionControl = Schema.Struct({
  button: SubmitButtonModel,
  form: PostFormModel,
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
  alert: AlertModel,
  createButton: SubmitButtonModel,
  createForm: PostFormModel,
  document: HtmlDocumentModel,
  heading: Schema.String,
  intro: Schema.String,
  list: CounterListPresentation,
  newCounterField: TextFieldModel,
});

export type CounterPageModel = typeof CounterPageModel.Type;
