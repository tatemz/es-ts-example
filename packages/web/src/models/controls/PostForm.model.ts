import * as Schema from "effect/Schema";

const HiddenFieldModel = Schema.Struct({
  name: Schema.String,
  value: Schema.String,
});

export const PostFormModel = Schema.TaggedStruct("PostFormModel", {
  action: Schema.String,
  encoding: Schema.optionalKey(Schema.Literals(["multipart/form-data"])),
  hiddenFields: Schema.Array(HiddenFieldModel),
});

export type PostFormModel = typeof PostFormModel.Type;
