import { Check, Minus } from 'lucide-react';
import { useSession, signIn } from '@/lib/auth-client';
import { useBilling } from '@/hooks/use-billing';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import React from 'react';

const COMPARISON_DATA = {
  categories: [
    {
      name: "Core Features",
      features: [
        {
          name: "Smart Zero Assistant",
          hobby: "Limited",
          pro: "Unlimited",
          enterprise: "Unlimited"
        },
        {
          name: "Auto Labeling",
          hobby: true,
          pro: true,
          enterprise: true
        },
        {
          name: "Quick OTP & Magic Links Emails",
          hobby: true,
          pro: true,
          enterprise: true
        },
        {
          name: "Account Connections",
          hobby: "2",
          pro: "Unlimited",
          enterprise: "Unlimited"
        }
      ]
    },
    {
      name: "AI & Automation",
      features: [
        {
          name: "Zero Agent",
          hobby: "Limited",
          pro: "Unlimited",
          enterprise: "Unlimited"
        },
        {
          name: "AI Email Drafts",
          hobby: "Limited",
          pro: "Unlimited",
          enterprise: "Unlimited"
        },
        {
          name: "Auto Responder",
          hobby: "Limited",
          pro: "Unlimited",
          enterprise: "Unlimited"
        },
        {
          name: "Thread Summaries",
          hobby: "Limited",
          pro: "Unlimited",
          enterprise: "Unlimited"
        }
      ]
    },
    {
      name: "Productivity & Actions",
      features: [
        {
          name: "Bulk Actions",
          hobby: "Limited",
          pro: "Unlimited",
          enterprise: "Unlimited"
        },
        {
          name: "Shortcuts",
          hobby: "Limited",
          pro: "Unlimited",
          enterprise: "Unlimited"
        },
        {
          name: "Inbox Actions",
          hobby: "Limited",
          pro: "Unlimited",
          enterprise: "Unlimited"
        },
        {
          name: "Calendar Integration",
          hobby: "Limited",
          pro: "Full Integration",
          enterprise: "Full Integration"
        }
      ]
    },
    {
      name: "Analytics & Insights",
      features: [
        {
          name: "Analytics",
          hobby: "Limited",
          pro: "Full Analytics",
          enterprise: "Full Analytics"
        },
        {
          name: "Team Analytics & Usage Insights",
          hobby: false,
          pro: false,
          enterprise: true
        }
      ]
    },
    {
      name: "Enterprise Features",
      features: [
        {
          name: "Shared Inboxes",
          hobby: false,
          pro: false,
          enterprise: true
        },
        {
          name: "Advanced Admin Security & Permissions",
          hobby: false,
          pro: false,
          enterprise: true
        },
        {
          name: "Single Sign-On (SSO)",
          hobby: false,
          pro: false,
          enterprise: true
        },
        {
          name: "Data Residency & Compliance Options",
          hobby: false,
          pro: false,
          enterprise: true
        },
        {
          name: "Priority Support",
          hobby: false,
          pro: false,
          enterprise: true
        }
      ]
    }
  ],
  pricing: {
    hobby: { monthly: "Free, Forever.", annual: "Free, Forever." },
    pro: { monthly: "$20 / month", annual: "$16 / month" },
    enterprise: { monthly: "Custom", annual: "Custom" }
  }
};

const FeatureValue = ({ value }: { value: boolean | string }) => {
  if (typeof value === 'boolean') {
    return (
      <div className="flex justify-center">
        {value ? (
          <Check className="h-5 w-5 text-white/40" />
        ) : (
          <Minus className="h-5 w-5 text-white/40" />
        )}
      </div>
    );
  }
  
  return (
    <div className="flex justify-center">
      <span className="text-sm text-white/80 font-medium">
        {value}
      </span>
    </div>
  );
};

export default function Comparison() {
  const { attach } = useBilling();
  const { data: session } = useSession();
  const navigate = useNavigate();

  const handleUpgrade = async () => {
    if (!session) {
      toast.promise(
        signIn.social({
          provider: 'google',
          callbackURL: `${window.location.origin}/pricing`,
        }),
        {
          success: 'Redirecting to login...',
          error: 'Login redirect failed',
        },
      );
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
    <div className="mx-auto w-full max-w-[1000px] px-4 sm:px-6 md:px-0">
      <div className="mb-12 text-center">
        <h2 className="text-4xl font-normal text-white mb-4">
          Compare Features
        </h2>
        <p className="text-lg text-white/60">
          See what's included in each plan
        </p>
      </div>

      <div className="">
        <table className="w-full border-collapse">
          {/* Header */}
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left py-6 px-6 text-lg font-medium text-white w-1/4">
                Features
              </th>
              <th className="text-center py-6 px-6 w-1/4">
                <div className="text-xl font-semibold text-white mb-2">Hobby</div>
                <div className="text-sm text-white/60">Free, Forever.</div>
              </th>
              <th className="text-center py-6 px-6 w-1/4">
                <div className="text-xl font-semibold text-white mb-2">Pro</div>
                <div className="text-sm text-white/60">$20 / month</div>
              </th>
              <th className="text-center py-6 px-6 w-1/4">
                <div className="text-xl font-semibold text-white mb-2">Enterprise</div>
                <div className="text-sm text-white/60">Custom</div>
              </th>
            </tr>
          </thead>

          <tbody>
            {COMPARISON_DATA.categories.map((category, categoryIndex) => (
              <React.Fragment key={category.name}>
                {/* Category Header */}
                <tr>
                  <td colSpan={4} className="py-8 px-6">
                    <h3 className="text-lg font-semibold text-white">
                      {category.name}
                    </h3>
                  </td>
                </tr>
                
                {/* Category Features */}
                {category.features.map((feature, featureIndex) => (
                  <tr 
                    key={feature.name}
                    className="border-b border-white/5 hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="py-4 px-6 text-white/80">
                      {feature.name}
                    </td>
                    <td className="py-4 px-6 text-center">
                      <FeatureValue value={feature.hobby} />
                    </td>
                    <td className="py-4 px-6 text-center">
                      <FeatureValue value={feature.pro} />
                    </td>
                    <td className="py-4 px-6 text-center">
                      <FeatureValue value={feature.enterprise} />
                    </td>
                  </tr>
                ))}
              </React.Fragment>
            ))}

            {/* Action Buttons Row */}
            <tr>
              <td className="py-8 px-6">
                <div className="text-lg font-medium text-white">
                  Get Started
                </div>
              </td>
              <td className="py-8 px-6 text-center">
                <button
                  onClick={() => {
                    if (session) {
                      navigate('/mail/inbox');
                    } else {
                      signIn.social({
                        provider: 'google',
                        callbackURL: `${window.location.origin}/mail`,
                      });
                    }
                  }}
                  className="px-6 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg text-white font-medium transition-colors"
                >
                  Download
                </button>
              </td>
              <td className="py-8 px-6 text-center">
                <button
                  onClick={handleUpgrade}
                  className="px-6 py-2 bg-white text-black hover:bg-white/90 font-medium rounded-lg transition-colors"
                >
                  Select Plan
                </button>
              </td>
              <td className="py-8 px-6 text-center">
                <button
                  onClick={() => window.open('https://cal.com/team/0/chat', '_blank')}
                  className="px-6 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg text-white font-medium transition-colors"
                >
                  Contact us
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
