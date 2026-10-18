import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/siteUrl";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/kabinet", "/moi-remonty", "/moi-znyzhky", "/vhid", "/admin", "/api/"],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
