import type { MetadataRoute } from "next";

function baseUrl() {
  return process.env.BASE_URL ?? "http://localhost:3000";
}

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Áreas privadas ou sem valor de indexação: admin, conta, checkout e
      // toda a API não devem aparecer em busca.
      disallow: ["/admin", "/conta", "/checkout", "/personalizar", "/api/"],
    },
    sitemap: `${baseUrl()}/sitemap.xml`,
  };
}
