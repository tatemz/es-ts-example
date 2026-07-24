import { PostFormModel } from "../../models/controls/PostForm.model.ts";

type PostFormInput = {
  readonly action: string;
  readonly encoding?: "multipart/form-data";
  readonly hiddenFields: ReadonlyArray<{
    readonly name: string;
    readonly value: string;
  }>;
};

export const makePostFormModel = (input: PostFormInput): PostFormModel => PostFormModel.make(input);
