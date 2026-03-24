import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://doc2share.vn";

    return {
        rules: {
            userAgent: "*",
            allow: ["/", "/cua-hang", "/tu-sach"],
            disallow: ["/admin/", "/api/", "/checkout/"],
        },
        sitemap: `${baseUrl}/sitemap.xml`,
    };
}
