import { PixelatedBackground } from '@/components/home/pixelated-bg';
import PricingCard from '@/components/pricing/pricing-card';
import Comparision from '@/components/pricing/comparision';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';

const FAQ_DATA = [
  {
    question: "Which Zero plan is right for me?",
    answer: "Our Hobby plan is perfect for personal email management with AI features. Pro is ideal for professionals and power users who need unlimited connections and advanced AI capabilities. Enterprise is for teams seeking advanced security, priority support, and custom integrations."
  },
  {
    question: "Can I change plans at any time?",
    answer: "Yes! You can upgrade or downgrade your plan at any time. Changes take effect immediately, and we'll prorate any billing adjustments on your next invoice."
  },
  {
    question: "What email providers do you support?",
    answer: "Zero works with all major email providers including Gmail, Outlook, Yahoo, iCloud, and any IMAP/SMTP compatible email service. You can connect unlimited email accounts on Pro and Enterprise plans."
  },
  {
    question: "How does the AI email writing work?",
    answer: "Our AI analyzes your writing style and email context to generate personalized responses and drafts. It learns from your preferences to provide increasingly accurate suggestions while maintaining your unique voice."
  },
  {
    question: "Is my email data secure?",
    answer: "Absolutely. We use enterprise-grade encryption, comply with SOC 2 Type II standards, and never store your email content on our servers longer than necessary for processing. Your privacy and security are our top priorities."
  },
  {
    question: "Do you offer refunds?",
    answer: "Yes, we offer a 30-day money-back guarantee for Pro subscriptions. If you're not satisfied with Zero, contact our support team for a full refund within 30 days of your purchase."
  }
];

export default function PricingPage() {
  return (
    <main className="relative flex flex-col overflow-x-hidden bg-black flex-1 mb-32">
      <section className="mt-2 flex flex-col items-center flex-1">
        <div className="w-full max-w-[1200px] mx-auto flex flex-col space-y-40">
          
          {/* Hero + Pricing Cards Section */}
          <div className="flex flex-col items-center">
            {/* Header */}
            <div className="flex flex-col items-center mb-">
              <div className="mb-8 text-center">
                <h1 className="text-6xl font-normal text-white text-center mb-3 mt-20">
                  Pricing
                </h1>
                <p className="text-xl text-white/70 text-center leading-relaxed max-w-3xl mx-auto ">
                  Start for free and scale as you grow.
                </p>
              </div>
            </div>

            {/* Pricing Cards */}
            <div className="">
              <PricingCard />
            </div>
          </div>

          {/* Comparison Section */}
          <div className="w-full">
            <Comparision />
          </div>

          {/* FAQ Section */}
          <div className="w-full max-w-4xl mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-normal text-white mb-4">
                Frequently asked questions
              </h2>
              <p className="text-lg text-white/60">
                Everything you need to know about Zero's pricing and features.
              </p>
            </div>

            <Accordion
              type="single"
              collapsible
              className="w-full"
            >
              {FAQ_DATA.map((faq, index) => (
                <AccordionItem key={`faq-${index}`} value={`item-${index + 1}`}>
                  <AccordionTrigger>{faq.question}</AccordionTrigger>
                  <AccordionContent>{faq.answer}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </section>
    </main>
  );
}
