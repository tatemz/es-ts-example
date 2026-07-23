import { EsTsExampleTextFieldModel } from "../models/EsTsExampleTextField.model.ts";

type EsTsExampleTextFieldInput = {
  readonly errorMessage?: string;
  readonly id: string;
  readonly label: string;
  readonly name: string;
  readonly placeholder?: string;
  readonly value: string;
};

const makePresentation = (
  errorMessage: string | undefined,
): EsTsExampleTextFieldModel["presentation"] =>
  errorMessage === undefined || errorMessage === ""
    ? { _tag: "EsTsExampleTextFieldPresentationDefault" }
    : { _tag: "EsTsExampleTextFieldPresentationError", message: errorMessage };

export const makeEsTsExampleTextFieldModel = (
  input: EsTsExampleTextFieldInput,
): EsTsExampleTextFieldModel =>
  EsTsExampleTextFieldModel.make({
    _tag: "EsTsExampleTextFieldModel",
    id: input.id,
    label: input.label,
    name: input.name,
    presentation: makePresentation(input.errorMessage),
    value: input.value,
    ...(input.placeholder === undefined ? {} : { placeholder: input.placeholder }),
  });
