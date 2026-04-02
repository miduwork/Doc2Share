import { test } from "node:test";
import { strict as assert } from "node:assert";

const baseUrl = process.env.SECURE_PDF_TEST_BASE_URL;
const cookie = process.env.SECURE_PDF_TEST_COOKIE;
const documentId = process.env.SECURE_PDF_TEST_DOCUMENT_ID;
const deviceId = process.env.SECURE_PDF_TEST_DEVICE_ID;

const canRun = Boolean(baseUrl && cookie && documentId && deviceId);

test("secure-document-image requires valid secure_pdf_request_id (correlation check)", { skip: !canRun }, async () => {
    // 1. Request without secure_pdf_request_id -> should fail with 403
    const resNoId = await fetch(`${baseUrl}/api/secure-document-image`, {
        method: "POST",
        headers: {
            "content-type": "application/json",
            cookie: cookie!,
        },
        body: JSON.stringify({
            document_id: documentId,
            device_id: deviceId,
            page: 1,
        }),
    });

    assert.equal(resNoId.status, 403, "Must fail with 403 when secure_pdf_request_id is missing");
    const bodyNoId = await resNoId.json();
    assert.equal(bodyNoId.code, "SECURE_PDF_REQUEST_ID_REQUIRED");

    // 2. Request with invalid secure_pdf_request_id -> should fail with 403
    const resInvalidId = await fetch(`${baseUrl}/api/secure-document-image`, {
        method: "POST",
        headers: {
            "content-type": "application/json",
            cookie: cookie!,
        },
        body: JSON.stringify({
            document_id: documentId,
            device_id: deviceId,
            page: 1,
            secure_pdf_request_id: "invalid-uuid-or-missing-log",
        }),
    });

    assert.equal(resInvalidId.status, 403, "Must fail with 403 when secure_pdf_request_id is invalid");
    const bodyInvalidId = await resInvalidId.json();
    assert.equal(bodyInvalidId.code, "SECURE_PDF_REQUEST_ID_INVALID");

    // 3. (Optional Happy Path) First call secure-pdf, then use its request ID
    const resPdf = await fetch(`${baseUrl}/api/secure-pdf`, {
        method: "POST",
        headers: {
            "content-type": "application/json",
            cookie: cookie!,
        },
        body: JSON.stringify({
            document_id: documentId,
            device_id: deviceId,
        }),
    });

    assert.equal(resPdf.status, 403, "secure-pdf returns 403 to force SSW");
    const requestId = resPdf.headers.get("x-d2s-request-id");
    assert.ok(requestId, "Must return x-d2s-request-id");

    const resValid = await fetch(`${baseUrl}/api/secure-document-image`, {
        method: "POST",
        headers: {
            "content-type": "application/json",
            cookie: cookie!,
        },
        body: JSON.stringify({
            document_id: documentId,
            device_id: deviceId,
            page: 1,
            secure_pdf_request_id: requestId,
        }),
    });

    assert.equal(resValid.status, 200, "Should succeed with valid correlation ID from previous secure-pdf success");
    assert.equal(resValid.headers.get("content-type"), "image/png");
});
