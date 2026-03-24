import type {
    DocumentPublishGate,
    DocumentRetryContext,
    DocumentsAdminRepository,
    UpdateDocumentAdminInput,
} from "../../ports";

export type MockDocumentsAdminState = {
    publishGate?: DocumentPublishGate | null;
    retryContext?: DocumentRetryContext | null;
    calls: {
        update: UpdateDocumentAdminInput[];
        delete: { documentId: string; hardDelete: boolean }[];
        queueJob: { documentId: string; uploadSessionId: string | null }[];
        submitApproval: { documentId: string; actorId: string; note?: string | null }[];
        approve: { documentId: string; actorId: string; note?: string | null }[];
        reject: { documentId: string; actorId: string; note: string }[];
    };
};

export function createMockDocumentsAdminRepository(input?: {
    overrides?: Partial<DocumentsAdminRepository>;
    seed?: Partial<MockDocumentsAdminState>;
}) {
    const state: MockDocumentsAdminState = {
        publishGate: input?.seed?.publishGate ?? null,
        retryContext: input?.seed?.retryContext ?? null,
        calls: input?.seed?.calls ?? {
            update: [],
            delete: [],
            queueJob: [],
            submitApproval: [],
            approve: [],
            reject: [],
        },
    };

    const repository: DocumentsAdminRepository = {
        async updateDocumentAdmin(input) {
            state.calls.update.push(input);
            return { updated: true };
        },
        async deleteDocumentAdmin(input) {
            state.calls.delete.push(input);
            return { deleted: true };
        },
        async getDocumentPublishGate() {
            return state.publishGate ?? null;
        },
        async getDocumentRetryContext() {
            return state.retryContext ?? null;
        },
        async queueDocumentPostprocessJob(input) {
            state.calls.queueJob.push(input);
        },
        async submitDocumentForApprovalAdmin(input) {
            state.calls.submitApproval.push(input);
            return { submitted: true };
        },
        async approveDocumentPublishAdmin(input) {
            state.calls.approve.push(input);
            return { approved: true };
        },
        async rejectDocumentPublishAdmin(input) {
            state.calls.reject.push(input);
            return { rejected: true };
        },
        ...(input?.overrides ?? {}),
    };

    return { repository, state };
}
