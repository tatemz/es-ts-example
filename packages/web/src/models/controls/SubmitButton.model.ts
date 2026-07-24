import * as Schema from "effect/Schema";

export const SubmitButtonModel = Schema.TaggedStruct("SubmitButtonModel", {
  label: Schema.String,
  tone: Schema.Literals(["primary", "secondary"]),
});

export type SubmitButtonModel = typeof SubmitButtonModel.Type;
