"use client";
import { useState } from "react";
import Link from "next/link";

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">

        {/* Logo */}
        <Link href="/">
          <span className="text-2xl font-bold text-blue-900">
            Edu<span className="text-orange-500">Skill</span>
            <span className="text-gray-400 text-sm font-normal">.co.in</span>
          </span>
        </Link>

        {/* Desktop Links */}
        <div className="hidden md:flex items-center gap-6 text-sm text-gray-600">
          <Link href="/" className="hover:text-blue-900">Home</Link>
          <Link href="/about" className="hover:text-blue-900">About</Link>
          <Link href="/internship" className="hover:text-blue-900">Internship</Link>
          <Link href="/courses" className="hover:text-blue-900">Courses</Link>
          <Link href="/contact" className="hover:text-blue-900">Contact</Link>
        </div>

        {/* Buttons */}
        <div className="hidden md:flex items-center gap-3">
          <Link href="/login">
            <button className="border-2 border-blue-900 text-blue-900 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-50">
              Login
            </button>
          </Link>
          <Link href="/register">
            <button className="bg-orange-500 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-orange-600">
              Register Free
            </button>
          </Link>
        </div>

        {/* Mobile Menu Toggle */}
        <button
          className="md:hidden text-gray-600 text-2xl"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          {menuOpen ? "✕" : "☰"}
        </button>
      </div>

      {/* Mobile Menu */}
      {menuOpen && (
        <div className="md:hidden bg-white border-t border-gray-100 px-4 py-4 flex flex-col gap-4 text-sm text-gray-700">
          <Link href="/" onClick={() => setMenuOpen(false)}>Home</Link>
          <Link href="/about" onClick={() => setMenuOpen(false)}>About</Link>
          <Link href="/internship" onClick={() => setMenuOpen(false)}>Internship</Link>
          <Link href="/courses" onClick={() => setMenuOpen(false)}>Courses</Link>
          <Link href="/contact" onClick={() => setMenuOpen(false)}>Contact</Link>
          <div className="flex gap-3 pt-2">
            <Link href="/login" className="flex-1">
              <button className="w-full border-2 border-blue-900 text-blue-900 py-2 rounded-lg text-sm font-semibold">Login</button>
            </Link>
            <Link href="/register" className="flex-1">
              <button className="w-full bg-orange-500 text-white py-2 rounded-lg text-sm font-semibold">Register</button>
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}