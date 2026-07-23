import * as Schema from "effect/Schema";

export const EsTsExampleSubmitButtonModel = Schema.TaggedStruct("EsTsExampleSubmitButtonModel", {
  label: Schema.String,
  tone: Schema.Literals(["primary", "secondary"]),
});

export type EsTsExampleSubmitButtonModel = typeof EsTsExampleSubmitButtonModel.Type;
