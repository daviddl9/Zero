import { Outlet, useLocation } from 'react-router';
import { useEffect } from 'react';
import Footer from '@/components/home/footer';
import { Navigation } from '@/components/navigation';

// Route to title mapping
const routeTitles: Record<string, string> = {
  '/about': 'About - Zero',
  '/contributors': 'Contributors - Zero',
  '/pricing': 'Pricing - Zero',
  '/privacy': 'Privacy - Zero',
  '/terms': 'Terms - Zero',
  '/team': 'Team - Zero',
};

export default function FullWidthLayout() {
  const location = useLocation();

  useEffect(() => {
    // Handle dynamic blog post titles
    if (location.pathname.startsWith('/blog/') && location.pathname !== '/blog') {
      // For blog posts, we'll set a default and let the individual page override if needed
      document.title = 'Blog Post - Zero';
    } else {
      // Use mapped title or fallback to 'Zero'
      const title = routeTitles[location.pathname] || 'Zero';
      document.title = title;
    }
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen flex-col w-full bg-black">
      <Navigation />
      <div className="flex-1">
        <Outlet />
      </div>
      <Footer />
    </div>
  );
}
