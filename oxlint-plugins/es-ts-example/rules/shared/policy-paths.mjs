import { normalizeFilename } from "./filename.mjs";

const relativeMarkers = ["/packages/", "/scripts/", "/test/"];

export const relativeFilename = (filename) => {
  const normalized = normalizeFilename(filename);
  if (/^(?:packages|scripts|test)\//.test(normalized)) {
    return normalized;
  }
  for (const marker of relativeMarkers) {
    const index = normalized.indexOf(marker);
    if (index >= 0) {
      return normalized.slice(index + 1);
    }
  }
  return normalized.replace(/^\/+/, "");
};

export const pathMatchesPolicyEntry = (filename, entry) => {
  return filename === entry || filename.endsWith(`/${entry}`);
};

export const pathAllowedByPolicy = (filename, { paths = [], patterns = [] }) => {
  const relative = relativeFilename(filename);
  return (
    paths.some((entry) => pathMatchesPolicyEntry(relative, entry)) ||
    patterns.some((pattern) => pattern.test(relative))
  );
};
