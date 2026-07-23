import * as Arr from "effect/Array";
import type { EsTsExamplePostFormModel } from "../../models/EsTsExamplePostForm.model.ts";
import type { HtmlSlotContent, View } from "../../mvc/view.ts";
import { postFormEncodingAttributes } from "./es-ts-exampleView.support.tsx";

export const EsTsExamplePostFormView: View<EsTsExamplePostFormModel, HtmlSlotContent> = (
  model,
  slot,
) => (
  <form
    action={model.action}
    className="contents"
    data-component="EsTsExamplePostForm"
    data-design-id="post-form"
    {...postFormEncodingAttributes(model.encoding)}
    method="post"
  >
    {Arr.map(model.hiddenFields, (field) => (
      <input name={field.name} type="hidden" value={field.value} />
    ))}
    {slot}
  </form>
);
