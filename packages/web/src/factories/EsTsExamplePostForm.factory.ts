import { EsTsExamplePostFormModel } from "../models/EsTsExamplePostForm.model.ts";

type EsTsExamplePostFormInput = {
  readonly action: string;
  readonly encoding?: "multipart/form-data";
  readonly hiddenFields: ReadonlyArray<{
    readonly name: string;
    readonly value: string;
  }>;
};

export const makeEsTsExamplePostFormModel = (
  input: EsTsExamplePostFormInput,
): EsTsExamplePostFormModel => EsTsExamplePostFormModel.make(input);
