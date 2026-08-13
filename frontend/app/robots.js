export default function robots() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://eduskill.co.in";
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/admin/", "/dashboard/"] },
      { userAgent: "OAI-SearchBot", allow: "/" },
      { userAgent: "GPTBot", allow: "/" },
      { userAgent: "ClaudeBot", allow: "/" },
      { userAgent: "PerplexityBot", allow: "/" },
      { userAgent: "Google-Extended", allow: "/" },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
