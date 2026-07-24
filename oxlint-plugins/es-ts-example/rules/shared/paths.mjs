import { getBasename, normalizeFilename } from "./filename.mjs";

export const packageProductionPath = (filename) =>
  /\/packages\/[^/]+\/(?:src|bin)\//.test(filename) &&
  !/\/packages\/test-support\/src\//.test(filename);

export const packageSourcePath = (filename) =>
  /\/packages\/[^/]+\/src\//.test(filename) && !/\/packages\/test-support\/src\//.test(filename);

export const webSourcePath = (filename) =>
  /\/packages\/web\/src\//.test(normalizeFilename(filename));

export const webSrcRoot = "/packages/web/src";

/**
 * Every renderable lane is split the same way. `pages` own application data and
 * may reach for services; `controls` are reusable and must not. The directory
 * is the contract, so no filename prefix is needed to tell them apart.
 */
export const webMvcLayers = ["pages", "controls"];

export const webMvcLayerPattern = "(?:pages|controls)";

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

export const webMvcSliceLane = (role) =>
  role === "controllers" ? `${webSrcRoot}/controllers` : `${webSrcRoot}/${role}/<layer>`;

export const webMvcInternalBarrelPath = (filename) =>
  new RegExp(
    `\\/packages\\/web\\/src\\/(?:models|factories|controllers|views)(?:\\/${webMvcLayerPattern})?\\/index\\.ts$`,
  ).test(normalizeFilename(filename));

/** `pages` or `controls` for a renderable file, `undefined` for anything else. */
export const webMvcLayer = (filename) =>
  normalizeFilename(filename).match(
    /\/packages\/web\/src\/(?:models|factories|views)\/(pages|controls)\//,
  )?.[1];

export const webMvcSliceInLane = (filename) => {
  const normalized = normalizeFilename(filename);
  const role = webMvcSliceRole(filename);
  if (role === undefined) {
    return false;
  }

  if (role === "controllers") {
    return /\/packages\/web\/src\/controllers\/[^/]+$/.test(normalized);
  }

  return new RegExp(`\\/packages\\/web\\/src\\/${role}\\/${webMvcLayerPattern}\\/[^/]+$`).test(
    normalized,
  );
};

export const webMvcSourcePath = (filename) =>
  webSourcePath(filename) && webMvcSliceRole(filename) !== undefined;

export const webViewPath = (filename) =>
  new RegExp(`\\/packages\\/web\\/src\\/views\\/${webMvcLayerPattern}\\/[^/]+\\.view\\.tsx$`).test(
    normalizeFilename(filename),
  );

export const webUnlayeredViewPath = (filename) =>
  /\/packages\/web\/src\/views\/[^/]+\.view\.tsx$/.test(normalizeFilename(filename));

export const webNestedViewPath = (filename) =>
  /\/packages\/web\/src\/views\/[^/]+\/.+\/[^/]+\.view\.tsx$/.test(normalizeFilename(filename));

/** A reusable control: model, factory, or view under a `controls` lane. */
export const webControlSlicePath = (filename) =>
  /\/packages\/web\/src\/(?:models|factories|views)\/controls\/[^/]+\.(?:model\.ts|factory\.ts|view\.tsx)$/.test(
    normalizeFilename(filename),
  );

/** The renderable halves of a control: its model and its view. */
export const webControlRenderablePath = (filename) =>
  /\/packages\/web\/src\/(?:models|views)\/controls\/[^/]+\.(?:model\.ts|view\.tsx)$/.test(
    normalizeFilename(filename),
  );

export const webMvcUiArchitecturePath = (filename) => {
  const role = webMvcSliceRole(filename);
  return webMvcSourcePath(filename) && role !== "controllers" && !webControlSlicePath(filename);
};

export const webSrcRootFromFilename = (filename) =>
  normalizeFilename(filename).replace(/\/packages\/web\/src\/.*$/, webSrcRoot);

export const modelPathForStem = (webRoot, layer, stem) =>
  `${webRoot}/models/${layer}/${stem}.model.ts`;

export const factoryPathForStem = (webRoot, layer, stem) =>
  `${webRoot}/factories/${layer}/${stem}.factory.ts`;

export const viewPathForStem = (webRoot, layer, stem) =>
  `${webRoot}/views/${layer}/${stem}.view.tsx`;

export const modelImportSourceForStem = (layer, stem) => `../../models/${layer}/${stem}.model.ts`;

export const testPath = (filename) => /\/(?:packages\/[^/]+\/test|test)\//.test(filename);

export const domainCorePath = (filename) =>
  /\/packages\/(?:domain|application|event-sourcing)\/src\//.test(filename);
