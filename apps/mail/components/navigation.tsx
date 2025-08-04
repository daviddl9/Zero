import NavigationMenu from '@/components/ui/navigation-menu';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { GitHub, Twitter, Discord, LinkedIn, Star } from './icons/icons';
import { AnimatedNumber } from '@/components/ui/animated-number';
import { signIn, useSession } from '@/lib/auth-client';
import { Separator } from '@/components/ui/separator';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';
import { Menu } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const resources = [
  {
    title: 'GitHub',
    href: 'https://github.com/Mail-0/Zero',
    description: 'Check out our open-source projects and contributions.',
    platform: 'github' as const,
  },
  {
    title: 'Twitter',
    href: 'https://x.com/mail0dotcom',
    description: 'Follow us for the latest updates and announcements.',
    platform: 'twitter' as const,
  },
  {
    title: 'LinkedIn',
    href: 'https://www.linkedin.com/company/mail0/',
    description: 'Connect with us professionally and stay updated.',
    platform: 'linkedin' as const,
  },
  {
    title: 'Discord',
    href: 'https://discord.gg/mail0',
    description: 'Join our community and chat with the team.',
    platform: 'discord' as const,
  },
];

const aboutLinks = [
  {
    title: 'About',
    href: '/about',
    description: 'Learn more about Zero and our mission.',
  },
  {
    title: 'Privacy',
    href: '/privacy',
    description: 'Read our privacy policy and data handling practices.',
  },
  {
    title: 'Terms of Service',
    href: '/terms',
    description: 'Review our terms of service and usage guidelines.',
  },
  {
    title: 'Contributors',
    href: '/contributors',
    description: 'See the contributors to Zero.',
  },
];

const IconComponent = {
  github: GitHub,
  twitter: Twitter,
  discord: Discord,
  linkedin: LinkedIn,
};

interface GitHubApiResponse {
  stargazers_count: number;
}

export function Navigation() {
  const [open, setOpen] = useState(false);
  const [stars, setStars] = useState(0); // Default fallback value
  const [isScrolled, setIsScrolled] = useState(false);
  const { data: session } = useSession();
  const navigate = useNavigate();

  const { data: githubData } = useQuery({
    queryKey: ['githubStars'],
    queryFn: async () => {
      const response = await fetch('https://api.github.com/repos/Mail-0/Zero', {
        headers: {
          Accept: 'application/vnd.github.v3+json',
        },
      });
      if (!response.ok) {
        throw new Error('Failed to fetch GitHub stars');
      }
      return response.json() as Promise<GitHubApiResponse>;
    },
  });

  useEffect(() => {
    if (githubData) {
      setStars(githubData.stargazers_count || 0);
    }
  }, [githubData]);

  useEffect(() => {
    const handleScroll = () => {
      const scrolled = window.scrollY > 10;
      setIsScrolled(scrolled);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className={cn(
      "sticky top-0 z-50 bg-black/80 backdrop-blur-xl pt-6 transition-all duration-300",
      isScrolled ? "border-b border-white/5" : "border-b border-transparent"
    )}>
      <NavigationMenu />
    </div>
  );
}
