import { Inter } from "next/font/google";
import "./globals.css";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://eduskill.co.in"),
  alternates: { canonical: "/" },
  keywords: ["LNMU internship", "Bihar skill training", "online courses", "student certificate", "EduSkill"],
  openGraph: {
    type: "website", locale: "en_IN", url: "/", siteName: "EduSkill.co.in",
    title: "EduSkill.co.in — Internship & Skill Training for LNMU Students",
    description: "Internship and skill training for LNMU-affiliated college students in Bihar.",
  },
  twitter: { card: "summary", title: "EduSkill.co.in — Internship & Skill Training", description: "Practical skill training and internship programs for LNMU students." },
  robots: { index: true, follow: true },
  title: "EduSkill.co.in — Internship & Skill Training for LNMU Students",
  description:
    "Bihar's dedicated internship and skill training portal for LNMU affiliated college students. Register, learn and get certified.",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "EduSkill" },
};

export const viewport = {
  themeColor: "#1e3a8a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }) {
  const organizationSchema = {
    "@context": "https://schema.org", "@type": "EducationalOrganization", name: "EduSkill.co.in",
    url: process.env.NEXT_PUBLIC_SITE_URL || "https://eduskill.co.in",
    description: "Internship and skill training platform for LNMU affiliated college students in Bihar, India.",
    areaServed: { "@type": "State", name: "Bihar, India" },
  };
  return (
    <html lang="en">
      <head><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }} /></head>
      <body className={inter.className}>
        <SiteHeader />
        <main>{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
