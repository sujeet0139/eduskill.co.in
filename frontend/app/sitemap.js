export default function sitemap() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://eduskill.co.in";
  const updated = new Date();
  return ["", "/courses", "/materials", "/contact", "/register", "/tools"].map((path) => ({
    url: `${siteUrl}${path}`, lastModified: updated,
    changeFrequency: path === "" ? "weekly" : "monthly", priority: path === "" ? 1 : 0.7,
  }));
}
