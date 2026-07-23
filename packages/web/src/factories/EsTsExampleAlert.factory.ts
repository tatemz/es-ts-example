import { EsTsExampleAlertModel } from "../models/EsTsExampleAlert.model.ts";

type EsTsExampleAlertInput = {
  readonly message?: string;
};

export const makeEsTsExampleAlertModel = (input: EsTsExampleAlertInput): EsTsExampleAlertModel => {
  const message = input.message;

  if (message === undefined || message === "") {
    return EsTsExampleAlertModel.make({
      _tag: "EsTsExampleAlertHidden",
    });
  }

  return EsTsExampleAlertModel.make({
    _tag: "EsTsExampleAlertVisible",
    message,
  });
};
