import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { TextFieldModel } from "../../models/controls/TextField.model.ts";

type TextFieldInput = {
  readonly errorMessage?: string;
  readonly id: string;
  readonly label: string;
  readonly name: string;
  readonly placeholder?: string;
  readonly value: string;
};

const makePresentation = (errorMessage: string | undefined): TextFieldModel["presentation"] =>
  errorMessage === undefined || errorMessage === ""
    ? { _tag: "TextFieldPresentationDefault" }
    : { _tag: "TextFieldPresentationError", message: errorMessage };

export const makeTextFieldModel = (input: TextFieldInput): TextFieldModel =>
  TextFieldModel.make(
    Option.getOrThrow(
      Schema.decodeUnknownOption(TextFieldModel)({
        _tag: "TextFieldModel",
        id: input.id,
        label: input.label,
        name: input.name,
        presentation: makePresentation(input.errorMessage),
        value: input.value,
        ...(input.placeholder === undefined ? {} : { placeholder: input.placeholder }),
      }),
    ),
  );
