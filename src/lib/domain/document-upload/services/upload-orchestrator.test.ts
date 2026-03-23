import { test } from "node:test";
import { strict as assert } from "node:assert";

import { createMockDocumentUploadRepository, createMockUploadPayload } from "../adapters/mock/document-upload.repository.ts";
import { runDocumentUploadOrchestrator } from "./upload-orchestrator.ts";

test("upload orchestrator handles ambiguous finalize with fallback and queue", async () => {
  const mock = createMockDocumentUploadRepository({
    seed: {
      sessionId: "session-ambiguous-1",
      finalizeResult: {
        ok: false,
        error: "column reference \"document_id\" is ambiguous",
        isAmbiguousFinalize: true,
      },
      fallbackDocumentId: "doc-fallback-1",
    },
  });

  const result = await runDocumentUploadOrchestrator({
    repository: mock.repository,
    userId: "user-1",
    payload: createMockUploadPayload(),
  });

  assert.equal(result.ok, true);
  assert.equal(mock.state.calls.fallback.length, 1);
  assert.deepEqual(mock.state.calls.queue, [{ documentId: "doc-fallback-1", sessionId: "session-ambiguous-1" }]);
  assert.deepEqual(mock.state.calls.finalizedSessions, ["session-ambiguous-1"]);
  assert.equal(mock.state.calls.removed.length, 0);
  assert.equal(mock.state.calls.failedSessions.length, 0);
  assert.equal(mock.state.calls.failedDocuments.length, 0);
});

test("upload orchestrator rolls back uploaded files when createUploadSession fails", async () => {
  const mock = createMockDocumentUploadRepository({
    overrides: {
      async createUploadSession() {
        throw new Error("Upload session: forced test error");
      },
    },
  });

  const result = await runDocumentUploadOrchestrator({
    repository: mock.repository,
    userId: "user-rollback-1",
    payload: createMockUploadPayload(),
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.error, /Upload session: forced test error/);
  }
  assert.equal(mock.state.calls.removed.length, 3);
  assert.equal(mock.state.calls.queue.length, 0);
  assert.equal(mock.state.calls.finalizedSessions.length, 0);
  assert.equal(mock.state.calls.failedSessions.length, 0);
  assert.equal(mock.state.calls.failedDocuments.length, 0);
});

test("upload orchestrator does not remove files after fallback row exists", async () => {
  const mock = createMockDocumentUploadRepository({
    seed: {
      sessionId: "session-ambiguous-2",
      finalizeResult: {
        ok: false,
        error: "column reference \"document_id\" is ambiguous",
        isAmbiguousFinalize: true,
      },
      fallbackDocumentId: "doc-fallback-2",
    },
    overrides: {
      async enqueuePostprocessJob() {
        throw new Error("forced queue failure");
      },
    },
  });

  const result = await runDocumentUploadOrchestrator({
    repository: mock.repository,
    userId: "user-no-rollback-1",
    payload: createMockUploadPayload(),
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.error, /forced queue failure/);
  }
  assert.equal(mock.state.calls.fallback.length, 1);
  assert.equal(mock.state.calls.removed.length, 0);
  assert.equal(mock.state.calls.finalizedSessions.length, 0);
  assert.deepEqual(mock.state.calls.failedDocuments, [{ documentId: "doc-fallback-2" }]);
  assert.deepEqual(mock.state.calls.failedSessions, [
    { sessionId: "session-ambiguous-2", errorMessage: "needs_repair: forced queue failure" },
  ]);
});
