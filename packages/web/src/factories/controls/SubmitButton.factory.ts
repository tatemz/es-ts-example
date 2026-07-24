import { SubmitButtonModel } from "../../models/controls/SubmitButton.model.ts";

type SubmitButtonInput = {
  readonly label: string;
  readonly tone: "primary" | "secondary";
};

export const makeSubmitButtonModel = (input: SubmitButtonInput): SubmitButtonModel =>
  SubmitButtonModel.make({
    _tag: "SubmitButtonModel",
    label: input.label,
    tone: input.tone,
  });
