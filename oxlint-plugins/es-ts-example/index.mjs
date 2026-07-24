import {
  deterministicControlFlow,
  deterministicControlFlowRuleName,
} from "./rules/deterministic-control-flow/rule.mjs";
import { effectFirstCode, effectFirstCodeRuleName } from "./rules/effect-first-code/rule.mjs";
import {
  effectTryPromiseRequiresCatch,
  effectTryPromiseRequiresCatchRuleName,
} from "./rules/effect-trypromise-requires-catch/rule.mjs";
import { effectBoundaries, effectBoundariesRuleName } from "./rules/effect-boundaries/rule.mjs";
import {
  importRuntimeBoundaries,
  importRuntimeBoundariesRuleName,
} from "./rules/import-runtime-boundaries/rule.mjs";
import {
  mvcControllerNoModelFactories,
  mvcControllerNoModelFactoriesRuleName,
} from "./rules/mvc-controller-no-model-factories/rule.mjs";
import { mvcFilePlacement, mvcFilePlacementRuleName } from "./rules/mvc-file-placement/rule.mjs";
import {
  mvcOneExportPerRoleFile,
  mvcOneExportPerRoleFileRuleName,
} from "./rules/mvc-one-export-per-role-file/rule.mjs";
import {
  mvcFactoryUserFacingStringsUseI18n,
  mvcFactoryUserFacingStringsUseI18nRuleName,
} from "./rules/mvc-factory-user-facing-strings-use-i18n/rule.mjs";
import {
  mvcClassesStayInViews,
  mvcClassesStayInViewsRuleName,
} from "./rules/mvc-classes-stay-in-views/rule.mjs";
import {
  mvcModelNoBooleanState,
  mvcModelNoBooleanStateRuleName,
} from "./rules/mvc-model-no-boolean-state/rule.mjs";
import {
  mvcModelRequiresFactory,
  mvcModelRequiresFactoryRuleName,
} from "./rules/mvc-model-requires-factory/rule.mjs";
import {
  mvcModelRequiresView,
  mvcModelRequiresViewRuleName,
} from "./rules/mvc-model-requires-view/rule.mjs";
import {
  mvcRenderableVariantsUseTags,
  mvcRenderableVariantsUseTagsRuleName,
} from "./rules/mvc-renderable-variants-use-tags/rule.mjs";
import { mvcUiArchitecture, mvcUiArchitectureRuleName } from "./rules/mvc-ui-architecture/rule.mjs";
import {
  mvcViewNoCardinalityDecisions,
  mvcViewNoCardinalityDecisionsRuleName,
} from "./rules/mvc-view-no-cardinality-decisions/rule.mjs";
import {
  mvcViewPrefersModelParameter,
  mvcViewPrefersModelParameterRuleName,
} from "./rules/mvc-view-prefers-model-parameter/rule.mjs";
import {
  mvcViewRequiresModelSibling,
  mvcViewRequiresModelSiblingRuleName,
} from "./rules/mvc-view-requires-model-sibling/rule.mjs";
import {
  noFallibleModuleScopeMake,
  noFallibleModuleScopeMakeRuleName,
} from "./rules/no-fallible-module-scope-make/rule.mjs";
import {
  noLowercaseEffectOrder,
  noLowercaseEffectOrderRuleName,
} from "./rules/no-lowercase-effect-order/rule.mjs";
import {
  noNativeStandardLibrary,
  noNativeStandardLibraryRuleName,
} from "./rules/no-native-standard-library/rule.mjs";
import {
  noOptionReturningFilterMap,
  noOptionReturningFilterMapRuleName,
} from "./rules/no-option-returning-filter-map/rule.mjs";
import {
  publicEntrypointPolicy,
  publicEntrypointPolicyRuleName,
} from "./rules/public-entrypoint-policy/rule.mjs";
import {
  renderedDomContract,
  renderedDomContractRuleName,
} from "./rules/rendered-dom-contract/rule.mjs";
import { strongTypes, strongTypesRuleName } from "./rules/strong-types/rule.mjs";
import {
  testAssertionBoundaries,
  testAssertionBoundariesRuleName,
} from "./rules/test-assertion-boundaries/rule.mjs";
import {
  testAssertionQuality,
  testAssertionQualityRuleName,
} from "./rules/test-assertion-quality/rule.mjs";
import { testDiscipline, testDisciplineRuleName } from "./rules/test-discipline/rule.mjs";
import {
  testFixtureBoundaries,
  testFixtureBoundariesRuleName,
} from "./rules/test-fixture-boundaries/rule.mjs";
import {
  viewFilenamingConvention,
  viewFilenamingConventionRuleName,
} from "./rules/view-filenaming-convention/rule.mjs";
import {
  webUiComponentContracts,
  webUiComponentContractsRuleName,
} from "./rules/web-ui-component-contracts/rule.mjs";
import {
  webViewModelStrings,
  webViewModelStringsRuleName,
} from "./rules/web-view-model-strings/rule.mjs";

export const rules = {
  [deterministicControlFlowRuleName]: deterministicControlFlow,
  [effectBoundariesRuleName]: effectBoundaries,
  [effectFirstCodeRuleName]: effectFirstCode,
  [effectTryPromiseRequiresCatchRuleName]: effectTryPromiseRequiresCatch,
  [importRuntimeBoundariesRuleName]: importRuntimeBoundaries,
  [mvcClassesStayInViewsRuleName]: mvcClassesStayInViews,
  [mvcControllerNoModelFactoriesRuleName]: mvcControllerNoModelFactories,
  [mvcFactoryUserFacingStringsUseI18nRuleName]: mvcFactoryUserFacingStringsUseI18n,
  [mvcFilePlacementRuleName]: mvcFilePlacement,
  [mvcOneExportPerRoleFileRuleName]: mvcOneExportPerRoleFile,
  [mvcModelNoBooleanStateRuleName]: mvcModelNoBooleanState,
  [mvcModelRequiresFactoryRuleName]: mvcModelRequiresFactory,
  [mvcModelRequiresViewRuleName]: mvcModelRequiresView,
  [mvcRenderableVariantsUseTagsRuleName]: mvcRenderableVariantsUseTags,
  [mvcUiArchitectureRuleName]: mvcUiArchitecture,
  [mvcViewNoCardinalityDecisionsRuleName]: mvcViewNoCardinalityDecisions,
  [mvcViewPrefersModelParameterRuleName]: mvcViewPrefersModelParameter,
  [mvcViewRequiresModelSiblingRuleName]: mvcViewRequiresModelSibling,
  [noFallibleModuleScopeMakeRuleName]: noFallibleModuleScopeMake,
  [noLowercaseEffectOrderRuleName]: noLowercaseEffectOrder,
  [noNativeStandardLibraryRuleName]: noNativeStandardLibrary,
  [noOptionReturningFilterMapRuleName]: noOptionReturningFilterMap,
  [publicEntrypointPolicyRuleName]: publicEntrypointPolicy,
  [renderedDomContractRuleName]: renderedDomContract,
  [strongTypesRuleName]: strongTypes,
  [testAssertionBoundariesRuleName]: testAssertionBoundaries,
  [testAssertionQualityRuleName]: testAssertionQuality,
  [testDisciplineRuleName]: testDiscipline,
  [testFixtureBoundariesRuleName]: testFixtureBoundaries,
  [viewFilenamingConventionRuleName]: viewFilenamingConvention,
  [webUiComponentContractsRuleName]: webUiComponentContracts,
  [webViewModelStringsRuleName]: webViewModelStrings,
};

export default {
  meta: { name: "es-ts-example" },
  rules,
};
