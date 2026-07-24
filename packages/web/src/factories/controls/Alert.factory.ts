import { AlertModel } from "../../models/controls/Alert.model.ts";

type AlertInput = {
  readonly message?: string;
};

export const makeAlertModel = (input: AlertInput): AlertModel => {
  const message = input.message;

  if (message === undefined || message === "") {
    return AlertModel.make({
      _tag: "AlertHidden",
    });
  }

  return AlertModel.make({
    _tag: "AlertVisible",
    message,
  });
};
