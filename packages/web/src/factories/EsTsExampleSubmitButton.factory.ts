import { EsTsExampleSubmitButtonModel } from "../models/EsTsExampleSubmitButton.model.ts";

type EsTsExampleSubmitButtonInput = {
  readonly label: string;
  readonly tone: "primary" | "secondary";
};

export const makeEsTsExampleSubmitButtonModel = (
  input: EsTsExampleSubmitButtonInput,
): EsTsExampleSubmitButtonModel =>
  EsTsExampleSubmitButtonModel.make({
    _tag: "EsTsExampleSubmitButtonModel",
    label: input.label,
    tone: input.tone,
  });
