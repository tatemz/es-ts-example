import * as Match from "effect/Match";
import type { EsTsExampleAlertModel } from "../../models/EsTsExampleAlert.model.ts";
import type { View } from "../../mvc/view.ts";
import { renderNoDetail } from "./es-ts-exampleView.support.tsx";

export const EsTsExampleAlertView: View<EsTsExampleAlertModel> = (model) =>
  Match.value(model).pipe(
    Match.tagsExhaustive({
      EsTsExampleAlertHidden: renderNoDetail,
      EsTsExampleAlertVisible: ({ message }) => (
        <p className="alert alert-error" data-component="EsTsExampleAlert" role="alert">
          {message}
        </p>
      ),
    }),
  );
