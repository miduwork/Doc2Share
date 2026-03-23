import "server-only";

export type DocumentPipelineTickResult = {
  claimed: number;
  completed: number;
  failed: number;
};

export interface DocumentPipelineRepository {
  runTick(_limit: number): Promise<DocumentPipelineTickResult>;
}
