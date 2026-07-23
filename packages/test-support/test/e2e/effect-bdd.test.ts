import { expect, test } from "bun:test";
import { Bdd } from "effect-bdd";

test("Effect BDD exposes the public runner surface", () => {
  const scenario = Bdd.scenario("Public API scenario");
  const feature = Bdd.feature("Public API feature").pipe(scenario);

  expect({
    capture: typeof Bdd.capture,
    docString: typeof Bdd.docString,
    feature: typeof Bdd.feature,
    gherkinCompiler: typeof Bdd.GherkinCompiler,
    given: typeof Bdd.given,
    layerCucumber: typeof Bdd.layerCucumber,
    run: typeof Bdd.run,
    scenario: typeof Bdd.scenario,
    stepTimeoutGuard: typeof Bdd.isStepTimeoutError,
    step: typeof Bdd.step,
    table: typeof Bdd.table,
    thenStep: typeof Bdd.then,
    when: typeof Bdd.when,
    withTimeout: typeof Bdd.withTimeout,
    featureTitle: feature.title,
    scenarioTitle: scenario.title,
  }).toEqual({
    capture: "function",
    docString: "function",
    feature: "function",
    featureTitle: "Public API feature",
    gherkinCompiler: "function",
    given: "function",
    layerCucumber: "object",
    run: "function",
    scenario: "function",
    scenarioTitle: "Public API scenario",
    step: "function",
    stepTimeoutGuard: "function",
    table: "function",
    thenStep: "function",
    when: "function",
    withTimeout: "function",
  });
});
