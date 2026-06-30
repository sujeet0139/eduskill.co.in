import Link from "next/link";
import HeroBanner from "@/components/HeroBanner";

const COLLEGES = [
  { name: "Jankidevi College", district: "Darbhanga" },
  { name: "Marwari College", district: "Darbhanga" },
  { name: "Satya Narayan College", district: "Samastipur" },
  { name: "Jhumak Mahaseth College", district: "Madhubani" },
  { name: "Vishweshwar Singh College", district: "Darbhanga" },
  { name: "Kalidas Vidyapati College", district: "Darbhanga" },
  { name: "Chethru Mahto College", district: "Darbhanga" },
  { name: "Janta Koshi College", district: "Madhubani" },
];

const COURSES = [
  {
    icon: "💻",
    title: "Web Design & Development",
    desc: "Build real websites from scratch",
    weeks: "6 Weeks",
    price: "₹4,999",
    original: "₹7,999",
    color: "from-blue-900 to-blue-600",
    btn: "bg-blue-900",
    includes: ["24 video lessons", "8 PDF guides", "3 real projects", "HTML, CSS, JavaScript", "Certificate included"],
  },
  {
    icon: "📱",
    title: "Digital Marketing",
    desc: "Master online marketing skills",
    weeks: "6 Weeks",
    price: "₹3,999",
    original: "₹6,999",
    color: "from-purple-700 to-purple-500",
    btn: "bg-purple-700",
    includes: ["20 video lessons", "12 PDF guides", "5 live projects", "SEO, Social Media, Ads", "Certificate included"],
  },
  {
    icon: "🌾",
    title: "Agriculture & Agri-Business",
    desc: "Modern farming & rural business",
    weeks: "4 Weeks",
    price: "₹2,999",
    original: "₹5,999",
    color: "from-green-700 to-green-500",
    btn: "bg-green-700",
    includes: ["12 video lessons", "8 PDF guides", "2 field projects", "Govt. schemes guide", "Certificate included"],
  },
];

const TESTIMONIALS = [
  { name: "Raj Kumar Singh", college: "Marwari College, Darbhanga", initials: "RK", text: "EduSkill gave me my first real work experience. The 8-week program was practical and the certificate helped me in placement interviews." },
  { name: "Priya Sharma", college: "Jankidevi College, Darbhanga", initials: "PS", text: "The digital marketing course was excellent. Hindi + English content made it easy to follow. I now manage social media for a local business." },
  { name: "Amit Mishra", college: "Satya Narayan College, Samastipur", initials: "AM", text: "Affordable, practical, and truly designed for Bihar students. The certificate is recognized and the mentors were very helpful throughout." },
];

const FAQS = [
  { q: "Who can apply for the EduSkill internship program?", a: "Any student enrolled in an LNMU-affiliated college in Bihar is eligible. This includes all departments — CSE, Commerce, Science, Arts, and Agriculture." },
  { q: "What is the total fee and what does it include?", a: "The internship fee is ₹5,999 (one-time). This includes 8 weeks of training, mentor access, all study materials, project work, and your university-recognized certificate." },
  { q: "Is the certificate recognized by employers?", a: "Yes. The EduSkill certificate includes a QR code for digital verification and is accepted by employers across Bihar and India." },
  { q: "Can I study in Hindi?", a: "All video lessons, PDFs, and assignments are available in both Hindi and English. You can choose your preferred language at any time." },
  { q: "What happens after I complete the program?", a: "After completing 80% of the program and passing your assessment, you receive your digital certificate plus access to our alumni network and job referrals." },
];

export default function HomePage() {
  return (
    <div className="bg-white">

      {/* ADMIN-MANAGED BANNER (shows only if slides exist) */}
      <HeroBanner />

      {/* HERO */}
      <section className="bg-gradient-to-br from-blue-900 via-blue-800 to-blue-900 text-white py-20 px-4 text-center">
        <span className="inline-block bg-orange-500/20 border border-orange-400/40 text-orange-300 px-4 py-1 rounded-full text-xs font-semibold mb-5 tracking-wide">
          🎓 Affiliated with LNMU Bihar Universities
        </span>
        <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-4 max-w-3xl mx-auto">
          Build Your Career with <span className="text-orange-400">Real Internship Experience</span>
        </h1>
        <p className="text-blue-200 text-lg max-w-xl mx-auto mb-8 leading-relaxed">
          India's dedicated skill training & internship platform for Lalit Narayan Mithila University students. Get certified. Get hired.
        </p>
        <div className="flex flex-wrap gap-3 justify-center mb-12">
          <Link href="/register">
            <button className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-3 rounded-lg font-semibold text-base">
              Apply for Internship →
            </button>
          </Link>
          <Link href="/courses">
            <button className="bg-white/10 border border-white/30 text-white px-7 py-3 rounded-lg font-medium text-base hover:bg-white/20">
              Explore Courses
            </button>
          </Link>
        </div>
        <div className="flex flex-wrap gap-8 justify-center">
          {[["5,000+","Students Enrolled"],["8","LNMU Colleges"],["3","Skill Programs"],["95%","Satisfaction Rate"],["8 Wks","Program Duration"]].map(([num, lbl]) => (
            <div key={lbl} className="text-center">
              <div className="text-3xl font-bold">{num}</div>
              <div className="text-blue-300 text-xs mt-1">{lbl}</div>
            </div>
          ))}
        </div>
      </section>

      {/* TRUST BAR */}
      <div className="bg-blue-950 py-3 px-4 flex flex-wrap justify-center gap-6 text-xs text-blue-300">
        {["LNMU Affiliated Program","Industry Recognized Certificates","Hindi + English Learning","Mentor-Led Training","Razorpay Secure Payment"].map((t) => (
          <span key={t} className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-orange-500 rounded-full"></span>{t}
          </span>
        ))}
      </div>

      {/* ABOUT */}
      <section className="py-16 px-4 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div className="bg-blue-50 rounded-2xl p-10 text-center">
            <div className="text-7xl mb-4">🎓</div>
            <div className="text-xl font-bold text-blue-900 mb-2">EduSkill Portal</div>
            <div className="text-gray-500 text-sm mb-6">Empowering LNMU Students Since 2024</div>
            <div className="bg-white rounded-xl p-4 mb-3 text-left">
              <div className="text-xs text-gray-400">Program Fee</div>
              <div className="text-3xl font-bold text-orange-500">₹5,999</div>
              <div className="text-xs text-gray-500">One-time payment. Lifetime certificate.</div>
            </div>
            <div className="bg-white rounded-xl p-4 text-left">
              <div className="text-xs text-gray-400">Program Duration</div>
              <div className="text-3xl font-bold text-blue-900">8 Weeks</div>
              <div className="text-xs text-gray-500">Online + Offline sessions available</div>
            </div>
          </div>
          <div>
            <span className="inline-block bg-blue-50 text-blue-900 px-4 py-1 rounded-full text-xs font-semibold mb-3">About EduSkill</span>
            <h2 className="text-3xl font-bold text-gray-900 mb-4 leading-snug">
              Bridging the Gap Between Education & Employment
            </h2>
            <p className="text-gray-500 mb-3 leading-relaxed">
              EduSkill is Bihar's first dedicated internship and skill training portal built exclusively for students of Lalit Narayan Mithila University (LNMU) affiliated colleges.
            </p>
            <p className="text-gray-500 mb-5 leading-relaxed">
              We deliver structured internship programs and skill courses right to your college — affordable, practical, and career-focused.
            </p>
            {[
              ["LNMU Recognized","Program designed for LNMU-affiliated college curriculum and requirements."],
              ["Affordable Access","Premium internship experience at a fraction of private institute costs."],
              ["Bihar-First","Built for Bihar students with local language support and relevant programs."],
              ["Certified Output","Walk away with a university-recognized certificate employers trust."],
            ].map(([title, desc]) => (
              <div key={title} className="flex gap-3 mb-3">
                <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5">✓</div>
                <p className="text-sm text-gray-600"><strong className="text-gray-900">{title}</strong> — {desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WHY CHOOSE */}
      <section className="bg-blue-50 py-16 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <span className="inline-block bg-white text-blue-900 px-4 py-1 rounded-full text-xs font-semibold mb-3">Why EduSkill</span>
          <h2 className="text-3xl font-bold text-gray-900 mb-3">Everything a Bihar Student Needs</h2>
          <p className="text-gray-500 mb-10 max-w-md mx-auto">Affordable, practical, and career-focused — designed for LNMU students.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
            {[
              ["🏆","Industry Certificate","University-recognized certificate that holds real value with employers across India."],
              ["👨‍🏫","Expert Mentors","Learn from industry professionals with 5+ years of real-world experience."],
              ["📱","Learn Anywhere","100% online access. Study from your phone, laptop, or tablet at your own pace."],
              ["🗣️","Hindi + English","All content in both Hindi and English so language is never a barrier."],
              ["💼","Job Ready Skills","Practical projects and real assignments that prepare you for actual workplace demands."],
              ["🤝","College Network","Connect with students from 8 LNMU colleges and build your professional network."],
            ].map(([icon,title,desc]) => (
              <div key={title} className="bg-white border border-gray-200 rounded-xl p-6 hover:border-blue-400 hover:shadow-md transition text-left">
                <div className="text-3xl mb-3">{icon}</div>
                <h3 className="font-semibold text-gray-900 mb-2">{title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* INTERNSHIP DETAILS */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-6xl mx-auto text-center">
          <span className="inline-block bg-blue-50 text-blue-900 px-4 py-1 rounded-full text-xs font-semibold mb-3">Flagship Program</span>
          <h2 className="text-3xl font-bold text-gray-900 mb-3">8-Week Internship Program</h2>
          <p className="text-gray-500 max-w-md mx-auto mb-10">A structured, mentor-led internship program for LNMU students.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 text-left">
            <div>
              <div className="bg-white border border-gray-200 rounded-xl p-6 mb-4">
                <h3 className="text-lg font-bold text-blue-900 mb-4">Program Details</h3>
                {[["Duration","8 Weeks"],["Mode","Online + Offline"],["Eligibility","LNMU Students"],["Departments","All Departments"],["Language","Hindi + English"],["Mentorship","Industry Experts"],["Certificate","University Recognized"],["Program Fee","₹5,999"]].map(([l,v]) => (
                  <div key={l} className="flex justify-between py-3 border-b border-gray-100 last:border-0">
                    <span className="text-gray-500 text-sm">{l}</span>
                    <span className={`font-semibold text-sm ${l==="Program Fee"?"text-orange-500 text-lg":"text-blue-900"}`}>{v}</span>
                  </div>
                ))}
              </div>
              <div className="bg-white border border-gray-200 rounded-xl p-6">
                <h4 className="font-semibold mb-4">Week-by-Week Plan</h4>
                {[["Week 1-2","Orientation, Introduction & Foundation","blue"],["Week 3-4","Core Skill Training & Live Sessions","blue"],["Week 5-6","Project Work & Assignments","blue"],["Week 7-8","Assessment, Evaluation & Certificate","orange"]].map(([w,t,c]) => (
                  <div key={w} className="flex gap-3 items-center mb-3">
                    <span className={`text-xs font-semibold px-3 py-1 rounded-full ${c==="orange"?"bg-orange-100 text-orange-700":"bg-blue-100 text-blue-800"}`}>{w}</span>
                    <span className="text-sm text-gray-600">{t}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-4">
              <h3 className="text-lg font-bold text-gray-900">What You Gain</h3>
              {[
                ["📄","Industry Certificate","University-recognized certificate with QR code verification."],
                ["💡","Practical Skills","Work on real projects with tools used in actual workplaces."],
                ["🌐","Professional Network","Connect with mentors, peers, and industry professionals."],
                ["📈","Career Guidance","One-on-one career sessions to plan your next step."],
                ["📁","Portfolio Projects","2-3 portfolio-ready projects to show any employer."],
              ].map(([icon,title,desc]) => (
                <div key={title} className="bg-white border-l-4 border-orange-500 rounded-lg p-4 shadow-sm">
                  <h4 className="font-semibold text-sm mb-1">{icon} {title}</h4>
                  <p className="text-xs text-gray-500">{desc}</p>
                </div>
              ))}
              <Link href="/register">
                <button className="w-full bg-orange-500 hover:bg-orange-600 text-white py-4 rounded-xl font-bold text-base mt-2">
                  Apply Now — ₹5,999 →
                </button>
              </Link>
              <p className="text-xs text-gray-400 text-center">Secure payment via Razorpay. Limited seats per batch.</p>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="bg-blue-50 py-16 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <span className="inline-block bg-white text-blue-900 px-4 py-1 rounded-full text-xs font-semibold mb-3">Simple Process</span>
          <h2 className="text-3xl font-bold text-gray-900 mb-3">How It Works</h2>
          <p className="text-gray-500 mb-10 max-w-xs mx-auto">From registration to certificate in 4 simple steps.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
            {[
              ["1","Register Online","Fill your details online. Takes less than 2 minutes. Free to register.","bg-blue-900"],
              ["2","Complete Payment","Pay ₹5,999 securely via Razorpay. UPI, cards, net banking accepted.","bg-blue-900"],
              ["3","Start Training","Access videos, live sessions, assignments and mentor support for 8 weeks.","bg-blue-900"],
              ["4","Get Certificate","Complete the program and receive your university-recognized certificate.","bg-orange-500"],
            ].map(([num,title,desc,color]) => (
              <div key={num} className="text-center">
                <div className={`w-14 h-14 ${color} text-white rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4`}>{num}</div>
                <h3 className="font-semibold text-gray-900 mb-2">{title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* COURSES */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-6xl mx-auto text-center">
          <span className="inline-block bg-blue-50 text-blue-900 px-4 py-1 rounded-full text-xs font-semibold mb-3">Skill Programs</span>
          <h2 className="text-3xl font-bold text-gray-900 mb-3">Online Training Courses</h2>
          <p className="text-gray-500 mb-10 max-w-sm mx-auto">Learn in-demand skills at your own pace in Hindi and English.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            {COURSES.map((c) => (
              <div key={c.title} className="border border-gray-200 rounded-2xl overflow-hidden hover:shadow-lg transition hover:-translate-y-1">
                <div className={`bg-gradient-to-br ${c.color} text-white p-6`}>
                  <div className="text-4xl mb-3">{c.icon}</div>
                  <h3 className="text-xl font-bold mb-1">{c.title}</h3>
                  <p className="text-sm opacity-80">{c.desc}</p>
                </div>
                <div className="p-5">
                  <div className="flex gap-2 mb-4 flex-wrap">
                    <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-xs">{c.weeks}</span>
                    <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-xs">Beginner</span>
                    <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-xs">Hindi + English</span>
                  </div>
                  <div className="text-2xl font-bold text-blue-900 mb-4">
                    {c.price} <span className="text-sm text-gray-400 line-through font-normal">{c.original}</span>
                  </div>
                  <ul className="mb-5 space-y-1.5">
                    {c.includes.map((item) => (
                      <li key={item} className="text-sm text-gray-500 flex items-center gap-2">
                        <span className="text-green-500 font-bold text-xs">✓</span>{item}
                      </li>
                    ))}
                  </ul>
                  <Link href="/register">
                    <button className={`w-full ${c.btn} text-white py-3 rounded-lg font-semibold text-sm hover:opacity-90`}>
                      Enroll Now
                    </button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
          <div className="bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl p-6 text-white flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-left">
              <div className="text-lg font-bold mb-1">🎯 All 3 Courses Bundle</div>
              <div className="text-sm opacity-90">Save ₹1,998 — Get all three courses together</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold">₹9,999</div>
              <div className="text-xs opacity-70 line-through">₹11,997</div>
            </div>
            <Link href="/register">
              <button className="bg-white text-orange-600 px-8 py-3 rounded-lg font-bold text-sm hover:bg-gray-100">
                Get Bundle →
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* COLLEGES */}
      <section className="bg-gray-950 py-16 px-4 text-white text-center">
        <div className="max-w-6xl mx-auto">
          <span className="inline-block bg-orange-500/20 text-orange-300 px-4 py-1 rounded-full text-xs font-semibold mb-3">LNMU Affiliated</span>
          <h2 className="text-3xl font-bold mb-3">Eligible Colleges</h2>
          <p className="text-gray-400 mb-10 max-w-sm mx-auto">EduSkill is open to students from these 8 LNMU-affiliated colleges in Bihar.</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {COLLEGES.map((c) => (
              <div key={c.name} className="bg-white/5 border border-white/10 rounded-xl p-4 text-left">
                <div className="font-semibold text-white text-sm mb-1">{c.name}</div>
                <div className="text-gray-400 text-xs">{c.district}, Bihar</div>
              </div>
            ))}
          </div>
          <p className="mt-6 text-sm text-gray-500">
            Don't see your college?{" "}
            <Link href="/contact" className="text-orange-400 hover:underline">Contact us</Link> — we're expanding.
          </p>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-6xl mx-auto text-center">
          <span className="inline-block bg-blue-50 text-blue-900 px-4 py-1 rounded-full text-xs font-semibold mb-3">Student Stories</span>
          <h2 className="text-3xl font-bold text-gray-900 mb-3">What Students Say</h2>
          <p className="text-gray-500 mb-10">Real experiences from LNMU students who completed the program.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t) => (
              <div key={t.name} className="bg-white border border-gray-200 rounded-xl p-6 text-left hover:shadow-md transition">
                <div className="text-yellow-400 text-lg mb-3">★★★★★</div>
                <p className="text-gray-500 text-sm leading-relaxed italic mb-4">"{t.text}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-900 rounded-full flex items-center justify-center text-white text-sm font-bold">{t.initials}</div>
                  <div>
                    <div className="font-semibold text-sm text-gray-900">{t.name}</div>
                    <div className="text-xs text-gray-400">{t.college}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-blue-50 py-16 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <span className="inline-block bg-white text-blue-900 px-4 py-1 rounded-full text-xs font-semibold mb-3">FAQs</span>
          <h2 className="text-3xl font-bold text-gray-900 mb-3">Common Questions</h2>
          <p className="text-gray-500 mb-10">Everything you need to know before enrolling.</p>
          <div className="text-left space-y-3">
            {FAQS.map((f) => (
              <div key={f.q} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="p-4 font-semibold text-gray-900 text-sm">{f.q}</div>
                <div className="px-4 pb-4 text-sm text-gray-500 leading-relaxed border-t border-gray-100 pt-3">{f.a}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gradient-to-r from-orange-500 to-red-500 py-16 px-4 text-white text-center">
        <h2 className="text-4xl font-bold mb-3">Ready to Start Your Career Journey?</h2>
        <p className="text-lg opacity-90 max-w-md mx-auto mb-8">
          Join 5,000+ LNMU students already building real skills and getting certified with EduSkill.
        </p>
        <div className="flex flex-wrap gap-4 justify-center">
          <Link href="/register">
            <button className="bg-white text-orange-600 px-8 py-3 rounded-lg font-bold text-base hover:bg-gray-100">
              Register for Internship →
            </button>
          </Link>
          <Link href="/contact">
            <button className="border-2 border-white/60 text-white px-7 py-3 rounded-lg font-medium hover:bg-white/10">
              Talk to Us
            </button>
          </Link>
        </div>
        <p className="mt-5 text-sm opacity-70">No hidden fees. Secure payment. Cancel anytime before batch starts.</p>
      </section>

    </div>
  );
}
