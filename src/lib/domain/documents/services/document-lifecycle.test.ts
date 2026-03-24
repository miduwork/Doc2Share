import { test } from "node:test";
import { strict as assert } from "node:assert";
import { validateDocumentForPublish } from "./document-lifecycle.ts";

test("validateDocumentForPublish returns success when all criteria met", () => {
    const result = validateDocumentForPublish({
        id: "doc-1",
        title: "Document Title",
        file_path: "path/to/file.pdf",
        thumbnail_url: "https://example.com/thumb.jpg",
        status: "processing",
        approval_status: "approved",
    });

    assert.deepEqual(result, { ok: true });
});

test("validateDocumentForPublish fails on missing fields", () => {
    const cases = [
        {
            doc: { id: "1", title: null, file_path: "p", thumbnail_url: "t", status: "s", approval_status: "approved" },
            expectedError: "Không thể publish. Thiếu: title.",
        },
        {
            doc: { id: "1", title: "T", file_path: null, thumbnail_url: "t", status: "s", approval_status: "approved" },
            expectedError: "Không thể publish. Thiếu: file_path.",
        },
        {
            doc: { id: "1", title: "T", file_path: "p", thumbnail_url: null, status: "s", approval_status: "approved" },
            expectedError: "Không thể publish. Thiếu: thumbnail_url.",
        },
        {
            doc: { id: "1", title: null, file_path: null, thumbnail_url: null, status: "s", approval_status: "approved" },
            expectedError: "Không thể publish. Thiếu: title, file_path, thumbnail_url.",
        },
    ];

    for (const c of cases) {
        const result = validateDocumentForPublish(c.doc);
        assert.deepEqual(result, { ok: false, error: c.expectedError });
    }
});

test("validateDocumentForPublish fails if not approved", () => {
    const result = validateDocumentForPublish({
        id: "doc-1",
        title: "Title",
        file_path: "p",
        thumbnail_url: "t",
        status: "ready",
        approval_status: "pending",
    });

    assert.deepEqual(result, { ok: false, error: "Không thể publish. Tài liệu chưa được duyệt (approval_status=approved)." });
});
