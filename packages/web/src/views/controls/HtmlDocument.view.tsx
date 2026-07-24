import type { HtmlDocumentModel } from "../../models/controls/HtmlDocument.model.ts";
import { htmlDocument } from "../../mvc/html.ts";
import type { HtmlSlotContent, View } from "../../mvc/view.ts";

export const HtmlDocumentView: View<HtmlDocumentModel, HtmlSlotContent> = (model, body) =>
  htmlDocument(
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta content="width=device-width, initial-scale=1, viewport-fit=cover" name="viewport" />
        <meta content={model.description} name="description" />
        <title>{model.title}</title>
        <link href={model.stylesheetHref} rel="stylesheet" />
      </head>
      <body className="bg-base-100" data-component="HtmlDocument" data-theme="es-ts-example">
        {body}
      </body>
    </html>,
  );
