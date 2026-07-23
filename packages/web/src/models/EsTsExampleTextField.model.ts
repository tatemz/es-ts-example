import * as Schema from "effect/Schema";

const EsTsExampleTextFieldPresentationDefault = Schema.TaggedStruct(
  "EsTsExampleTextFieldPresentationDefault",
  {},
);

const EsTsExampleTextFieldPresentationError = Schema.TaggedStruct(
  "EsTsExampleTextFieldPresentationError",
  {
    message: Schema.String,
  },
);

const EsTsExampleTextFieldPresentation = Schema.Union([
  EsTsExampleTextFieldPresentationDefault,
  EsTsExampleTextFieldPresentationError,
]);

export const EsTsExampleTextFieldModel = Schema.TaggedStruct("EsTsExampleTextFieldModel", {
  id: Schema.String,
  label: Schema.String,
  name: Schema.String,
  placeholder: Schema.optionalKey(Schema.String),
  presentation: EsTsExampleTextFieldPresentation,
  value: Schema.String,
});

export type EsTsExampleTextFieldModel = typeof EsTsExampleTextFieldModel.Type;
