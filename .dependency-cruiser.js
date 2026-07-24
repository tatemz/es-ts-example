/** @type {import("dependency-cruiser").IConfiguration} */
const config = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      comment: "Import cycles hide layering inversions; break the cycle instead of widening it.",
      from: {},
      to: { circular: true },
    },
    {
      name: "src-does-not-import-test",
      severity: "error",
      comment: "Production code never reaches into test trees; shared helpers live in src.",
      from: { path: "^packages/[^/]+/(?:src|bin)/" },
      to: { path: "^packages/[^/]+/test/" },
    },
    {
      name: "not-to-dev-dep",
      severity: "error",
      comment:
        "Production code must not depend on devDependencies; promote the package or drop the import.",
      from: { path: "^packages/[^/]+/(?:src|bin)/" },
      to: { dependencyTypes: ["npm-dev"], dependencyTypesNot: ["type-only"] },
    },
    {
      name: "no-dynamic-imports-in-src",
      severity: "error",
      comment:
        "Dynamic imports bypass static boundary lints; production wiring stays statically analyzable.",
      from: { path: "^packages/[^/]+/(?:src|bin)/" },
      to: { dependencyTypes: ["dynamic-import"] },
    },
    {
      name: "mvc-models-do-not-import-views",
      severity: "error",
      comment: "Models carry data for views; a model importing a view inverts the MVC direction.",
      from: { path: "^packages/web/src/.+\\.model\\.ts$" },
      to: { path: "\\.view\\.tsx$" },
    },
    {
      name: "mvc-models-are-render-schema-only",
      severity: "error",
      comment:
        "Model definitions are render schemas only; factories and controllers translate application data into them.",
      from: { path: "^packages/web/src/.+\\.model\\.ts$" },
      to: {
        path: "^packages/(?:application|domain|event-sourcing)/|\\.factory\\.ts$|\\.controller\\.ts$|^packages/web/src/(?:server|routes|rpcClients)\\.ts$",
      },
    },
    {
      name: "mvc-views-import-models-type-only",
      severity: "error",
      comment:
        "Views consume model shapes only; schema values and constructors stay behind factories.",
      from: { path: "^packages/web/src/.+\\.view\\.tsx$" },
      to: { path: "\\.model\\.ts$", dependencyTypesNot: ["type-only"] },
    },
    {
      name: "mvc-views-do-not-import-factories-or-controllers",
      severity: "error",
      comment: "Views render shaped models; factories and controllers run before rendering.",
      from: { path: "^packages/web/src/.+\\.view\\.tsx$" },
      to: { path: "\\.(?:factory|controller)\\.ts$" },
    },
    {
      name: "mvc-views-import-render-surface-only",
      severity: "error",
      comment:
        "Views import only models, other views, ui primitives, and the mvc runtime; logic lives behind the model.",
      from: { path: "^packages/web/src/.+\\.view\\.tsx$" },
      to: {
        path: "^packages/web/src/",
        pathNot: [
          "\\.model\\.ts$",
          "\\.view\\.tsx$",
          "^packages/web/src/views/htmlHelpers\\.ts$",
          "^packages/web/src/mvc/",
        ],
      },
    },
    {
      name: "mvc-factories-do-not-import-render-or-io",
      severity: "error",
      comment:
        "Model factories are pure render-model transformations; views, controllers, server code, RPC, storage, and effect orchestration stay outside.",
      from: { path: "^packages/web/src/.+\\.factory\\.ts$" },
      to: {
        path: "\\.view\\.tsx$|\\.controller\\.ts$|^packages/web/src/(?:server|rpcClients)\\.ts$|(?:^|/)(?:effect/(?:Effect|Layer|Stream|Runtime|Scope|Fiber|Queue|Deferred|Schedule)(?:\\.|/|$)|@effect/platform)",
      },
    },
    {
      name: "mvc-controllers-do-not-import-views",
      severity: "error",
      comment: "Controllers return render models; server/render boundaries call views.",
      from: { path: "^packages/web/src/.+\\.controller\\.ts$" },
      to: { path: "\\.view\\.tsx$" },
    },
    {
      name: "mvc-routes-do-not-import-views",
      severity: "error",
      comment: "Route modules bind URLs to controllers; rendering stays behind server boundaries.",
      from: { path: "^packages/web/src/.+\\.routes\\.ts$" },
      to: { path: "\\.view\\.tsx$" },
    },
    {
      name: "web-controls-do-not-import-pages",
      severity: "error",
      comment:
        "Controls are reusable and feature-agnostic; page-specific needs flow in through their models.",
      from: {
        path: "^packages/web/src/(?:models|factories|views)/controls/",
      },
      to: { path: "^packages/web/src/(?:(?:models|factories|views)/pages/|controllers/)" },
    },
    {
      name: "web-does-not-import-domain-or-event-sourcing",
      severity: "error",
      comment: "Web code must depend on application ports, not domain or event-sourcing internals.",
      from: { path: "^packages/web/(?:src|bin)/" },
      to: { path: "^packages/(?:domain|event-sourcing)/" },
    },
    {
      name: "web-production-does-not-import-test-support",
      severity: "error",
      comment: "Test support stays in tests; web production code should use runtime adapters.",
      from: { path: "^packages/web/(?:src|bin)/" },
      to: { path: "^packages/test-support/" },
    },
    {
      name: "cli-depends-on-application-ports-only",
      severity: "error",
      comment:
        "The CLI view consumes application ports; it must not reach domain, event-sourcing, or web internals.",
      from: { path: "^packages/cli/(?:src|bin)/" },
      to: { path: "^packages/(?:domain|event-sourcing|web)/" },
    },
    {
      name: "application-production-only-depends-on-domain-and-event-sourcing",
      severity: "error",
      comment:
        "Application orchestration may use domain and event-sourcing, but not web or fixtures.",
      from: { path: "^packages/application/src/" },
      to: { path: "^packages/(?:web|cli|test-support)/" },
    },
    {
      name: "domain-production-only-depends-on-event-sourcing",
      severity: "error",
      comment: "Domain must remain pure and below application/web/test-support.",
      from: { path: "^packages/domain/src/" },
      to: { path: "^packages/(?:application|web|cli|test-support)/" },
    },
    {
      name: "event-sourcing-production-is-domain-agnostic",
      severity: "error",
      comment: "Event-sourcing primitives must not depend on product packages.",
      from: { path: "^packages/event-sourcing/src/" },
      to: { path: "^packages/(?:application|domain|web|cli|test-support)/" },
    },
    {
      name: "test-support-production-does-not-depend-on-product-packages",
      severity: "error",
      comment: "Test-support helpers must stay reusable across packages.",
      from: { path: "^packages/test-support/src/" },
      to: { path: "^packages/(?:application|domain|event-sourcing|cli|web)/" },
    },
    {
      name: "unit-tests-do-not-import-other-package-tests",
      severity: "error",
      comment:
        "Unit tests own fixtures locally or through test-support, never another package test tree.",
      from: { path: "^packages/([^/]+)/test/unit/" },
      to: { path: "^packages/(?!$1/)[^/]+/test/" },
    },
    {
      name: "web-unit-tests-do-not-import-domain-or-event-sourcing",
      severity: "error",
      comment: "Web unit tests exercise web/application contracts, not lower-layer internals.",
      from: { path: "^packages/web/test/unit/" },
      to: { path: "^packages/(?:domain|event-sourcing)/" },
    },
    {
      name: "bdd-support-does-not-import-steps",
      severity: "error",
      comment: "BDD support can be used by steps; importing steps from support inverts ownership.",
      from: { path: "^packages/[^/]+/test/e2e/support/" },
      to: { path: "(?:^|/)steps/" },
    },
    {
      name: "domain-stays-pure",
      severity: "error",
      comment:
        "Domain decisions are pure functions of state + command; no effectful runtime modules, platform code, or node builtins.",
      from: { path: "^packages/domain/src/" },
      to: {
        path: "(?:^|/)(?:effect/(?:Effect|Layer|Stream|Clock|Random|Ref|Runtime|Scope|Fiber|FiberRef|Queue|Deferred|Schedule)(?:\\.|/|$)|effect/unstable/|@effect/platform)",
      },
    },
    {
      name: "domain-does-not-use-node-builtins",
      severity: "error",
      comment: "Replayable decisions cannot reach the host platform.",
      from: { path: "^packages/domain/src/" },
      to: { dependencyTypes: ["core"] },
    },
    {
      name: "events-are-leaf-contracts",
      severity: "error",
      comment:
        "Events are the stored contract; they import schemas, identifiers, and value objects only — never mutable aggregate-state modules.",
      from: { path: "^packages/domain/src/counter/Events\\.ts$" },
      to: {
        path: "^packages/domain/src/",
        pathNot: ["^packages/domain/src/counter/(?:Identifiers|Values)\\.ts$"],
      },
    },
    {
      name: "commands-do-not-import-read-side",
      severity: "error",
      comment:
        "The write side decides from aggregate state alone; read DTOs and queries never feed decisions.",
      from: { path: "^packages/application/src/[^/]+/commands/" },
      to: { path: "^packages/application/src/[^/]+/(?:readModels\\.ts$|queries/)" },
    },
    {
      name: "queries-do-not-import-commands",
      severity: "error",
      comment:
        "The read side shares context infrastructure (repository.ts), never command modules.",
      from: { path: "^packages/application/src/[^/]+/queries/" },
      to: { path: "^packages/application/src/[^/]+/commands/" },
    },
    {
      name: "no-deep-application-imports",
      severity: "error",
      from: { pathNot: "^packages/application/" },
      to: { path: "^packages/application/src/(?!index\\.ts$)" },
    },
    {
      name: "no-deep-domain-imports",
      severity: "error",
      from: { pathNot: "^packages/domain/" },
      to: { path: "^packages/domain/src/(?!index\\.ts$)" },
    },
    {
      name: "no-deep-event-sourcing-imports",
      severity: "error",
      from: { pathNot: "^packages/event-sourcing/" },
      to: {
        path: "^packages/event-sourcing/src/(?!(?:index|aggregate|decision|event-store|projection|projection-store|repository)\\.ts$)",
      },
    },
    {
      name: "no-deep-test-support-imports",
      severity: "error",
      from: { pathNot: "^packages/test-support/" },
      to: {
        path: "^packages/test-support/src/(?!(?:BddAssertions|Decision|PropertyTest|TestEffect|run-effect-main)\\.ts$)",
      },
    },
    {
      name: "no-deep-web-imports",
      severity: "error",
      from: { pathNot: "^packages/web/" },
      to: { path: "^packages/web/src/(?!(?:index|mvc/jsx-runtime|mvc/jsx-dev-runtime)\\.ts$)" },
    },
  ],

  options: {
    combinedDependencies: true,
    doNotFollow: {
      path: "node_modules",
    },
    exclude: {
      path: "(^|/)(?:coverage|dist|node_modules|public|reports|\\.stryker-tmp)(/|$)",
    },
    tsConfig: {
      fileName: "tsconfig.json",
    },
    tsPreCompilationDeps: true,
  },
};

export default config;
