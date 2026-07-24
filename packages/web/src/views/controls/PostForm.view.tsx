import * as Arr from "effect/Array";
import type { PostFormModel } from "../../models/controls/PostForm.model.ts";
import type { HtmlSlotContent, View } from "../../mvc/view.ts";
import { postFormEncodingAttributes } from "../htmlHelpers.ts";

export const PostFormView: View<PostFormModel, HtmlSlotContent> = (model, slot) => (
  <form
    action={model.action}
    className="contents"
    data-component="PostForm"
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
