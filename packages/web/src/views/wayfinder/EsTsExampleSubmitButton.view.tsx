import * as Match from "effect/Match";
import type { EsTsExampleSubmitButtonModel } from "../../models/EsTsExampleSubmitButton.model.ts";
import type { View } from "../../mvc/view.ts";

const buttonClassName = (tone: EsTsExampleSubmitButtonModel["tone"]): string =>
  Match.value(tone).pipe(
    Match.when("primary", () => "btn btn-primary"),
    Match.when("secondary", () => "btn btn-secondary btn-outline"),
    Match.exhaustive,
  );

export const EsTsExampleSubmitButtonView: View<EsTsExampleSubmitButtonModel> = (model) => (
  <button
    className={buttonClassName(model.tone)}
    data-component="EsTsExampleSubmitButton"
    data-design-id="submit-button"
    type="submit"
  >
    {model.label}
  </button>
);
