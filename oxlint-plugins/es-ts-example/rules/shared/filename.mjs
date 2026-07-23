import * as Arr from "effect/Array";
import * as Fn from "effect/Function";
import * as Option from "effect/Option";
import * as Str from "effect/String";

export const normalizeFilename = (filename) => Fn.pipe(filename, Str.replace(/\\/g, "/"));

export const isRealFilename = (filename) =>
  typeof filename === "string" && !Fn.pipe(filename, Str.startsWith("<"));

export const getBasename = (filename) => {
  const normalized = normalizeFilename(filename);
  return Fn.pipe(
    normalized,
    Str.split("/"),
    Arr.last,
    Option.getOrElse(() => normalized),
  );
};

export const getDirname = (filename) => {
  const normalized = normalizeFilename(filename);
  const dirname = Fn.pipe(normalized, Str.replace(/\/[^/]*$/, ""));
  return dirname === normalized ? "." : dirname;
};

export const isWebSourcePath = (filename) =>
  /\/packages\/web\/src\//.test(normalizeFilename(filename));

export const workspaceRootFromFilename = (filename) =>
  Fn.pipe(normalizeFilename(filename), Str.replace(/\/packages\/web\/.*$/, ""));
