import { describe, it } from "node:test";

globalThis.describe = describe;
globalThis.it = it;

const { RuleTester } = await import("oxlint/plugins-dev");
const { default: esTsExamplePlugin } = await import("../../oxlint-plugins/es-ts-example/index.mjs");

const tester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2023,
    sourceType: "module",
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
});

const rules = esTsExamplePlugin.rules;

const harmlessModule = "const value = 1;\nexport const result = value;\n";
const workspaceRoot = process.cwd();
const webModelPath = (stem, layer = "controls") =>
  `${workspaceRoot}/packages/web/src/models/${layer}/${stem}.model.ts`;
const webFactoryPath = (stem, layer = "controls") =>
  `${workspaceRoot}/packages/web/src/factories/${layer}/${stem}.factory.ts`;
const webViewPath = (stem, layer = "controls") =>
  `${workspaceRoot}/packages/web/src/views/${layer}/${stem}.view.tsx`;
const webControllerPath = (stem) =>
  `${workspaceRoot}/packages/web/src/controllers/${stem}.controller.ts`;

describe("es-ts-example oxlint plugin", () => {
  tester.run("effect-first-code", rules["effect-first-code"], {
    valid: ["Effect.logInfo(message);"],
    invalid: [
      {
        code: "console.log(message);",
        filename: "/workspace/packages/domain/src/logging.ts",
        errors: [{ message: /Effect services/ }],
      },
      {
        code: "try { risky(); } catch (error) { throw error; }",
        filename: "/workspace/packages/application/src/boundary.ts",
        errors: [{ message: /Effect services/ }],
      },
    ],
  });

  tester.run("import-runtime-boundaries", rules["import-runtime-boundaries"], {
    valid: ["import * as FileSystem from 'effect/FileSystem';"],
    invalid: [
      {
        code: "import * as Fs from 'node:fs';",
        filename: "/workspace/packages/domain/src/file.ts",
        errors: [{ message: /boundary modules/ }],
      },
      {
        code: "const path = '/adventures/example';",
        filename: "/workspace/packages/web/src/adventure/controller.ts",
        errors: [{ message: /boundary modules/ }],
      },
    ],
  });

  tester.run("strong-types", rules["strong-types"], {
    valid: [
      {
        code: "const parsed = Schema.decodeUnknownEffect(UserId)(input);",
        filename: "/workspace/packages/domain/src/User.ts",
      },
    ],
    invalid: [
      {
        code: "const value = input as any;",
        filename: "/workspace/packages/domain/src/User.ts",
        errors: [{ message: /schemas/ }],
      },
    ],
  });

  tester.run("deterministic-control-flow", rules["deterministic-control-flow"], {
    valid: ["const value = Arr.map(items, makeItem);"],
    invalid: [
      {
        code: "switch (value) { case 'A': return 1; }",
        filename: "/workspace/packages/domain/src/reducer.ts",
        errors: [{ message: /immutable Effect-oriented/ }],
      },
    ],
  });

  tester.run("mvc-ui-architecture", rules["mvc-ui-architecture"], {
    valid: [
      {
        code: "export const PageModel = Schema.TaggedStruct('PageModel', {});",
        filename: webModelPath("Page", "pages"),
      },
      {
        code: "export const ButtonView = () => <button>Save</button>;",
        filename: webViewPath("Button", "controls"),
      },
    ],
    invalid: [
      {
        code: "export const makePageModel = async () => model;",
        filename: webModelPath("Page", "pages"),
        errors: [{ message: /MVC models/ }],
      },
      {
        code: "const markup = `<button>Save</button>`;",
        filename: webModelPath("Page", "pages"),
        errors: [{ message: /MVC models/ }],
      },
      {
        code: "export const PageView = () => <button>Save</button>;",
        filename: webViewPath("Page", "pages"),
        errors: [{ message: /MVC models/ }],
      },
    ],
  });

  tester.run("mvc-renderable-variants-use-tags", rules["mvc-renderable-variants-use-tags"], {
    valid: [
      {
        code: "export const PageShellModel = Schema.TaggedStruct('PageShellModel', { layout: LayoutModel });",
        filename: `${workspaceRoot}/packages/web/src/models/controls/PageShell.model.ts`,
      },
      {
        code: "export const LayoutModel = Schema.TaggedStruct('LayoutModel', { template: Schema.Literals(['app'] as const) });",
        filename: `${workspaceRoot}/packages/web/src/models/controls/Layout.model.ts`,
      },
      {
        code: "export const makeMessageModel = (input: { readonly tone?: 'info' | 'success' | 'error' }) => model;",
        filename: `${workspaceRoot}/packages/web/src/factories/controls/LiveMessage.factory.ts`,
      },
      {
        code: "const FooAndBarView = Match.typeTags<FooAndBarModel, Html>()({ FooModel: FooView, BarModel: BarView });",
        filename: webViewPath("FooAndBar"),
      },
      {
        code: "const activeShelfSection = (model) => Match.value(model.shelf).pipe(Match.tag('AdventureShelfModel', render), Match.orElse(() => undefined));",
        filename: `${workspaceRoot}/packages/web/src/browse/BrowsePage.view.tsx`,
      },
    ],
    invalid: [
      {
        code: "export const LayoutModel = Schema.TaggedStruct('LayoutModel', { template: Schema.Literals(['app', 'dashboard'] as const) });",
        filename: `${workspaceRoot}/packages/web/src/models/controls/Layout.model.ts`,
        errors: [{ messageId: "modelSelector" }],
      },
      {
        code: "export const LayoutModel = Schema.TaggedStruct('LayoutModel', { variant: Schema.Union(Schema.Literal('app'), Schema.Literal('dashboard')) });",
        filename: `${workspaceRoot}/packages/web/src/models/controls/Layout.model.ts`,
        errors: [{ messageId: "modelSelector" }],
      },
      {
        code: "export const makeLayoutModel = (input: { readonly layout?: 'app' | 'dashboard' }) => model;",
        filename: `${workspaceRoot}/packages/web/src/factories/controls/Layout.factory.ts`,
        errors: [{ messageId: "factorySelector" }],
      },
      {
        code: "const mainClassName = (input) => input.template === 'dashboard' ? 'drawer' : 'container';",
        filename: `${workspaceRoot}/packages/web/src/factories/controls/Layout.factory.ts`,
        errors: [{ messageId: "selectorBranch" }],
      },
      {
        code: "const mainClassName = (input) => input.layout == 'dashboard' ? 'drawer' : 'container';",
        filename: `${workspaceRoot}/packages/web/src/factories/controls/Layout.factory.ts`,
        errors: [{ messageId: "selectorBranch" }],
      },
      {
        code: "const LayoutView = (model) => model.variant !== 'app' ? <Dashboard /> : <App />;",
        filename: webViewPath("Layout"),
        errors: [{ messageId: "selectorBranch" }],
      },
      {
        code: "export const LayoutView = (model) => Match.value(model.variant).pipe(Match.when('app', AppLayoutView), Match.exhaustive);",
        filename: webViewPath("Layout"),
        errors: [{ messageId: "selectorBranch" }],
      },
    ],
  });

  tester.run("mvc-classes-stay-in-views", rules["mvc-classes-stay-in-views"], {
    valid: [
      {
        code: "export const ButtonModel = Schema.TaggedStruct('ButtonModel', { tone: ButtonTone, label: Schema.String });",
        filename: `${workspaceRoot}/packages/web/src/models/controls/Button.model.ts`,
      },
      {
        code: "const baseClassName = 'btn'; export const makeButtonModel = (input: { readonly tone: ButtonTone }) => ButtonModel.make({ tone: input.tone });",
        filename: `${workspaceRoot}/packages/web/src/factories/controls/Button.factory.ts`,
      },
      {
        code: "const className = (model) => model.tone === 'primary' ? 'btn-primary' : 'btn-ghost'; export const ButtonView = (model) => <button className={className(model)} />;",
        filename: webViewPath("Button"),
      },
      {
        code: harmlessModule,
        filename: "/workspace/packages/domain/src/Button.model.ts",
      },
      {
        code: "export const ButtonModel = Schema.TaggedStruct('ButtonModel', { classNames: Schema.Array(Schema.String) });",
        filename: `${workspaceRoot}/packages/web/src/models/controls/Button.model.ts`,
      },
    ],
    invalid: [
      {
        code: "export const ButtonModel = Schema.TaggedStruct('ButtonModel', { className: Schema.String });",
        filename: `${workspaceRoot}/packages/web/src/models/controls/Button.model.ts`,
        errors: [{ message: /semantic state/ }],
      },
      {
        code: "export const ButtonModel = Schema.TaggedStruct('ButtonModel', { activeClassName: Schema.String });",
        filename: `${workspaceRoot}/packages/web/src/models/controls/Button.model.ts`,
        errors: [{ message: /activeClassName/ }],
      },
      {
        code: "export const ButtonModel = Schema.TaggedStruct('ButtonModel', { 'className': Schema.String });",
        filename: `${workspaceRoot}/packages/web/src/models/controls/Button.model.ts`,
        errors: [{ message: /className/ }],
      },
      {
        code: "export type ButtonModelInput = { readonly panelClassName?: string };",
        filename: `${workspaceRoot}/packages/web/src/models/controls/Button.model.ts`,
        errors: [{ message: /panelClassName/ }],
      },
      {
        code: "export const makeButtonModel = (input: { readonly className?: string }) => ButtonModel.make({ tone: 'primary' });",
        filename: `${workspaceRoot}/packages/web/src/factories/controls/Button.factory.ts`,
        errors: [{ message: /className/ }],
      },
      {
        code: "export const makeButtonModel = () => ButtonModel.make({ className: 'btn btn-primary' });",
        filename: `${workspaceRoot}/packages/web/src/factories/controls/Button.factory.ts`,
        errors: [{ message: /className/ }],
      },
    ],
  });

  tester.run("test-discipline", rules["test-discipline"], {
    valid: [
      {
        code: "testEffect('works', () => Effect.succeed(1));",
        filename: "/workspace/packages/domain/test/unit/example.test.ts",
      },
    ],
    invalid: [
      {
        code: "testEffect('works', () => Effect.runSync(program));",
        filename: "/workspace/packages/domain/test/unit/example.test.ts",
        errors: [{ message: /TestEffect/ }],
      },
    ],
  });

  tester.run("effect-boundaries", rules["effect-boundaries"], {
    valid: [
      {
        code: "async function main() { await program; }",
        filename: "/workspace/scripts/lint-example.ts",
      },
      {
        code: "Effect.runPromise(program);",
        filename: "/workspace/packages/web/bin/main.ts",
      },
    ],
    invalid: [
      {
        code: "let value = 1;",
        filename: "/workspace/packages/domain/src/example.ts",
        errors: [{ messageId: "letDeclaration" }],
      },
      {
        code: "async function load() { await fetch(url); }",
        filename: "/workspace/packages/domain/src/example.ts",
        errors: [{ messageId: "asyncAwait" }, { messageId: "asyncAwait" }],
      },
      {
        code: "Effect.runPromise(program);",
        filename: "/workspace/packages/domain/src/example.ts",
        errors: [{ messageId: "runPromise" }],
      },
    ],
  });

  tester.run("test-assertion-quality", rules["test-assertion-quality"], {
    valid: [
      {
        code: "test('works', () => expect(value).toEqual(1));",
        filename: "/workspace/packages/domain/test/unit/example.test.ts",
      },
    ],
    invalid: [
      {
        code: "expect(value).toBeTruthy();",
        filename: "/workspace/packages/domain/test/unit/example.test.ts",
        errors: [{ messageId: "weakMatcher" }],
      },
      {
        code: "test('empty', () => value);",
        filename: "/workspace/packages/domain/test/unit/example.test.ts",
        errors: [{ messageId: "missingAssertion" }],
      },
      {
        code: "expect(() => parse()).toThrow();",
        filename: "/workspace/packages/domain/test/unit/example.test.ts",
        errors: [{ messageId: "bareThrow" }],
      },
    ],
  });

  tester.run("test-assertion-boundaries", rules["test-assertion-boundaries"], {
    valid: [
      {
        code: "test('works', () => expect(value).toEqual(1));",
        filename: "/workspace/packages/domain/test/unit/example.test.ts",
      },
    ],
    invalid: [
      {
        code: "test('does too much', () => { expect(first); assert.equal(second, third); });",
        filename: "/workspace/packages/domain/test/unit/example.test.ts",
        errors: [{ messageId: "tooMany" }],
      },
    ],
  });

  tester.run("rendered-dom-contract", rules["rendered-dom-contract"], {
    valid: [
      {
        code: "expect(html).toContain('data-component=\"Button\"');",
        filename: "/workspace/packages/web/test/unit/example.test.ts",
      },
    ],
    invalid: [
      {
        code: "expect(html).toContain('<button class=\"btn btn-primary card\">Save</button>');",
        filename: "/workspace/packages/web/test/unit/example.test.ts",
        errors: [{ messageId: "brittle" }],
      },
    ],
  });

  tester.run("test-fixture-boundaries", rules["test-fixture-boundaries"], {
    valid: [
      {
        code: "import { makeFixture } from './support/fixtures.ts';",
        filename: "/workspace/packages/web/test/unit/example.test.ts",
      },
    ],
    invalid: [
      {
        code: "import { demo } from '../../src/demo.ts';",
        filename: "/workspace/packages/web/test/unit/example.test.ts",
        errors: [{ messageId: "demoImport" }],
      },
      {
        code: "const marker = 'Mutation sentinel';",
        filename: "/workspace/packages/web/test/unit/example.test.ts",
        errors: [{ messageId: "sentinel" }],
      },
    ],
  });

  tester.run("web-view-model-strings", rules["web-view-model-strings"], {
    valid: [
      {
        code: "export const ButtonView = (model) => <button title={model.title}>{model.label}</button>;",
        filename: webViewPath("Button"),
      },
    ],
    invalid: [
      {
        code: 'export const ButtonView = () => <button title="Save">Save</button>;',
        filename: webViewPath("Button"),
        errors: [{ messageId: "attribute" }, { messageId: "text" }],
      },
    ],
  });

  tester.run("web-ui-component-contracts", rules["web-ui-component-contracts"], {
    valid: [
      {
        code: 'export const ButtonView = () => <button data-component="Button" />;',
        filename: webViewPath("Button"),
      },
    ],
    invalid: [
      {
        code: "import { Counter } from '@es-ts-example/domain'; export const ButtonView = () => <button />;",
        filename: webViewPath("Button"),
        errors: [{ messageId: "domainImport" }, { messageId: "dataComponent" }],
      },
    ],
  });

  tester.run("public-entrypoint-policy", rules["public-entrypoint-policy"], {
    valid: [
      { code: "export * from './counter.ts';", filename: "/workspace/packages/web/src/index.ts" },
    ],
    invalid: [
      {
        code: "export * from './demoSeed.ts';",
        filename: "/workspace/packages/web/src/index.ts",
        errors: [{ messageId: "seedExport" }],
      },
    ],
  });

  tester.run("view-filenaming-convention", rules["view-filenaming-convention"], {
    valid: [
      {
        code: harmlessModule,
        filename: webViewPath("counter-row"),
      },
      {
        code: harmlessModule,
        filename: webViewPath("CounterRow"),
      },
    ],
    invalid: [
      {
        code: harmlessModule,
        filename: webViewPath("counter_Row"),
        errors: [{ messageId: "invalid" }],
      },
    ],
  });

  tester.run("mvc-view-prefers-model-parameter", rules["mvc-view-prefers-model-parameter"], {
    valid: [
      {
        code: "export const PageView = (model) => <div>{model.title}</div>;",
        filename: webViewPath("Page"),
      },
    ],
    invalid: [
      {
        code: "export const PageView = ({ title }) => <div>{title}</div>;",
        filename: webViewPath("Page"),
        errors: [{ messageId: "noDestructuredModel" }],
      },
      {
        code: "export const PageView = (page) => <div>{page.title}</div>;",
        filename: webViewPath("Page"),
        errors: [{ messageId: "preferModelParameter" }],
      },
    ],
  });

  tester.run("effect-trypromise-requires-catch", rules["effect-trypromise-requires-catch"], {
    valid: [
      {
        code: "const value = Effect.tryPromise({ try: () => fetch(url), catch: mapError });",
        filename: "/workspace/packages/application/src/http.ts",
      },
    ],
    invalid: [
      {
        code: "const value = Effect.tryPromise(() => fetch(url));",
        filename: "/workspace/packages/application/src/http.ts",
        errors: [{ message: /foreign promise failures/ }],
      },
    ],
  });

  tester.run("no-fallible-module-scope-make", rules["no-fallible-module-scope-make"], {
    valid: [
      {
        code: "export const events = Arr.make(UserCreated, UserRenamed);",
        filename: "/workspace/packages/domain/src/events.ts",
      },
      {
        code: "export const makeUser = (id) => UserId.make(id);",
        filename: "/workspace/packages/domain/src/User.ts",
      },
      {
        code: "export const GetUser = Rpc.make('GetUser', {});",
        filename: "/workspace/packages/application/src/rpc.ts",
      },
      {
        code: "export const webI18n = I18n.make({ messages });",
        filename: "/workspace/packages/web/src/i18n/messages.ts",
      },
    ],
    invalid: [
      {
        code: "export const userId = UserId.make('user-1');",
        filename: "/workspace/packages/domain/src/User.ts",
        errors: [{ message: /module import/ }],
      },
      {
        code: "const event = Events.UserCreated.make({ id });",
        filename: "/workspace/packages/domain/src/events.ts",
        errors: [{ message: /module import/ }],
      },
    ],
  });

  tester.run("no-lowercase-effect-order", rules["no-lowercase-effect-order"], {
    valid: ["const order = Order.String;"],
    invalid: [
      {
        code: "const order = Order.string;",
        errors: [{ message: /Order.String/ }],
      },
    ],
  });

  tester.run("no-native-standard-library", rules["no-native-standard-library"], {
    valid: [
      {
        code: "const normalized = Str.trim(input);",
        filename: "/workspace/packages/web/src/controller.ts",
      },
      {
        code: "const normalized = Arr.map(input, renderItem);",
        filename: "/workspace/packages/web/src/controller.ts",
      },
      {
        code: "const result = Option.match(value, { onNone, onSome });",
        filename: "/workspace/packages/web/src/controller.ts",
      },
      {
        code: "const normalized = input.trim();",
        filename: "/workspace/packages/web/test/unit/controller.test.ts",
      },
      {
        code: "const value = Schema.decodeUnknownEffect(User)(input);",
        filename: "/workspace/packages/application/src/query.ts",
      },
    ],
    invalid: [
      {
        code: "const normalized = input.trim();",
        filename: "/workspace/packages/web/src/controller.ts",
        errors: [{ message: /Effect standard library/ }],
      },
      {
        code: "const rows = input.map(render);",
        filename: "/workspace/packages/web/src/controller.ts",
        errors: [{ message: /Effect standard library/ }],
      },
      {
        code: "const value = Object.fromEntries(entries);",
        filename: "/workspace/packages/web/src/controller.ts",
        errors: [{ message: /Effect standard library/ }],
      },
      {
        code: "const value = JSON.parse(JSON.stringify(input));",
        filename: "/workspace/packages/application/src/query.ts",
        errors: [{ message: /Schema-backed JSON boundaries/ }],
      },
    ],
  });

  tester.run("no-option-returning-filter-map", rules["no-option-returning-filter-map"], {
    valid: ["const values = Arr.filterMap(items, (item) => Result.succeed(item));"],
    invalid: [
      {
        code: "const values = Arr.filterMap(items, (item) => Option.some(item));",
        errors: [{ message: /Effect v4/ }],
      },
      {
        code: "const values = Arr.filterMap((item) => item.enabled ? Option.some(item) : Option.none())(items);",
        errors: [{ message: /Effect v4/ }],
      },
    ],
  });

  tester.run("mvc-one-export-per-role-file", rules["mvc-one-export-per-role-file"], {
    valid: [
      { code: harmlessModule, filename: "/workspace/not-web-source.ts" },
      {
        code: `export type Input = { readonly id: string };
const helper = (value: string): string => value;
export const getCreatorPageController = (input: Input) => helper(input.id);`,
        filename: webControllerPath("getCreatorPage"),
      },
      {
        code: `import * as Schema from "effect/Schema";

const AlertHidden = Schema.TaggedStruct("AlertHidden", {});
const AlertVisible = Schema.TaggedStruct("AlertVisible", {
  message: Schema.String,
});

export const AlertModel = Schema.Union([AlertHidden, AlertVisible]);
export type AlertModel = typeof AlertModel.Type;`,
        filename: webModelPath("Alert"),
      },
      {
        code: `import * as Schema from "effect/Schema";

export const TextFieldModel = Schema.TaggedStruct("TextFieldModel", {
  id: Schema.String,
});
export type TextFieldModel = typeof TextFieldModel.Type;`,
        filename: webModelPath("TextField"),
      },
      {
        code: `import { TextFieldModel } from "../../models/controls/TextField.model.ts";
export const makeTextFieldModel = (input: { id: string }): TextFieldModel =>
  TextFieldModel.make(input);`,
        filename: webFactoryPath("TextField"),
      },
      {
        code: `import * as Schema from "effect/Schema";
import { TextFieldModel } from "../../models/controls/TextField.model.ts";
export const makeTextFieldModel = (input: { id: string }): TextFieldModel =>
  Schema.decodeUnknownSync(TextFieldModel)(input);`,
        filename: webFactoryPath("TextField"),
      },
      {
        code: `import { TextFieldModel } from "../../models/controls/TextField.model.ts";
export const makeTextFieldModel = (input: { id: string }): TextFieldModel =>
  TextFieldModel.make(input);
export const cloneTextFieldModel = (model: TextFieldModel): TextFieldModel => model;
const helper = (): string => "ok";`,
        filename: webFactoryPath("TextField"),
      },
      {
        code: `import type { TextFieldModel } from "../../models/controls/TextField.model.ts";
import type { View } from "../../mvc/view.ts";
export const TextFieldView: View<TextFieldModel> = (model) => <input />;`,
        filename: webViewPath("TextField"),
      },
    ],
    invalid: [
      {
        code: "export type Input = { readonly id: string };",
        filename: webControllerPath("getCreatorPage"),
        errors: [{ messageId: "controllerOneController", data: { count: "0" } }],
      },
      {
        code: `export const getCreatorPageController = () => model;
export const postCreatorPageController = () => model;`,
        filename: webControllerPath("creatorPage"),
        errors: [{ messageId: "controllerOneController", data: { count: "2" } }],
      },
      {
        code: `export const getCreatorPageController = () => model;
export const sharedHelper = () => value;`,
        filename: webControllerPath("getCreatorPage"),
        errors: [{ messageId: "controllerInvalidExport" }],
      },
      {
        code: `import * as Schema from "effect/Schema";

export const TextFieldModel = Schema.TaggedStruct("TextFieldModel", {
  id: Schema.String,
});
export const TextFieldExtraModel = Schema.TaggedStruct("TextFieldExtraModel", {
  id: Schema.String,
});
export type TextFieldModel = typeof TextFieldModel.Type;`,
        filename: webModelPath("TextField"),
        errors: [{ messageId: "modelMultipleModels" }],
      },
      {
        code: `import * as Schema from "effect/Schema";

export const TextFieldHidden = Schema.TaggedStruct("TextFieldHidden", {});
export const TextFieldModel = Schema.TaggedStruct("TextFieldModel", {
  id: Schema.String,
});
export type TextFieldModel = typeof TextFieldModel.Type;`,
        filename: webModelPath("TextField"),
        errors: [{ messageId: "modelMultipleModels" }],
      },
      {
        code: "export const makeTextFieldModel = () => TextFieldModel.make({});",
        filename: webFactoryPath("TextField"),
        errors: [{ messageId: "factoryMissingImport" }, { messageId: "factoryInvalidReturnType" }],
      },
      {
        code: `import { TextFieldModel } from "../../models/controls/TextField.model.ts";
export const makeTextFieldModel = (input: { id: string }): string =>
  TextFieldModel.make(input).id;`,
        filename: webFactoryPath("TextField"),
        errors: [{ messageId: "factoryInvalidReturnType" }],
      },
      {
        code: `import { TextFieldModel } from "../../models/controls/TextField.model.ts";
export const makeTextFieldModel = (input: { id: string }) =>
  TextFieldModel.make(input);`,
        filename: webFactoryPath("TextField"),
        errors: [{ messageId: "factoryInvalidReturnType" }],
      },
      {
        code: `import { TextFieldModel } from "../../models/controls/TextField.model.ts";
export const makeTextFieldModel = TextFieldModel.make;`,
        filename: webFactoryPath("TextField"),
        errors: [{ messageId: "factoryMissingConstructor" }, { messageId: "factoryInvalidExport" }],
      },
      {
        code: `import { TextFieldModel } from "../../models/controls/TextField.model.ts";
export type TextFieldInput = { id: string };
export const makeTextFieldModel = (input: TextFieldInput): TextFieldModel =>
  TextFieldModel.make(input);`,
        filename: webFactoryPath("TextField"),
        errors: [{ messageId: "factoryTypeExport" }],
      },
      {
        code: `import { TextFieldModel } from "../../models/controls/TextField.model.ts";
export { makeTextFieldModel } from "./other.factory.ts";`,
        filename: webFactoryPath("TextField"),
        errors: [
          { messageId: "factoryMissingFactory" },
          { messageId: "factoryMissingConstructor" },
          { messageId: "factoryInvalidExport" },
        ],
      },
      {
        code: `import type { TextFieldModel } from "./TextField.model.ts";
import type { View } from "../../mvc/view.ts";
export const TextFieldView: View<TextFieldModel> = (model) => <input />;`,
        filename: webViewPath("TextField"),
        errors: [{ messageId: "viewInvalidModel" }],
      },
      {
        code: `import type { TextFieldModel } from "../../models/controls/TextField.model.ts";
import type { View } from "../../mvc/view.ts";
export type TextFieldViewProps = { model: TextFieldModel };
export const TextFieldView: View<TextFieldModel> = (model) => <input />;`,
        filename: webViewPath("TextField"),
        errors: [{ messageId: "viewTypeExport" }],
      },
      {
        code: `import type { TextFieldModel } from "../../models/controls/TextField.model.ts";
import type { View } from "../../mvc/view.ts";
export interface TextFieldViewProps { model: TextFieldModel }
export const TextFieldView: View<TextFieldModel> = (model) => <input />;`,
        filename: webViewPath("TextField"),
        errors: [{ messageId: "viewTypeExport" }],
      },
      {
        code: `import type { TextFieldModel } from "../../models/controls/TextField.model.ts";
import type { View } from "../../mvc/view.ts";
export enum TextFieldViewState { Ready }
export const TextFieldView: View<TextFieldModel> = (model) => <input />;`,
        filename: webViewPath("TextField"),
        errors: [{ messageId: "viewTypeExport" }],
      },
      {
        code: `import type { TextFieldModel } from "../../models/controls/TextField.model.ts";
import type { View } from "../../mvc/view.ts";
export type { TextFieldModel };
export const TextFieldView: View<TextFieldModel> = (model) => <input />;`,
        filename: webViewPath("TextField"),
        errors: [{ messageId: "viewTypeExport" }],
      },
    ],
  });

  tester.run("mvc-controller-no-model-factories", rules["mvc-controller-no-model-factories"], {
    valid: [
      {
        code: `import { makeCreatorPageModel } from "../factories/CreatorPage.factory.ts";
export const getCreatorPageController = () => makeCreatorPageModel(input);`,
        filename: webControllerPath("getCreatorPage"),
      },
      {
        code: "const model = CreatorPageModel.make(input);",
        filename: webFactoryPath("CreatorPage"),
      },
    ],
    invalid: [
      {
        code: "const makeCreatorPageModel = (): CreatorPageModel => factory(input);",
        filename: webControllerPath("getCreatorPage"),
        errors: [{ messageId: "modelFactory" }],
      },
      {
        code: "const page = (): CreatorPageModel => factory(input);",
        filename: webControllerPath("getCreatorPage"),
        errors: [{ messageId: "modelFactory" }],
      },
      {
        code: "const creatorPageModel = () => factory(input);",
        filename: webControllerPath("getCreatorPage"),
        errors: [{ messageId: "modelFactory" }],
      },
      {
        code: "const model = CreatorPageModel.make(input);",
        filename: webControllerPath("getCreatorPage"),
        errors: [{ messageId: "modelConstructor" }],
      },
      {
        code: "function buildCreatorPageModel(): CreatorPageModel { return factory(input); }",
        filename: webControllerPath("getCreatorPage"),
        errors: [{ messageId: "modelFactory" }],
      },
    ],
  });

  tester.run("mvc-file-placement", rules["mvc-file-placement"], {
    valid: [
      { code: harmlessModule, filename: webModelPath("CreatorPage") },
      { code: harmlessModule, filename: webFactoryPath("CreatorPage") },
      { code: harmlessModule, filename: webViewPath("CreatorPage", "pages") },
      { code: harmlessModule, filename: webControllerPath("creator") },
      { code: harmlessModule, filename: `${workspaceRoot}/packages/web/src/mvc/controller.ts` },
      { code: harmlessModule, filename: `${workspaceRoot}/packages/web/src/mvc/view.ts` },
      { code: harmlessModule, filename: `${workspaceRoot}/packages/web/src/mvc/html.ts` },
      { code: harmlessModule, filename: `${workspaceRoot}/packages/web/src/routes.ts` },
      { code: harmlessModule, filename: `${workspaceRoot}/packages/web/src/index.ts` },
      { code: harmlessModule, filename: "/workspace/packages/domain/src/Page.model.ts" },
    ],
    invalid: [
      {
        code: harmlessModule,
        filename: `${workspaceRoot}/packages/web/src/Page.model.ts`,
        errors: [{ message: /model file/ }],
      },
      {
        code: harmlessModule,
        filename: `${workspaceRoot}/packages/web/src/ui/Button.model.ts`,
        errors: [{ message: /model file/ }],
      },
      {
        code: harmlessModule,
        filename: `${workspaceRoot}/packages/web/src/views/CreatorPage.view.tsx`,
        errors: [{ messageId: "unlayeredViewPlacement" }],
      },
      {
        code: harmlessModule,
        filename: `${workspaceRoot}/packages/web/src/views/legacy/CreatorPage.view.tsx`,
        errors: [{ messageId: "unknownViewLayer" }],
      },
      {
        code: harmlessModule,
        filename: `${workspaceRoot}/packages/web/src/views/pages/nested/CreatorPage.view.tsx`,
        errors: [{ messageId: "nestedViewPlacement" }],
      },
      {
        code: harmlessModule,
        filename: `${workspaceRoot}/packages/web/src/creator/CreatorPage.view.tsx`,
        errors: [{ messageId: "unknownViewLayer" }],
      },
      {
        code: harmlessModule,
        filename: `${workspaceRoot}/packages/web/src/controllers/creator/creator.controller.ts`,
        errors: [{ message: /controller file/ }],
      },
      {
        code: harmlessModule,
        filename: `${workspaceRoot}/packages/web/src/models/controls/nested/Page.model.ts`,
        errors: [{ message: /model file/ }],
      },
      {
        code: harmlessModule,
        filename: `${workspaceRoot}/packages/web/src/models/controls/Page.factory.ts`,
        errors: [{ message: /factory file/ }],
      },
      {
        code: 'export * from "./creator.controller.ts";',
        filename: `${workspaceRoot}/packages/web/src/controllers/index.ts`,
        errors: [{ messageId: "internalBarrel" }],
      },
    ],
  });

  tester.run("mvc-model-requires-factory", rules["mvc-model-requires-factory"], {
    valid: [
      { code: harmlessModule, filename: webModelPath("TextField") },
      { code: harmlessModule, filename: "/workspace/not-web-source.ts" },
    ],
    invalid: [
      {
        code: harmlessModule,
        filename: webModelPath("MissingFactoryStem999"),
        errors: [
          {
            messageId: "missingFactory",
            data: { factoryFilename: "controls/MissingFactoryStem999.factory.ts" },
          },
        ],
      },
    ],
  });

  tester.run("mvc-model-requires-view", rules["mvc-model-requires-view"], {
    valid: [
      { code: harmlessModule, filename: webModelPath("TextField") },
      { code: harmlessModule, filename: "/workspace/not-web-source.ts" },
    ],
    invalid: [
      {
        code: harmlessModule,
        filename: webModelPath("MissingViewStem999"),
        errors: [
          {
            messageId: "missingView",
            data: {
              importSource: "../../models/controls/MissingViewStem999.model.ts",
              layer: "controls",
            },
          },
        ],
      },
    ],
  });

  tester.run("mvc-view-requires-model-sibling", rules["mvc-view-requires-model-sibling"], {
    valid: [
      { code: harmlessModule, filename: webViewPath("TextField") },
      { code: harmlessModule, filename: "/workspace/not-web-source.ts" },
    ],
    invalid: [
      {
        code: harmlessModule,
        filename: webViewPath("MissingModelStem999"),
        errors: [
          {
            messageId: "missingModel",
            data: { modelFilename: "controls/MissingModelStem999.model.ts" },
          },
        ],
      },
    ],
  });

  tester.run(
    "mvc-factory-user-facing-strings-use-i18n",
    rules["mvc-factory-user-facing-strings-use-i18n"],
    {
      valid: [
        { code: harmlessModule, filename: "/workspace/not-web-source.ts" },
        {
          code: `const model = {
  _tag: "TextFieldModel",
  id: "title",
  label: webI18n._({ id: "creator.title.field.label" }),
  name: "title",
};`,
          filename: webFactoryPath("TextField"),
        },
      ],
      invalid: [
        {
          code: `const model = {
  documentTitle: "Create experience",
  label: \`Experience title\`,
};`,
          filename: webFactoryPath("TextField"),
          errors: [{ messageId: "hardcoded" }, { messageId: "hardcoded" }],
        },
      ],
    },
  );

  tester.run("mvc-model-no-boolean-state", rules["mvc-model-no-boolean-state"], {
    valid: [
      { code: harmlessModule, filename: "/workspace/not-web-source.ts" },
      {
        code: `import * as Schema from "effect/Schema";

const AlertHidden = Schema.TaggedStruct("AlertHidden", {});
const AlertVisible = Schema.TaggedStruct("AlertVisible", {
  message: Schema.String,
});

export const AlertModel = Schema.Union([AlertHidden, AlertVisible]);
export type AlertModel = typeof AlertModel.Type;`,
        filename: webModelPath("Alert"),
      },
      {
        code: `import * as Schema from "effect/Schema";

const CreatorChoiceOptionCorrectBadge = Schema.TaggedStruct(
  "CreatorChoiceOptionCorrectBadge",
  { label: Schema.String },
);

export const CreatorBlockEditorPageModel = Schema.TaggedStruct("CreatorBlockEditorPageModel", {
  correctBadge: Schema.optionalKey(CreatorChoiceOptionCorrectBadge),
});
export type CreatorBlockEditorPageModel = typeof CreatorBlockEditorPageModel.Type;`,
        filename: webModelPath("CreatorBlockEditorPage"),
      },
    ],
    invalid: [
      {
        code: `import * as Schema from "effect/Schema";

export const TextFieldModel = Schema.TaggedStruct("TextFieldModel", {
  id: Schema.String,
  required: Schema.Boolean,
});
export type TextFieldModel = typeof TextFieldModel.Type;`,
        filename: webModelPath("TextField"),
        errors: [{ messageId: "booleanField" }],
      },
    ],
  });

  tester.run("mvc-view-no-cardinality-decisions", rules["mvc-view-no-cardinality-decisions"], {
    valid: [
      { code: harmlessModule, filename: "/workspace/not-web-source.ts" },
      {
        code: `import type { View } from "../../mvc/view.ts";
import type { TextFieldModel } from "../../models/controls/TextField.model.ts";

const maxAttribute = (model: TextFieldModel): { readonly max?: number } =>
  model.max === undefined ? {} : { max: model.max };

export const TextFieldView: View<TextFieldModel> = (model) => (
  <input {...maxAttribute(model)} />
);`,
        filename: webViewPath("TextField"),
      },
      {
        code: `import type { View } from "../../mvc/view.ts";
import type { CreatorStepsPageModel } from "../../models/pages/CreatorStepsPage.model.ts";

export const CreatorStepsPageView: View<CreatorStepsPageModel> = (model) =>
  model._tag === "CreatorStepsPagePopulatedSteps" ? <ol /> : <p>{model.emptyMessage}</p>;`,
        filename: webViewPath("CreatorStepsPage", "pages"),
      },
    ],
    invalid: [
      {
        code: `import * as Arr from "effect/Array";
import type { View } from "../../mvc/view.ts";
import type { CreatorStepsPageModel } from "../../models/pages/CreatorStepsPage.model.ts";

export const CreatorStepsPageView: View<CreatorStepsPageModel> = (model) =>
  Arr.isReadonlyArrayEmpty(model.steps) ? <p>Empty</p> : <ol />;`,
        filename: webViewPath("CreatorStepsPage", "pages"),
        errors: [{ messageId: "cardinalityDecision" }],
      },
      {
        code: `import * as Arr from "effect/Array";
import type { View } from "../../mvc/view.ts";
import type { CreatorStepsPageModel } from "../../models/pages/CreatorStepsPage.model.ts";

export const CreatorStepsPageView: View<CreatorStepsPageModel> = (model) =>
  Arr.isReadonlyArrayNonEmpty(model.steps) ? <ol /> : <p>Empty</p>;`,
        filename: webViewPath("CreatorStepsPage", "pages"),
        errors: [{ messageId: "cardinalityDecision" }],
      },
      {
        code: `import type { View } from "../../mvc/view.ts";
import type { CreatorStepsPageModel } from "../../models/pages/CreatorStepsPage.model.ts";

export const CreatorStepsPageView: View<CreatorStepsPageModel> = (model) =>
  model.steps.length === 0 ? <p>Empty</p> : <ol />;`,
        filename: webViewPath("CreatorStepsPage", "pages"),
        errors: [{ messageId: "cardinalityDecision" }],
      },
      {
        code: `import type { View } from "../../mvc/view.ts";
import type { CreatorStepsPageModel } from "../../models/pages/CreatorStepsPage.model.ts";

export const CreatorStepsPageView: View<CreatorStepsPageModel> = (model) =>
  model.steps.length > 0 ? <ol /> : <p>Empty</p>;`,
        filename: webViewPath("CreatorStepsPage", "pages"),
        errors: [{ messageId: "cardinalityDecision" }],
      },
      {
        code: `import type { View } from "../../mvc/view.ts";
import type { CreatorStepsPageModel } from "../../models/pages/CreatorStepsPage.model.ts";

export const CreatorStepsPageView: View<CreatorStepsPageModel> = (model) =>
  !model.steps.length ? <p>Empty</p> : <ol />;`,
        filename: webViewPath("CreatorStepsPage", "pages"),
        errors: [{ messageId: "cardinalityDecision" }],
      },
    ],
  });
});
