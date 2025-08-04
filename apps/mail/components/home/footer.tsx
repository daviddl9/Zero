
import { motion } from 'motion/react';
import { Button } from '../ui/button';
import { Link } from 'react-router';
import { useRef } from 'react';

const footerData = {
  company: {
    title: 'Company',
    links: [
      { name: 'About', href: '/about' },
      { name: 'Blog', href: '/blog' },
      { name: 'Careers', href: '/careers' },
      { name: 'Contact Us', href: '/contact' },
      { name: 'Privacy Policy', href: '/privacy' },
    ]
  },
  resources: {
    title: 'Resources',
    links: [
      { name: 'Community', href: '/community' },
      { name: 'Docs', href: '/docs' },
      { name: 'Help', href: '/help' },
      { name: 'Integrations', href: '/integrations' },
      { name: 'Pricing', href: '/pricing' },
   
    ]
  },
  features: {
    title: 'Features',
    links: [
      { name: 'Agent', href: '/agent' },
      { name: 'Auto responder', href: '/auto-responder' },
      { name: 'Apps', href: '/apps' },
      { name: 'AI Chat', href: '/ai-chat' },
      { name: 'Bulk Actions', href: '/bulk-actions' },
    ]
  }
};

const socialLinks = [
  {
    name: 'GitHub',
    href: 'https://github.com/Mail-0/Zero',
    icon: (props: any) => (
      <svg viewBox="0 0 24 24" {...props}>
        <path fill="currentColor" d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.30.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
      </svg>
    ),
  },
  {
    name: 'Twitter',
    href: 'https://x.com/mail0dotcom',
    icon: (props: any) => (
      <svg viewBox="0 0 30 30" fill="currentColor" {...props}>
        <path d="M26.37,26l-8.795-12.822l0.015,0.012L25.52,4h-2.65l-6.46,7.48L11.28,4H4.33l8.211,11.971L12.54,15.97L3.88,26h2.65 l7.182-8.322L19.42,26H26.37z M10.23,6l12.34,18h-2.1L8.12,6H10.23z"/>
      </svg>
    ),
  },
  {
    name: 'LinkedIn',
    href: 'https://www.linkedin.com/company/mail0/posts/?feedView=all',
    icon: (props: any) => (
      <svg viewBox="0 0 18 19" fill="currentColor" {...props}>
        <path d="M5.20508 4.00075C5.20488 4.39857 5.04665 4.78003 4.76521 5.06119C4.48376 5.34235 4.10215 5.5002 3.70433 5.5C3.3065 5.4998 2.92505 5.34158 2.64389 5.06013C2.36272 4.77868 2.20488 4.39707 2.20508 3.99925C2.20528 3.60143 2.3635 3.21997 2.64495 2.93881C2.92639 2.65765 3.308 2.4998 3.70583 2.5C4.10365 2.5002 4.48511 2.65843 4.76627 2.93987C5.04743 3.22132 5.20528 3.60293 5.20508 4.00075ZM5.25008 6.61075H2.25008V16.0007H5.25008V6.61075ZM9.99008 6.61075H7.00508V16.0007H9.96008V11.0733C9.96008 8.32825 13.5376 8.07325 13.5376 11.0733V16.0007H16.5001V10.0533C16.5001 5.42575 11.2051 5.59825 9.96008 7.87075L9.99008 6.61075Z" />
      </svg>
    ),
  },
];

export default function Footer() {
  const ref = useRef(null);

  return (
    <footer ref={ref} className="bg-black pb-20">
      <div className="w-full max-w-[1200px] mx-auto py-12 px-4 md:px-0">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-3 gap-y-8 md:gap-y-3 lg:flex lg:justify-between lg:gap-8 w-full">
          {/* Logo Section */}
          <div className="lg:col-span-1 space-y-6">
            {/* Logo */}
            <div className="flex items-center space-x-2">
              <img 
                src="/white-icon.svg" 
                alt="Logo" 
                className="w-8 h-8"
              />
            </div>
            
            {/* Badges */}
            <div className="flex flex-col gap-3">
              {/* Y Combinator Badge */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="inline-flex  gap-2 rounded-[10px]"
              >
                <Link to="https://www.ycombinator.com/launches/NTI-zero-ai-native-email" target="_blank" className="flex items-center gap-2 text-sm text-[#D4D4D4]">
                  Backed by
                  <span>
                    <img
                      src="/yc-small.svg"
                      alt="Y Combinator"
                      className="rounded-[2px] grayscale"
                      width={16}
                      height={16}
                    />
                  </span>
                  Combinator
                </Link>
              </motion.div>

              {/* Uptime Badge */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="inline-flex "
              >
                                  <div className="flex items-center gap-2 text-sm text-green-400 mt-1">
                    <div className="relative">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <div className="absolute top-0 left-0 w-2 h-2 bg-green-500 rounded-full animate-ping" style={{ animationDuration: '2s' }}></div>
                    </div>
                    All Systems Normal
                  </div>
              </motion.div>
            </div>
          </div>

          {/* Social Column */}
          <div className="space-y-4">
            <h3 className="text-white font-semibold text-sm">
              Social
            </h3>
            <ul className="space-y-3">
              {socialLinks.map((social) => (
                <li key={social.name}>
                  <a
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-white/70 hover:text-white transition-colors text-sm flex items-center space-x-2"
                  >
                    <social.icon className="w-4 h-4" />
                    <span>{social.name}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Company Column */}
          <div className="space-y-4">
            <h3 className="text-white font-semibold text-sm">
              {footerData.company.title}
            </h3>
            <ul className="space-y-3">
              {footerData.company.links.map((link) => (
                <li key={link.name}>
                  <Link
                    to={link.href}
                    className="text-white/70 hover:text-white transition-colors text-sm"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources Column */}
          <div className="space-y-4">
            <h3 className="text-white font-semibold text-sm">
              {footerData.resources.title}
            </h3>
            <ul className="space-y-3">
              {footerData.resources.links.map((link) => (
                <li key={link.name}>
                  <Link
                    to={link.href}
                    className="text-white/70 hover:text-white transition-colors text-sm"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Products Column */}
          <div className="space-y-4">
            <h3 className="text-white font-semibold text-sm">
              {footerData.features.title}
            </h3>
            <ul className="space-y-3">
              {footerData.features.links.map((link) => (
                <li key={link.name}>
                  <Link
                    to={link.href}
                    className="text-white/70 hover:text-white transition-colors text-sm"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

      </div>
    </footer>
  );
}
