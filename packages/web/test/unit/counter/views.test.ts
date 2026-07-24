import { expect, test } from "bun:test";
import { makeCounterPageModel } from "../../../src/factories/pages/CounterPage.factory.ts";
import { makeAlertModel } from "../../../src/factories/controls/Alert.factory.ts";
import { makeHtmlDocumentModel } from "../../../src/factories/controls/HtmlDocument.factory.ts";
import { makePostFormModel } from "../../../src/factories/controls/PostForm.factory.ts";
import { makeSubmitButtonModel } from "../../../src/factories/controls/SubmitButton.factory.ts";
import { makeTextFieldModel } from "../../../src/factories/controls/TextField.factory.ts";
import { html, renderHtml } from "../../../src/mvc/html.ts";
import { CounterPageView } from "../../../src/views/pages/CounterPage.view.tsx";
import { AlertView } from "../../../src/views/controls/Alert.view.tsx";
import { HtmlDocumentView } from "../../../src/views/controls/HtmlDocument.view.tsx";
import { PostFormView } from "../../../src/views/controls/PostForm.view.tsx";
import { SubmitButtonView } from "../../../src/views/controls/SubmitButton.view.tsx";
import { TextFieldView } from "../../../src/views/controls/TextField.view.tsx";

const populatedPage = makeCounterPageModel({
  counters: [{ _tag: "ActiveCounterSummary", counterId: "alpha", value: 2, version: 3 }],
  error: "command-failed",
  newCounterId: "beta",
});

test("every counter view renders its stable, model-derived DOM", () => {
  expect({
    buttonPrimary: renderHtml(
      SubmitButtonView(makeSubmitButtonModel({ label: "Go", tone: "primary" })),
    ),
    buttonSecondary: renderHtml(
      SubmitButtonView(makeSubmitButtonModel({ label: "Stop", tone: "secondary" })),
    ),
    textDefault: renderHtml(
      TextFieldView(makeTextFieldModel({ id: "f", label: "Label", name: "n", value: "v" })),
    ),
    textEmptyError: renderHtml(
      TextFieldView(
        makeTextFieldModel({
          errorMessage: "",
          id: "f",
          label: "Label",
          name: "n",
          value: "v",
        }),
      ),
    ),
    textError: renderHtml(
      TextFieldView(
        makeTextFieldModel({
          errorMessage: "bad",
          id: "f",
          label: "L",
          name: "n",
          placeholder: "ph",
          value: "v",
        }),
      ),
    ),
    alertHidden: renderHtml(AlertView(makeAlertModel({}))),
    alertEmpty: renderHtml(AlertView(makeAlertModel({ message: "" }))),
    alertVisible: renderHtml(AlertView(makeAlertModel({ message: "oops" }))),
    formPlain: renderHtml(
      PostFormView(
        makePostFormModel({ action: "/act", hiddenFields: [{ name: "a", value: "1" }] }),
      ),
    ),
    formEncodedSlot: renderHtml(
      PostFormView(
        makePostFormModel({
          action: "/a",
          encoding: "multipart/form-data",
          hiddenFields: [],
        }),
        html("<b>x</b>"),
      ),
    ),
    doc: renderHtml(
      HtmlDocumentView(makeHtmlDocumentModel({ title: "T" }), html("<main>hi</main>")),
    ),
    pageEmpty: renderHtml(CounterPageView(makeCounterPageModel({ counters: [] }))),
    pageMissingId: renderHtml(
      CounterPageView(makeCounterPageModel({ counters: [], error: "missing-id" })),
    ),
    pagePopulated: renderHtml(CounterPageView(populatedPage)),
  }).toEqual({
    buttonPrimary:
      '<button class="btn btn-primary" data-component="SubmitButton" data-design-id="submit-button" type="submit">Go</button>',
    buttonSecondary:
      '<button class="btn btn-secondary btn-outline" data-component="SubmitButton" data-design-id="submit-button" type="submit">Stop</button>',
    textDefault:
      '<label class="grid w-full gap-2 text-sm font-semibold" data-component="TextField" data-design-id="text-field" for="f">Label<input class="input input-bordered w-full" id="f" name="n" type="text" value="v"></input></label>',
    textEmptyError:
      '<label class="grid w-full gap-2 text-sm font-semibold" data-component="TextField" data-design-id="text-field" for="f">Label<input class="input input-bordered w-full" id="f" name="n" type="text" value="v"></input></label>',
    textError:
      '<label class="grid w-full gap-2 text-sm font-semibold" data-component="TextField" data-design-id="text-field" for="f">L<input class="input input-bordered input-error w-full" id="f" name="n" placeholder="ph" type="text" value="v"></input><span class="text-sm text-error" role="alert">bad</span></label>',
    alertHidden: "",
    alertEmpty: "",
    alertVisible: '<p class="alert alert-error" data-component="Alert" role="alert">oops</p>',
    formPlain:
      '<form action="/act" class="contents" data-component="PostForm" data-design-id="post-form" method="post"><input name="a" type="hidden" value="1"></input></form>',
    formEncodedSlot:
      '<form action="/a" class="contents" data-component="PostForm" data-design-id="post-form" enctype="multipart/form-data" method="post"><b>x</b></form>',
    doc: '<!doctype html><html lang="en"><head><meta charset="utf-8"></meta><meta content="width=device-width, initial-scale=1, viewport-fit=cover" name="viewport"></meta><meta content="Event-sourced counters rebuilt from their event streams." name="description"></meta><title>T</title><link href="/client.css" rel="stylesheet"></link></head><body class="bg-base-100" data-component="HtmlDocument" data-theme="es-ts-example"><main>hi</main></body></html>',
    pageEmpty:
      '<!doctype html><html lang="en"><head><meta charset="utf-8"></meta><meta content="width=device-width, initial-scale=1, viewport-fit=cover" name="viewport"></meta><meta content="Event-sourced counters rebuilt from their event streams." name="description"></meta><title>Counters</title><link href="/client.css" rel="stylesheet"></link></head><body class="bg-base-100" data-component="HtmlDocument" data-theme="es-ts-example"><main class="mx-auto grid w-full max-w-2xl gap-8 p-6" data-component="CounterPage"><header class="grid gap-2"><h1 class="text-2xl font-bold text-primary">Counters</h1><p class="text-base-content/70">Each counter is rebuilt by replaying its stored events.</p></header><form action="/actions/counter/create" class="contents" data-component="PostForm" data-design-id="post-form" method="post"><section class="flex flex-wrap items-end gap-4 rounded-box bg-base-100 p-4"><label class="grid w-full gap-2 text-sm font-semibold" data-component="TextField" data-design-id="text-field" for="new-counter-id">New counter id<input class="input input-bordered w-full" id="new-counter-id" name="counterId" placeholder="counter-1" type="text" value=""></input></label><button class="btn btn-primary" data-component="SubmitButton" data-design-id="submit-button" type="submit">Create counter</button></section></form><p class="text-base-content/60" data-role="counter-list-empty">No counters yet. Create one to start an event stream.</p></main></body></html>',
    pageMissingId:
      '<!doctype html><html lang="en"><head><meta charset="utf-8"></meta><meta content="width=device-width, initial-scale=1, viewport-fit=cover" name="viewport"></meta><meta content="Event-sourced counters rebuilt from their event streams." name="description"></meta><title>Counters</title><link href="/client.css" rel="stylesheet"></link></head><body class="bg-base-100" data-component="HtmlDocument" data-theme="es-ts-example"><main class="mx-auto grid w-full max-w-2xl gap-8 p-6" data-component="CounterPage"><header class="grid gap-2"><h1 class="text-2xl font-bold text-primary">Counters</h1><p class="text-base-content/70">Each counter is rebuilt by replaying its stored events.</p></header><form action="/actions/counter/create" class="contents" data-component="PostForm" data-design-id="post-form" method="post"><section class="flex flex-wrap items-end gap-4 rounded-box bg-base-100 p-4"><label class="grid w-full gap-2 text-sm font-semibold" data-component="TextField" data-design-id="text-field" for="new-counter-id">New counter id<input class="input input-bordered input-error w-full" id="new-counter-id" name="counterId" placeholder="counter-1" type="text" value=""></input><span class="text-sm text-error" role="alert">Enter a counter id before creating a counter.</span></label><button class="btn btn-primary" data-component="SubmitButton" data-design-id="submit-button" type="submit">Create counter</button></section></form><p class="text-base-content/60" data-role="counter-list-empty">No counters yet. Create one to start an event stream.</p></main></body></html>',
    pagePopulated:
      '<!doctype html><html lang="en"><head><meta charset="utf-8"></meta><meta content="width=device-width, initial-scale=1, viewport-fit=cover" name="viewport"></meta><meta content="Event-sourced counters rebuilt from their event streams." name="description"></meta><title>Counters</title><link href="/client.css" rel="stylesheet"></link></head><body class="bg-base-100" data-component="HtmlDocument" data-theme="es-ts-example"><main class="mx-auto grid w-full max-w-2xl gap-8 p-6" data-component="CounterPage"><header class="grid gap-2"><h1 class="text-2xl font-bold text-primary">Counters</h1><p class="text-base-content/70">Each counter is rebuilt by replaying its stored events.</p></header><p class="alert alert-error" data-component="Alert" role="alert">That counter command could not be applied.</p><form action="/actions/counter/create" class="contents" data-component="PostForm" data-design-id="post-form" method="post"><section class="flex flex-wrap items-end gap-4 rounded-box bg-base-100 p-4"><label class="grid w-full gap-2 text-sm font-semibold" data-component="TextField" data-design-id="text-field" for="new-counter-id">New counter id<input class="input input-bordered w-full" id="new-counter-id" name="counterId" placeholder="counter-1" type="text" value="beta"></input></label><button class="btn btn-primary" data-component="SubmitButton" data-design-id="submit-button" type="submit">Create counter</button></section></form><ul class="grid gap-3" data-role="counter-list"><li class="flex flex-wrap items-center gap-4 rounded-box bg-base-100 p-4" data-counter-id="alpha"><span class="font-mono font-semibold" data-role="counter-id">alpha</span><span class="font-mono" data-role="counter-value">value=2</span><span class="font-mono" data-role="counter-status">status=active</span><span class="font-mono text-base-content/60" data-role="counter-version">version=3</span><span class="ml-auto flex gap-2"><form action="/actions/counter/command" class="contents" data-component="PostForm" data-design-id="post-form" method="post"><input name="counterId" type="hidden" value="alpha"></input><input name="verb" type="hidden" value="increment"></input><button class="btn btn-secondary btn-outline" data-component="SubmitButton" data-design-id="submit-button" type="submit">Increment</button></form><form action="/actions/counter/command" class="contents" data-component="PostForm" data-design-id="post-form" method="post"><input name="counterId" type="hidden" value="alpha"></input><input name="verb" type="hidden" value="decrement"></input><button class="btn btn-secondary btn-outline" data-component="SubmitButton" data-design-id="submit-button" type="submit">Decrement</button></form><form action="/actions/counter/command" class="contents" data-component="PostForm" data-design-id="post-form" method="post"><input name="counterId" type="hidden" value="alpha"></input><input name="verb" type="hidden" value="disable"></input><button class="btn btn-secondary btn-outline" data-component="SubmitButton" data-design-id="submit-button" type="submit">Disable</button></form></span></li></ul></main></body></html>',
  });
});
