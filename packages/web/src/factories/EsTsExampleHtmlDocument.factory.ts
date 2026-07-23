import { webI18n } from "../i18n/messages.ts";
import { EsTsExampleHtmlDocumentModel } from "../models/EsTsExampleHtmlDocument.model.ts";
import { webRoutes } from "../routes.ts";

type EsTsExampleHtmlDocumentInput = {
  readonly title: string;
};

export const makeEsTsExampleHtmlDocumentModel = (
  input: EsTsExampleHtmlDocumentInput,
): EsTsExampleHtmlDocumentModel =>
  EsTsExampleHtmlDocumentModel.make({
    _tag: "EsTsExampleHtmlDocumentModel",
    description: webI18n._({ id: "web.document.description" }),
    stylesheetHref: webRoutes.clientStylesheet,
    title: input.title,
  });
