import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-gray-950 text-gray-400">
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 pb-10 border-b border-gray-800">

          {/* Brand */}
          <div className="md:col-span-1">
            <div className="text-2xl font-bold text-white mb-3">
              Edu<span className="text-orange-500">Skill</span>
              <span className="text-gray-500 text-sm font-normal">.co.in</span>
            </div>
            <p className="text-sm leading-relaxed mb-4">
              Bihar's dedicated internship and skill training portal for
              LNMU-affiliated college students.
            </p>
            <div className="flex flex-col gap-2 text-sm">
              <span>📧 info@eduskill.co.in</span>
              <span>📍 Bihar, India</span>
              <span>🕐 Mon–Sat, 9 AM – 6 PM</span>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-white font-semibold mb-4">Quick Links</h4>
            <div className="flex flex-col gap-2 text-sm">
              <Link href="/" className="hover:text-white">Home</Link>
              <Link href="/about" className="hover:text-white">About Us</Link>
              <Link href="/internship" className="hover:text-white">Internship</Link>
              <Link href="/courses" className="hover:text-white">Courses</Link>
              <Link href="/contact" className="hover:text-white">Contact</Link>
            </div>
          </div>

          {/* Programs */}
          <div>
            <h4 className="text-white font-semibold mb-4">Programs</h4>
            <div className="flex flex-col gap-2 text-sm">
              <Link href="/internship" className="hover:text-white">8-Week Internship</Link>
              <Link href="/courses" className="hover:text-white">Web Design</Link>
              <Link href="/courses" className="hover:text-white">Digital Marketing</Link>
              <Link href="/courses" className="hover:text-white">Agriculture</Link>
              <Link href="/courses" className="hover:text-white">All 3 Bundle</Link>
            </div>
          </div>

          {/* Support */}
          <div>
            <h4 className="text-white font-semibold mb-4">Support</h4>
            <div className="flex flex-col gap-2 text-sm">
              <Link href="/login" className="hover:text-white">Student Login</Link>
              <Link href="/register" className="hover:text-white">Register</Link>
              <Link href="/verify" className="hover:text-white">Check Certificate</Link>
              <Link href="/privacy" className="hover:text-white">Privacy Policy</Link>
              <Link href="/refund" className="hover:text-white">Refund Policy</Link>
            </div>
          </div>
        </div>

        {/* Bottom */}
        <div className="flex flex-col md:flex-row justify-between items-center pt-6 text-xs gap-3">
          <span>© 2025 EduSkill.co.in — All rights reserved.</span>
          <span className="text-gray-600">LNMU Affiliated | Bihar, India</span>
        </div>
      </div>
    </footer>
  );
}