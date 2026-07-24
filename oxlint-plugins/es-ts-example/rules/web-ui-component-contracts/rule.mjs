import { getBasename } from "../shared/filename.mjs";
import { normalizedFilename, sourceText } from "../shared/context.mjs";
import { webControlRenderablePath } from "../shared/paths.mjs";
import { createRule, report } from "../shared/rule.mjs";

export const webUiComponentContractsRuleName = "web-ui-component-contracts";

const isUiView = (filename) => /\.view\.tsx$/.test(getBasename(filename));

const componentName = (filename) => getBasename(filename).replace(/\.view\.tsx$/, "");

const literalDataComponentMatches = (text) =>
  [...text.matchAll(/<([A-Za-z][A-Za-z0-9]*)\b[^>]*\bdata-component="([^"]+)"[^>]*>/gs)].map(
    (match) => ({
      tag: match[1],
      component: match[2],
    }),
  );

const needsInlineDesignAnchor = (text, component) =>
  !new RegExp(`data-component="${component}"[\\s\\S]*?data-design-(?:id|slot)=`).test(text);

export const webUiComponentContracts = createRule({
  description: "Keep reusable web UI components public, stable, and layer-local.",
  messages: {
    dataComponent: "Public UI views must expose a stable data-component marker.",
    domainImport: "Reusable UI components must not import domain services.",
    inlineComponent:
      "Inline data-component markers must declare data-design-id or data-design-slot.",
    serviceImport: "Reusable UI components must not import application services.",
  },
  create(context) {
    const filename = normalizedFilename(context);
    if (!webControlRenderablePath(filename)) {
      return {};
    }

    return {
      Program(node) {
        const text = sourceText(context);
        if (/@es-ts-example\/application/.test(text)) {
          report(context, node, "serviceImport");
        }
        if (/@es-ts-example\/domain/.test(text)) {
          report(context, node, "domainImport");
        }
        if (!isUiView(filename)) {
          return;
        }

        const expected = componentName(filename);
        if (!/data-component(?:=|":)/.test(text)) {
          report(context, node, "dataComponent");
        }

        for (const match of literalDataComponentMatches(text)) {
          if (
            match.component !== expected &&
            match.tag === match.tag.toLowerCase() &&
            needsInlineDesignAnchor(text, match.component)
          ) {
            report(context, node, "inlineComponent");
          }
        }
      },
    };
  },
});
