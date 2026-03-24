export type PDFDocumentProxy = {
  getPage: (
    _n: number
  ) => Promise<{
    getViewport: (_opts: { scale: number }) => { width: number; height: number };
    render: (_ctx: unknown) => { promise: Promise<void>; cancel: () => void };
    // pdfjs cũng có thêm field khác, nhưng ta chỉ cần phần này để render.
  }>;
  numPages: number;
};

