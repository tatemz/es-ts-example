import { expect, test } from "bun:test";
import * as Schema from "effect/Schema";
import { makeCounterPageModel } from "../../../src/factories/CounterPage.factory.ts";
import { CounterPageModel } from "../../../src/models/CounterPage.model.ts";
import { EsTsExampleAlertModel } from "../../../src/models/EsTsExampleAlert.model.ts";
import { EsTsExampleHtmlDocumentModel } from "../../../src/models/EsTsExampleHtmlDocument.model.ts";
import { EsTsExamplePostFormModel } from "../../../src/models/EsTsExamplePostForm.model.ts";
import { EsTsExampleSubmitButtonModel } from "../../../src/models/EsTsExampleSubmitButton.model.ts";
import { EsTsExampleTextFieldModel } from "../../../src/models/EsTsExampleTextField.model.ts";

const validPage = makeCounterPageModel({
  counters: [{ counterId: "alpha", status: "active", value: 1, version: 2 }],
  error: "command-failed",
  newCounterId: "beta",
});

const isPage = Schema.is(CounterPageModel);

test("each counter model schema accepts well-formed values and rejects malformed structure", () => {
  expect({
    submitValid: Schema.is(EsTsExampleSubmitButtonModel)({
      _tag: "EsTsExampleSubmitButtonModel",
      label: "x",
      tone: "primary",
    }),
    submitBadTone: Schema.is(EsTsExampleSubmitButtonModel)({
      _tag: "EsTsExampleSubmitButtonModel",
      label: "x",
      tone: "tertiary",
    }),
    alertValid: Schema.is(EsTsExampleAlertModel)({ _tag: "EsTsExampleAlertVisible", message: "m" }),
    alertMissingMessage: Schema.is(EsTsExampleAlertModel)({ _tag: "EsTsExampleAlertVisible" }),
    textValid: Schema.is(EsTsExampleTextFieldModel)({
      _tag: "EsTsExampleTextFieldModel",
      id: "i",
      label: "l",
      name: "n",
      presentation: { _tag: "EsTsExampleTextFieldPresentationDefault" },
      value: "v",
    }),
    textBadPresentation: Schema.is(EsTsExampleTextFieldModel)({
      _tag: "EsTsExampleTextFieldModel",
      id: "i",
      label: "l",
      name: "n",
      presentation: { _tag: "Nope" },
      value: "v",
    }),
    docValid: Schema.is(EsTsExampleHtmlDocumentModel)({
      _tag: "EsTsExampleHtmlDocumentModel",
      description: "d",
      stylesheetHref: "/s",
      title: "t",
    }),
    postFormValid: Schema.is(EsTsExamplePostFormModel)({
      _tag: "EsTsExamplePostFormModel",
      action: "/a",
      hiddenFields: [],
    }),
    postFormMalformedHiddenField: Schema.is(EsTsExamplePostFormModel)({
      _tag: "EsTsExamplePostFormModel",
      action: "/a",
      hiddenFields: [{}],
    }),
    pageValid: isPage(validPage),
    pageMalformedRow: isPage({
      ...validPage,
      list: { _tag: "CounterListPopulated", rows: [{}] },
    }),
    pageMalformedAction: isPage({
      ...validPage,
      list: {
        _tag: "CounterListPopulated",
        rows: [
          {
            actions: [{}],
            counterId: "alpha",
            statusText: "status=active",
            valueText: "value=1",
            versionText: "version=2",
          },
        ],
      },
    }),
  }).toEqual({
    submitValid: true,
    submitBadTone: false,
    alertValid: true,
    alertMissingMessage: false,
    textValid: true,
    textBadPresentation: false,
    docValid: true,
    postFormValid: true,
    postFormMalformedHiddenField: false,
    pageValid: true,
    pageMalformedRow: false,
    pageMalformedAction: false,
  });
});
