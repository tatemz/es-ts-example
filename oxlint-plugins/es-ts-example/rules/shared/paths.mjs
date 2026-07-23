import { getBasename, normalizeFilename } from "./filename.mjs";

export const packageProductionPath = (filename) =>
  /\/packages\/[^/]+\/(?:src|bin)\//.test(filename) &&
  !/\/packages\/test-support\/src\//.test(filename);

export const packageSourcePath = (filename) =>
  /\/packages\/[^/]+\/src\//.test(filename) && !/\/packages\/test-support\/src\//.test(filename);

export const webSourcePath = (filename) =>
  /\/packages\/web\/src\//.test(normalizeFilename(filename));

export const webSrcRoot = "/packages/web/src";

export const webViewThemes = ["wayfinder"];

export const webViewThemePattern = "(?:wayfinder)";

const webMvcSliceRoleFromBasename = (basename) => {
  if (basename === "model.ts" || /^.+\.model\.ts$/.test(basename)) {
    return "models";
  }
  if (basename === "factory.ts" || /^.+\.factory\.ts$/.test(basename)) {
    return "factories";
  }
  if (/^.+\.view\.tsx$/.test(basename)) {
    return "views";
  }
  if (/^.+\.controller\.ts$/.test(basename)) {
    return "controllers";
  }
  return undefined;
};

export const webMvcSliceRole = (filename) =>
  webMvcSliceRoleFromBasename(getBasename(normalizeFilename(filename)));

export const webMvcSliceLane = (role) => `${webSrcRoot}/${role}`;

export const webMvcInternalBarrelPath = (filename) =>
  new RegExp(
    `\\/packages\\/web\\/src\\/(?:models|factories|controllers|views(?:\\/${webViewThemePattern})?)\\/index\\.ts$`,
  ).test(normalizeFilename(filename));

export const webMvcSliceInLane = (filename) => {
  const normalized = normalizeFilename(filename);
  const role = webMvcSliceRole(filename);
  if (role === undefined) {
    return false;
  }

  if (role === "views") {
    return webViewPath(filename);
  }

  const lane = webMvcSliceLane(role);
  return new RegExp(`${lane.replace(/\//g, "\\/")}/[^/]+$`).test(normalized);
};

export const webMvcSourcePath = (filename) =>
  webSourcePath(filename) && webMvcSliceRole(filename) !== undefined;

export const webViewPath = (filename) =>
  new RegExp(`\\/packages\\/web\\/src\\/views\\/${webViewThemePattern}\\/[^/]+\\.view\\.tsx$`).test(
    normalizeFilename(filename),
  );

export const webDirectViewPath = (filename) =>
  /\/packages\/web\/src\/views\/[^/]+\.view\.tsx$/.test(normalizeFilename(filename));

export const webUnknownThemeViewPath = (filename) => {
  const normalized = normalizeFilename(filename);
  if (!/\/packages\/web\/src\/views\/[^/]+\/[^/]+\.view\.tsx$/.test(normalized)) {
    return false;
  }

  return !webViewPath(filename);
};

export const webNestedThemeViewPath = (filename) =>
  /\/packages\/web\/src\/views\/[^/]+\/.+\/[^/]+\.view\.tsx$/.test(normalizeFilename(filename));

export const webEsTsExampleSlicePath = (filename) =>
  new RegExp(
    `\\/packages\\/web\\/src\\/(?:models|factories|views\\/${webViewThemePattern})\\/EsTsExample[^/]+\\.(?:model\\.ts|factory\\.ts|view\\.tsx)$`,
  ).test(normalizeFilename(filename));

export const webEsTsExampleRenderablePath = (filename) =>
  new RegExp(
    `\\/packages\\/web\\/src\\/(?:models|views\\/${webViewThemePattern})\\/EsTsExample[^/]+\\.(?:model\\.ts|view\\.tsx)$`,
  ).test(normalizeFilename(filename));

export const webMvcUiArchitecturePath = (filename) => {
  const role = webMvcSliceRole(filename);
  return webMvcSourcePath(filename) && role !== "controllers" && !webEsTsExampleSlicePath(filename);
};

export const webSrcRootFromFilename = (filename) =>
  normalizeFilename(filename).replace(/\/packages\/web\/src\/.*$/, webSrcRoot);

export const modelPathForStem = (webRoot, stem) => `${webRoot}/models/${stem}.model.ts`;

export const factoryPathForStem = (webRoot, stem) => `${webRoot}/factories/${stem}.factory.ts`;

export const modelImportSourceForStem = (stem) => `../models/${stem}.model.ts`;

export const testPath = (filename) => /\/(?:packages\/[^/]+\/test|test)\//.test(filename);

export const domainCorePath = (filename) =>
  /\/packages\/(?:domain|application|event-sourcing)\/src\//.test(filename);
