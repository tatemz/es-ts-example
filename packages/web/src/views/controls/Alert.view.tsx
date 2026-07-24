import * as Match from "effect/Match";
import type { AlertModel } from "../../models/controls/Alert.model.ts";
import type { View } from "../../mvc/view.ts";
import { renderNothing } from "../htmlHelpers.ts";

export const AlertView: View<AlertModel> = (model) =>
  Match.value(model).pipe(
    Match.tagsExhaustive({
      AlertHidden: renderNothing,
      AlertVisible: ({ message }) => (
        <p className="alert alert-error" data-component="Alert" role="alert">
          {message}
        </p>
      ),
    }),
  );
