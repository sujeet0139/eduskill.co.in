'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function Navbar() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Check for auth token in localStorage on the client side
    const token = localStorage.getItem('token');
    if (token) {
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    setIsAuthenticated(false);
    // Redirect to home page to apply the logged-out state
    window.location.href = '/';
  };

  return (
    <nav className="bg-white shadow-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex-shrink-0">
            <Link href="/" className="text-2xl font-bold text-blue-900">
              EduSkill
            </Link>
          </div>
          <div className="hidden md:block">
            <div className="ml-10 flex items-baseline space-x-4">
              <Link href="/" className="text-gray-700 hover:bg-gray-100 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">
                Home
              </Link>
              <Link href="/register" className="text-gray-700 hover:bg-gray-100 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">
                Register
              </Link>
              {isAuthenticated ? (
                <>
                  <Link href="/dashboard" className="text-gray-700 hover:bg-gray-100 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">
                    My Dashboard
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="bg-orange-500 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-orange-600"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <Link href="/login" className="bg-blue-900 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-800">
                  Student Login
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}