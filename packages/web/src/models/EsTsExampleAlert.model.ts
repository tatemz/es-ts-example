import * as Schema from "effect/Schema";

const EsTsExampleAlertHidden = Schema.TaggedStruct("EsTsExampleAlertHidden", {});

const EsTsExampleAlertVisible = Schema.TaggedStruct("EsTsExampleAlertVisible", {
  message: Schema.String,
});

export const EsTsExampleAlertModel = Schema.Union([
  EsTsExampleAlertHidden,
  EsTsExampleAlertVisible,
]);

export type EsTsExampleAlertModel = typeof EsTsExampleAlertModel.Type;
