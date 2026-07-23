import * as Match from "effect/Match";
import type { EsTsExampleTextFieldModel } from "../../models/EsTsExampleTextField.model.ts";
import type { View } from "../../mvc/view.ts";
import { renderNoDetail } from "./es-ts-exampleView.support.tsx";

const inputClassName = (presentation: EsTsExampleTextFieldModel["presentation"]): string =>
  Match.value(presentation).pipe(
    Match.tagsExhaustive({
      EsTsExampleTextFieldPresentationDefault: () => "input input-bordered w-full",
      EsTsExampleTextFieldPresentationError: () => "input input-bordered input-error w-full",
    }),
  );

const errorView = (presentation: EsTsExampleTextFieldModel["presentation"]) =>
  Match.value(presentation).pipe(
    Match.tagsExhaustive({
      EsTsExampleTextFieldPresentationDefault: renderNoDetail,
      EsTsExampleTextFieldPresentationError: ({ message }) => (
        <span className="text-sm text-error" role="alert">
          {message}
        </span>
      ),
    }),
  );

export const EsTsExampleTextFieldView: View<EsTsExampleTextFieldModel> = (model) => (
  <label
    className="grid w-full gap-2 text-sm font-semibold"
    data-component="EsTsExampleTextField"
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
