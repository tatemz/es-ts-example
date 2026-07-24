import * as Match from "effect/Match";
import type { TextFieldModel } from "../../models/controls/TextField.model.ts";
import type { View } from "../../mvc/view.ts";
import { renderNothing } from "../htmlHelpers.ts";

const inputClassName = (presentation: TextFieldModel["presentation"]): string =>
  Match.value(presentation).pipe(
    Match.tagsExhaustive({
      TextFieldPresentationDefault: () => "input input-bordered w-full",
      TextFieldPresentationError: () => "input input-bordered input-error w-full",
    }),
  );

const errorView = (presentation: TextFieldModel["presentation"]) =>
  Match.value(presentation).pipe(
    Match.tagsExhaustive({
      TextFieldPresentationDefault: renderNothing,
      TextFieldPresentationError: ({ message }) => (
        <span className="text-sm text-error" role="alert">
          {message}
        </span>
      ),
    }),
  );

export const TextFieldView: View<TextFieldModel> = (model) => (
  <label
    className="grid w-full gap-2 text-sm font-semibold"
    data-component="TextField"
    data-design-id="text-field"
    for={model.id}
  >
    {model.label}
    <input
      className={inputClassName(model.presentation)}
      id={model.id}
      name={model.name}
      placeholder={model.placeholder}
      type="text"
      value={model.value}
    />
    {errorView(model.presentation)}
  </label>
);
