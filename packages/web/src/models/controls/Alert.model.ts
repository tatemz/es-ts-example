import * as Schema from "effect/Schema";

const AlertHidden = Schema.TaggedStruct("AlertHidden", {});

const AlertVisible = Schema.TaggedStruct("AlertVisible", {
  message: Schema.String,
});

export const AlertModel = Schema.Union([AlertHidden, AlertVisible]);

export type AlertModel = typeof AlertModel.Type;
