import * as Schema from "effect/Schema";

const EsTsExampleHiddenFieldModel = Schema.Struct({
  name: Schema.String,
  value: Schema.String,
});

export const EsTsExamplePostFormModel = Schema.TaggedStruct("EsTsExamplePostFormModel", {
  action: Schema.String,
  encoding: Schema.optionalKey(Schema.Literals(["multipart/form-data"])),
  hiddenFields: Schema.Array(EsTsExampleHiddenFieldModel),
});

export type EsTsExamplePostFormModel = typeof EsTsExamplePostFormModel.Type;
