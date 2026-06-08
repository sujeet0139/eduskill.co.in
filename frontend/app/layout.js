import "./globals.css";

export const metadata = {
  title: "eduskill.co.in — Skill Development & Certification",
  description:
    "Register, learn and get certified with eduskill.co.in. Courses, study materials and programs for students across Bihar.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
