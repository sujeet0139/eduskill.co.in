import { Inter } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer"; // Corrected component name casing
import TopTicker from "@/components/TopTicker";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
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
  return (
    <html lang="en">
      <body className={inter.className}>
        <TopTicker />
        <Navbar />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
