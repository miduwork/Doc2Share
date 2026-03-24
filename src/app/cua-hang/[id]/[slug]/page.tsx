import PublicLayout from "@/features/layout/components/PublicLayout";
import ProductPageClient from "@/features/documents/detail/components/ProductPageClient";
import DocumentCard from "@/features/documents/list/components/DocumentCard";
import type { Metadata } from "next";
import { getProductPageMetadataData } from "@/features/documents/detail/server/getProductPageMetadataData";
import { getProductPageData } from "@/features/documents/detail/server/getProductPageData";
interface Props {
  params: Promise<{ id: string; slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id, slug } = await params;
  return getProductPageMetadataData({ id, slug });
}

export default async function DocumentProductPage({ params }: Props) {
  const { id } = await params;
  const { docForClient, categories, reviewsList, commentsList, schema, relatedDocs } = await getProductPageData({ id });

  return (
    <PublicLayout>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
      <ProductPageClient
        doc={docForClient}
        reviews={reviewsList}
        comments={commentsList}
        />
        {relatedDocs.length > 0 && (
          <section className="reveal-section reveal-delay-1 section-container pb-12">
            <div className="mb-5 flex items-end justify-between gap-3">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-semantic-heading">Tài liệu liên quan</h2>
                <p className="mt-1 text-sm text-muted">Gợi ý thêm để ôn tập đúng trọng tâm.</p>
              </div>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {relatedDocs.map((item) => (
                <DocumentCard key={item.id} doc={item} categories={categories ?? []} variant="compact" />
              ))}
            </div>
          </section>
        )}
    </PublicLayout>
  );
}
