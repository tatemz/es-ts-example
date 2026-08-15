import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { AlertModel } from "../../models/controls/Alert.model.ts";

type AlertInput = {
  readonly message?: string;
};

export const makeAlertModel = (input: AlertInput): AlertModel => {
  const message = input.message;

  if (message === undefined || message === "") {
    return Option.getOrThrow(
      Schema.decodeUnknownOption(AlertModel)({
        _tag: "AlertHidden",
      }),
    );
  }

  return AlertModel.make({
    _tag: "AlertVisible",
    message,
  });
};
