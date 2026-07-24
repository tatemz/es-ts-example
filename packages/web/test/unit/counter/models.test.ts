import { expect, test } from "bun:test";
import * as Arr from "effect/Array";
import * as Schema from "effect/Schema";
import { makeCounterPageModel } from "../../../src/factories/pages/CounterPage.factory.ts";
import { CounterPageModel } from "../../../src/models/pages/CounterPage.model.ts";
import { AlertModel } from "../../../src/models/controls/Alert.model.ts";
import { HtmlDocumentModel } from "../../../src/models/controls/HtmlDocument.model.ts";
import { PostFormModel } from "../../../src/models/controls/PostForm.model.ts";
import { SubmitButtonModel } from "../../../src/models/controls/SubmitButton.model.ts";
import { TextFieldModel } from "../../../src/models/controls/TextField.model.ts";

const validPage = makeCounterPageModel({
  counters: [{ _tag: "ActiveCounterSummary", counterId: "alpha", value: 1, version: 2 }],
  error: "command-failed",
  newCounterId: "beta",
});

const isPage = Schema.is(CounterPageModel);

const statusTextsOf = (page: CounterPageModel): ReadonlyArray<string> =>
  page.list._tag === "CounterListPopulated" ? Arr.map(page.list.rows, (row) => row.statusText) : [];

test("a counter row shows the state its summary reports", () => {
  const page = makeCounterPageModel({
    counters: [
      { _tag: "ActiveCounterSummary", counterId: "alpha", value: 1, version: 2 },
      { _tag: "DisabledCounterSummary", counterId: "beta", value: 4, version: 9 },
    ],
  });

  expect(statusTextsOf(page)).toEqual(["status=active", "status=disabled"]);
});

test("each counter model schema accepts well-formed values and rejects malformed structure", () => {
  expect({
    submitValid: Schema.is(SubmitButtonModel)({
      _tag: "SubmitButtonModel",
      label: "x",
      tone: "primary",
    }),
    submitBadTone: Schema.is(SubmitButtonModel)({
      _tag: "SubmitButtonModel",
      label: "x",
      tone: "tertiary",
    }),
    alertValid: Schema.is(AlertModel)({ _tag: "AlertVisible", message: "m" }),
    alertMissingMessage: Schema.is(AlertModel)({ _tag: "AlertVisible" }),
    textValid: Schema.is(TextFieldModel)({
      _tag: "TextFieldModel",
      id: "i",
      label: "l",
      name: "n",
      presentation: { _tag: "TextFieldPresentationDefault" },
      value: "v",
    }),
    textBadPresentation: Schema.is(TextFieldModel)({
      _tag: "TextFieldModel",
      id: "i",
      label: "l",
      name: "n",
      presentation: { _tag: "Nope" },
      value: "v",
    }),
    docValid: Schema.is(HtmlDocumentModel)({
      _tag: "HtmlDocumentModel",
      description: "d",
      stylesheetHref: "/s",
      title: "t",
    }),
    postFormValid: Schema.is(PostFormModel)({
      _tag: "PostFormModel",
      action: "/a",
      hiddenFields: [],
    }),
    postFormMalformedHiddenField: Schema.is(PostFormModel)({
      _tag: "PostFormModel",
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
