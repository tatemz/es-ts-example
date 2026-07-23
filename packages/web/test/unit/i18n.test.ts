import { expect, test } from "bun:test";
import * as I18n from "../../src/i18n/I18n.ts";
import { webI18n } from "../../src/i18n/messages.ts";

test("the i18n runtime resolves ids against its message table", () => {
  const local = I18n.make({ messages: { greeting: "Hello" } });
  expect({
    known: webI18n._({ id: "counter.heading" }),
    createSubmit: webI18n._({ id: "counter.create.submit" }),
    local: local._({ id: "greeting" }),
  }).toEqual({
    known: "Counters",
    createSubmit: "Create counter",
    local: "Hello",
  });
});
