/** @type {import('next').NextConfig} */

// Backend origin used for server-side rewrites. On the single-VPS setup the API
// runs behind api.eduskill.co.in (or localhost during dev). Uploaded files are
// served by the Express backend at /uploads, but links may point at the frontend
// origin (eduskill.co.in/uploads/...), so we transparently proxy them across.
const API_ORIGIN = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3600").replace(/\/$/, "");

const nextConfig = {
  async rewrites() {
    return [
      {
        source: "/uploads/:path*",
        destination: `${API_ORIGIN}/uploads/:path*`,
      },
    ];
  },
  images: {
    // Allow next/image to load from the API origin and Cloudinary.
    remotePatterns: [
      { protocol: "https", hostname: "**.eduskill.co.in" },
      { protocol: "https", hostname: "res.cloudinary.com" },
    ],
  },
};

export default nextConfig;
