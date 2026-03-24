import { test } from "node:test";
import { strict as assert } from "node:assert";

import { buildDocumentsListHref } from "./documents-list-url.ts";

test("omits sort when sort is newest", () => {
  const href = buildDocumentsListHref("/cua-hang", { sort: "newest" });
  assert.equal(href, "/cua-hang");
});

test("keeps sort when sort is not newest", () => {
  const href = buildDocumentsListHref("/cua-hang", { sort: "price_asc" });
  assert.equal(href, "/cua-hang?sort=price_asc");
});

test("omits page when page is 1", () => {
  const href = buildDocumentsListHref("/cua-hang", { page: "1" });
  assert.equal(href, "/cua-hang");
});

test("keeps page when page is greater than 1", () => {
  const href = buildDocumentsListHref("/cua-hang", { page: 3 });
  assert.equal(href, "/cua-hang?page=3");
});

test("keeps grade subject exam together", () => {
  const href = buildDocumentsListHref("/cua-hang", {
    grade: "1",
    subject: "2",
    exam: "3",
  });
  assert.equal(href, "/cua-hang?grade=1&subject=2&exam=3");
});

test("keeps keyword query parameter", () => {
  const href = buildDocumentsListHref("/cua-hang", { q: "toan 12" });
  assert.equal(href, "/cua-hang?q=toan+12");
});

test("keeps quick preview variant query parameter", () => {
  const href = buildDocumentsListHref("/cua-hang", { qp_variant: "B" });
  assert.equal(href, "/cua-hang?qp_variant=B");
});

test("overrides sort and page with normalized rules", () => {
  const href = buildDocumentsListHref(
    "/cua-hang",
    { grade: "1", q: "hsg", sort: "price_desc", page: 4 },
    { sort: "newest", page: 1 }
  );
  assert.equal(href, "/cua-hang?grade=1&q=hsg");
});
