import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-white">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <div>
            <Link href="/" className="text-xl font-extrabold text-white">
              eduskill<span className="text-gray-400">.co.in</span>
            </Link>
            <p className="mt-1 text-xs text-gray-400">
              Empowering LNMU Students Since 2024.
            </p>
          </div>
          <div className="flex gap-4 text-sm font-medium text-gray-300">
            <Link href="/about" className="hover:text-white">About</Link>
            <Link href="/contact" className="hover:text-white">Contact</Link>
            <Link href="/privacy" className="hover:text-white">Privacy Policy</Link>
          </div>
        </div>
        <div className="mt-8 border-t border-gray-800 pt-4 text-center text-xs text-gray-500">
          © {new Date().getFullYear()} EduSkill. All rights reserved.
        </div>
      </div>
    </footer>
  );
}