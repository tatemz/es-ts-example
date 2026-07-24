import * as Schema from "effect/Schema";

const TextFieldPresentationDefault = Schema.TaggedStruct("TextFieldPresentationDefault", {});

const TextFieldPresentationError = Schema.TaggedStruct("TextFieldPresentationError", {
  message: Schema.String,
});

const TextFieldPresentation = Schema.Union([
  TextFieldPresentationDefault,
  TextFieldPresentationError,
]);

export const TextFieldModel = Schema.TaggedStruct("TextFieldModel", {
  id: Schema.String,
  label: Schema.String,
  name: Schema.String,
  placeholder: Schema.optionalKey(Schema.String),
  presentation: TextFieldPresentation,
  value: Schema.String,
});

export type TextFieldModel = typeof TextFieldModel.Type;
