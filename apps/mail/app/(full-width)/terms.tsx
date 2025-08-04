import { useTheme } from 'next-themes';
import { useEffect } from 'react';

import React from 'react';

export default function TermsOfService() {
  const { setTheme } = useTheme();

  useEffect(() => {
    setTheme('dark');
  }, [setTheme]);

  return (
    <main className="relative flex flex-col overflow-x-hidden bg-[#000000] px-2 flex-1">
      <article className="mt-2 flex flex-col items-center flex-1">
        <div className="w-full max-w-[800px] mx-auto flex flex-col px-5">
          
          {/* Header */}
          <header className="mb-8 mt-16 text-center">
            <h1 className="text-4xl md:text-6xl text-white mb-3 leading-tight">
              Terms of Service
            </h1>
            <p className="text-sm text-white/50 mb-8 leading-relaxed max-w-3xl mx-auto">
              Last updated: July 31, 2025
            </p>
          </header>

          {/* Content */}
          <div className="mb-16 space-y-16">
            {sections.map((section) => (
              <section key={section.title}>
                <h1 className="text-2xl font-bold text-white mb-5 leading-tight">
                  {section.title}
                </h1>
                <div className="prose prose-invert prose-lg text-white/70 leading-relaxed max-w-none">
                  {section.content}
                </div>
              </section>
            ))}
          </div>
          
        </div>
      </article>
    </main>
  );
}

const sections = [
  {
    title: 'Overview',
    content: (
      <p>
        0.email is an open-source email solution that enables users to self-host their email service
        or integrate with external email providers. By using 0.email, you agree to these terms.
      </p>
    ),
  },
  {
    title: 'Service Description',
    content: (
      <div className="space-y-8">
        <div>
          <h3 className="mb-3 text-lg font-medium">Self-Hosted Service</h3>
          <ul className="ml-4 list-disc space-y-2">
            <li>0.email provides software that users can deploy on their own infrastructure</li>
            <li>Users are responsible for their own hosting, maintenance, and compliance</li>
            <li>The software is provided "as is" under the MIT License</li>
          </ul>
        </div>
        <div>
          <h3 className="mb-3 text-lg font-medium">
            External Email Integration
          </h3>
          <ul className="ml-4 list-disc space-y-2">
            <li>0.email can integrate with third-party email providers</li>
            <li>Users must comply with third-party providers' terms of service</li>
            <li>We are not responsible for third-party service disruptions</li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    title: 'User Responsibilities',
    content: (
      <div className="space-y-3">
        <p>Users agree to:</p>
        <ul className="ml-4 list-disc space-y-2">
          <li>Comply with all applicable laws and regulations</li>
          <li>Maintain the security of their instance</li>
          <li>Not use the service for spam or malicious purposes</li>
          <li>Respect intellectual property rights</li>
          <li>Report security vulnerabilities responsibly</li>
        </ul>
      </div>
    ),
  },
  {
    title: 'Software License',
    content: (
      <div className="space-y-3">
        <p>0.email is licensed under the MIT License:</p>
        <ul className="ml-4 list-disc space-y-2">
          <li>Users can freely use, modify, and distribute the software</li>
          <li>The software comes with no warranties</li>
          <li>Users must include the original license and copyright notice</li>
        </ul>
      </div>
    ),
  },
  {
    title: 'Community Guidelines',
    content: (
      <div className="space-y-3">
        <p>Users participating in our community agree to:</p>
        <ul className="ml-4 list-disc space-y-2">
          <li>Follow our code of conduct</li>
          <li>Contribute constructively to discussions</li>
          <li>Respect other community members</li>
          <li>Report inappropriate behavior</li>
        </ul>
      </div>
    ),
  },
  {
    title: 'Contact',
    content: (
      <div className="space-y-3">
        <p>For questions about these terms: <a href="mailto:founders@0.email" className="text-white/70 hover:text-white/60 underline">founders@0.email</a></p>
      </div>
    ),
  },
];
