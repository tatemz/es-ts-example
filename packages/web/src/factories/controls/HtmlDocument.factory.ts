import { webI18n } from "../../i18n/messages.ts";
import { HtmlDocumentModel } from "../../models/controls/HtmlDocument.model.ts";
import { webRoutes } from "../../routes.ts";

type HtmlDocumentInput = {
  readonly title: string;
};

export const makeHtmlDocumentModel = (input: HtmlDocumentInput): HtmlDocumentModel =>
  HtmlDocumentModel.make({
    _tag: "HtmlDocumentModel",
    description: webI18n._({ id: "web.document.description" }),
    stylesheetHref: webRoutes.clientStylesheet,
    title: input.title,
  });
