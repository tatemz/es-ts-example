import { expect, test } from "bun:test";
import { Fragment, html, htmlDocument, joinHtml, jsx, renderHtml } from "../../src/mvc/html.ts";

test("renderHtml unwraps Html values and passes raw strings through", () => {
  expect({
    fromHtml: renderHtml(html("<b>hi</b>")),
    fromString: renderHtml("plain"),
  }).toEqual({
    fromHtml: "<b>hi</b>",
    fromString: "plain",
  });
});

test("htmlDocument prefixes the doctype", () => {
  expect(renderHtml(htmlDocument(html("<html></html>")))).toBe("<!doctype html><html></html>");
});

test("joinHtml concatenates fragments in order", () => {
  expect(renderHtml(joinHtml([html("a"), html("b"), html("c")]))).toBe("abc");
});

test("jsx renders a string tag with attributes and escaped text children", () => {
  expect(renderHtml(jsx("p", { className: "lead", id: "x" }, "a & b < c > \"d\" 'e'"))).toBe(
    '<p class="lead" id="x">a &amp; b &lt; c &gt; &quot;d&quot; &#39;e&#39;</p>',
  );
});

test("jsx renders boolean, absent, numeric, and array children while dropping empty attributes", () => {
  expect(
    renderHtml(
      jsx(
        "div",
        { checked: true, hidden: false, missing: null, note: undefined, children: "ignored" },
        [1, 2],
        null,
        false,
        undefined,
        "tail",
      ),
    ),
  ).toBe("<div checked>12tail</div>");
});

test("jsx renders a string tag with no props", () => {
  expect(renderHtml(jsx("br", null))).toBe("<br></br>");
});

test("jsx invokes function components with merged children", () => {
  const Card = (props: { readonly children?: unknown } | null) =>
    html(`<section>${renderHtml(props?.children as ReturnType<typeof html>)}</section>`);
  expect(renderHtml(jsx(Card, null, "body"))).toBe("<section>body</section>");
});

test("Fragment renders rest children and falls back to props.children", () => {
  expect({
    rest: renderHtml(Fragment(null, "a", "b")),
    propsChildren: renderHtml(Fragment({ children: "solo" })),
    empty: renderHtml(Fragment(undefined)),
  }).toEqual({
    rest: "ab",
    propsChildren: "solo",
    empty: "",
  });
});
