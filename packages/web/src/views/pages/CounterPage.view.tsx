import * as Arr from "effect/Array";
import * as Match from "effect/Match";
import type { CounterPageModel } from "../../models/pages/CounterPage.model.ts";
import type { View } from "../../mvc/view.ts";
import { AlertView } from "../controls/Alert.view.tsx";
import { HtmlDocumentView } from "../controls/HtmlDocument.view.tsx";
import { PostFormView } from "../controls/PostForm.view.tsx";
import { SubmitButtonView } from "../controls/SubmitButton.view.tsx";
import { TextFieldView } from "../controls/TextField.view.tsx";

type CounterRow = Extract<
  CounterPageModel["list"],
  { readonly _tag: "CounterListPopulated" }
>["rows"][number];

const counterRowView = (row: CounterRow) => (
  <li
    className="flex flex-wrap items-center gap-4 rounded-box bg-base-100 p-4"
    data-counter-id={row.counterId}
  >
    <span className="font-mono font-semibold" data-role="counter-id">
      {row.counterId}
    </span>
    <span className="font-mono" data-role="counter-value">
      {row.valueText}
    </span>
    <span className="font-mono" data-role="counter-status">
      {row.statusText}
    </span>
    <span className="font-mono text-base-content/60" data-role="counter-version">
      {row.versionText}
    </span>
    <span className="ml-auto flex gap-2">
      {Arr.map(row.actions, (action) => PostFormView(action.form, SubmitButtonView(action.button)))}
    </span>
  </li>
);

const counterListView = (list: CounterPageModel["list"]) =>
  Match.value(list).pipe(
    Match.tagsExhaustive({
      CounterListEmpty: ({ message }) => (
        <p className="text-base-content/60" data-role="counter-list-empty">
          {message}
        </p>
      ),
      CounterListPopulated: ({ rows }) => (
        <ul className="grid gap-3" data-role="counter-list">
          {Arr.map(rows, counterRowView)}
        </ul>
      ),
    }),
  );

export const CounterPageView: View<CounterPageModel> = (model) =>
  HtmlDocumentView(
    model.document,
    <main className="mx-auto grid w-full max-w-2xl gap-8 p-6" data-component="CounterPage">
      <header className="grid gap-2">
        <h1 className="text-2xl font-bold text-primary">{model.heading}</h1>
        <p className="text-base-content/70">{model.intro}</p>
      </header>
      {AlertView(model.alert)}
      {PostFormView(
        model.createForm,
        <section className="flex flex-wrap items-end gap-4 rounded-box bg-base-100 p-4">
          {TextFieldView(model.newCounterField)}
          {SubmitButtonView(model.createButton)}
        </section>,
      )}
      {counterListView(model.list)}
    </main>,
  );
