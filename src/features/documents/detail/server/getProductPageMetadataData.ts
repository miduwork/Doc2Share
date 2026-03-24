import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";

export async function getProductPageMetadataData({ id, slug }: { id: string; slug: string }): Promise<Metadata> {
  const supabase = await createClient();

  const { data: doc } = await supabase
    .from("documents")
    .select("title, description, preview_text, price, preview_url, thumbnail_url")
    .eq("id", id)
    .single();

  if (!doc) return { title: "Tài liệu" };

  const description = doc.description || doc.preview_text || undefined;
  const desc160 = description?.slice(0, 160) ?? "";
  const base = process.env.NEXT_PUBLIC_APP_URL || "https://doc2share.vn";

  return {
    title: `${doc.title} | Doc2Share`,
    description: desc160,
    alternates: { canonical: `${base}/cua-hang/${id}/${slug}` },
    openGraph: {
      title: doc.title,
      description: desc160,
      type: "website",
      images: (doc as { thumbnail_url?: string | null }).thumbnail_url
        ? [{ url: (doc as { thumbnail_url: string }).thumbnail_url }]
        : (doc as { preview_url?: string | null }).preview_url
          ? [{ url: (doc as { preview_url: string }).preview_url }]
          : undefined,
    },
    other: {
      "product:price:amount": String(doc.price),
      "product:price:currency": "VND",
    },
  };
}

