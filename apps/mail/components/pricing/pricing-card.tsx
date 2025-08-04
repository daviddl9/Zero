import { PurpleThickCheck, ThickCheck } from '../icons/icons';
import { useSession, signIn } from '@/lib/auth-client';
import { useBilling } from '@/hooks/use-billing';
import { useNavigate } from 'react-router';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  ChatBubbleLeftRightIcon,
  InboxIcon,
  CalendarDaysIcon,
  DocumentTextIcon,
  QueueListIcon,
  Squares2X2Icon,
  EnvelopeIcon,
  SparklesIcon,
  BoltIcon,
  ArrowUturnLeftIcon,
  ClockIcon,
  ChartBarIcon,
  QuestionMarkCircleIcon,
  UsersIcon,
  KeyIcon,
  ShieldCheckIcon,
  StarIcon,
  UserCircleIcon,
} from '@heroicons/react/24/solid';

const PRICING_CONSTANTS = {
  HOBBY_FEATURES: [
    'Smart Zero Assistant',
    'Inbox Actions (Limited)',
    'Calendar Integration',
    'AI Drafts',
    'Thread Summaries',
    'Bulk Actions',
    'Gmail & Outlook Support'
  ],
  PRO_FEATURES: [
    'Everything in Hobby, plus:',
    'Unlimited AI Usage',
    '200x Smarter Zero Assistant',
    'AI Auto Responder',
    'Recent Opens',
    'Analytics',
    'Email Support'
  ],
  ENTERPRISE_FEATURES: [
    'Everything in Pro, plus:',
    'Shared Inboxes',
    'Single Sign-On (SSO)',
    'Team Analytics & Usage Insights',
    'Data Residency & Compliance Options',
    'Priority Support',
    'Dedicated Account Manager',
  ],
  MONTHLY_PRICE: 20,
} as const;

const handleGoogleSignIn = (
  callbackURL: string,
  options?: { loading?: string; success?: string },
) => {
  return toast.promise(
    signIn.social({
      provider: 'google',
      callbackURL,
    }),
    {
      success: options?.success || 'Redirecting to login...',
      error: 'Login redirect failed',
    },
  );
};

const getFeatureIcon = (text: string) => {
  const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
    'Smart Zero Assistant': ChatBubbleLeftRightIcon,
    'Inbox Actions (Limited)': InboxIcon,
    'Calendar Integration': CalendarDaysIcon,
    'AI Drafts': DocumentTextIcon,
    'Thread Summaries': QueueListIcon,
    'Bulk Actions': Squares2X2Icon,
    'Gmail & Outlook Support': EnvelopeIcon,
    'Unlimited AI Usage': SparklesIcon,
    '200x Smarter Zero Assistant': BoltIcon,
    'AI Auto Responder': ArrowUturnLeftIcon,
    'Recent Opens': ClockIcon,
    'Analytics': ChartBarIcon,
    'Email Support': QuestionMarkCircleIcon,
    'Shared Inboxes': UsersIcon,
    'Single Sign-On (SSO)': KeyIcon,
    'Team Analytics & Usage Insights': ChartBarIcon,
    'Data Residency & Compliance Options': ShieldCheckIcon,
    'Priority Support': StarIcon,
    'Dedicated Account Manager': UserCircleIcon,
  };

  return iconMap[text];
};

interface FeatureItemProps {
  text: string;
  isPro?: boolean;
}

const FeatureItem = ({ text, isPro }: FeatureItemProps) => {
  const isEverythingInText = text.startsWith('Everything in');
  const IconComponent = getFeatureIcon(text);
  
  return (
    <div className="flex items-start gap-3">
      {!isEverythingInText && IconComponent && (
        <div className="flex h-4 w-4 items-center justify-center mt-0.5">
          <IconComponent className="h-4 w-4 text-white" />
        </div>
      )}
      <span className={`text-sm leading-relaxed ${isEverythingInText ? 'text-white/60 font-medium' : 'text-white/60'} ${isEverythingInText ? '' : 'ml-0'}`}>
        {text}
      </span>
    </div>
  );
};

export default function PricingCard() {
  const monthlyPrice = PRICING_CONSTANTS.MONTHLY_PRICE;
  const { attach } = useBilling();
  const { data: session } = useSession();
  const navigate = useNavigate();

  const handleUpgrade = async () => {
    if (!session) {
      handleGoogleSignIn(`${window.location.origin}/pricing`);
      return;
    }

    if (attach) {
      toast.promise(
        attach({
          productId: 'pro-example',
          successUrl: `${window.location.origin}/mail/inbox?success=true`,
        }),
        {
          success: 'Redirecting to payment...',
          error: 'Failed to process upgrade. Please try again later.',
        },
      );
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 sm:px-6 md:px-0 ">
      {/* Pricing Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 ">
        
        {/* Hobby Plan */}
        <div className="relative bg-black border border-white/10 rounded-xl p-6 flex flex-col">
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-4">
              <h3 className="text-xl font-semibold text-white">Hobby</h3>
            </div>
            
            <div className="">
              <span className="text-3xl font-bold text-white">Free forever</span>
            </div>
          </div>

          <div className="flex-1 mb-6">
            <div className="space-y-3">
              {PRICING_CONSTANTS.HOBBY_FEATURES.map((feature) => (
                <FeatureItem key={feature} text={feature} />
              ))}
            </div>
          </div>

          <button
            onClick={() => {
              if (session) {
                navigate('/mail/inbox');
              } else {
                handleGoogleSignIn(`${window.location.origin}/mail`);
              }
            }}
            className="w-full py-2.5 px-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white font-medium transition-colors text-sm"
          >
            Get started
          </button>
        </div>

        {/* Pro Plan */}
        <div className="relative bg-black border border-white/10 rounded-xl p-6 flex flex-col">
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-4">
              <h3 className="text-xl font-semibold text-white">Pro</h3>
            </div>
            
            <div>
              <span className="text-3xl font-bold text-white">
                ${monthlyPrice}
              </span>
              <span className="text-white/60 text-sm ml-1">
                / mo
              </span>
            </div>
          </div>

          <div className="flex-1 mb-6">
            <div className="space-y-3">
              {PRICING_CONSTANTS.PRO_FEATURES.map((feature) => (
                <FeatureItem key={feature} text={feature} isPro />
              ))}
            </div>
          </div>

          <button
            onClick={handleUpgrade}
            className="w-full py-2.5 px-4 bg-white text-black hover:bg-white/90 font-medium rounded-lg transition-colors text-sm"
          >
            Upgrade now
          </button>
        </div>

        {/* Enterprise Plan */}
        <div className="relative bg-black border border-white/10 rounded-xl p-6 flex flex-col">
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-4">
              <h3 className="text-xl font-semibold text-white">Enterprise</h3>
            </div>
            
            <div >
              <span className="text-3xl font-bold text-white">Custom</span>
            </div>
          </div>

          <div className="flex-1 mb-6">
            <div className="space-y-3">
              {PRICING_CONSTANTS.ENTERPRISE_FEATURES.map((feature) => (
                <FeatureItem key={feature} text={feature} isPro />
              ))}
            </div>
          </div>

          <div className="flex flex-row gap-3">
            <button
              onClick={() => window.open('https://cal.com/team/0/chat', '_blank')}
              className="w-full py-2.5 px-4 bg-white text-black hover:bg-white/90 font-medium rounded-lg transition-colors text-sm"
            >
              Get a demo
            </button>
            <button
              onClick={() => window.open('https://cal.com/team/0/chat', '_blank')}
              className="w-full py-2.5 px-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white font-medium transition-colors text-sm"
            >
              Request trial
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
