import * as Arr from "effect/Array";
import * as Fn from "effect/Function";
import { isRealFilename, isWebSourcePath } from "../shared/filename.mjs";
import { controllerRole } from "./controller.mjs";
import { factoryRole } from "./factory.mjs";
import { modelRole } from "./model.mjs";
import { viewRole } from "./view.mjs";

export const mvcOneExportPerRoleFileRuleName = "mvc-one-export-per-role-file";

/**
 * Every web MVC file owns exactly one thing, and its name says which: a model
 * owns a schema, a factory owns that schema's constructor, a view owns the
 * renderer for it, and a controller owns one request handler. The role modules
 * below differ only in what "one thing" means for their role.
 */
const roles = [modelRole, factoryRole, viewRole, controllerRole];

const messages = Fn.pipe(
  roles,
  Arr.reduce({}, (merged, role) => ({ ...merged, ...role.messages })),
);

const roleFor = (filename) =>
  Fn.pipe(
    roles,
    Arr.findFirst((role) => role.matches(filename)),
  );

export const mvcOneExportPerRoleFile = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Require each web MVC model, factory, view, and controller file to own exactly one export named after the file.",
    },
    messages,
    schema: [],
  },
  create(context) {
    const filename = context.filename ?? context.getFilename();

    if (!isRealFilename(filename) || !isWebSourcePath(filename)) {
      return {};
    }

    const role = roleFor(filename);
    if (role._tag === "None") {
      return {};
    }

    return {
      Program(node) {
        role.value.check(context, node, filename);
      },
    };
  },
};
