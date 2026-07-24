import * as Match from "effect/Match";
import type { SubmitButtonModel } from "../../models/controls/SubmitButton.model.ts";
import type { View } from "../../mvc/view.ts";

const buttonClassName = (tone: SubmitButtonModel["tone"]): string =>
  Match.value(tone).pipe(
    Match.when("primary", () => "btn btn-primary"),
    Match.when("secondary", () => "btn btn-secondary btn-outline"),
    Match.exhaustive,
  );

export const SubmitButtonView: View<SubmitButtonModel> = (model) => (
  <button
    className={buttonClassName(model.tone)}
    data-component="SubmitButton"
    data-design-id="submit-button"
    type="submit"
  >
    {model.label}
  </button>
);
