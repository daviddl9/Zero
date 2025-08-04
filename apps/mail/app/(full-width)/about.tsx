import { useTheme } from 'next-themes';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import React from 'react';

export default function AboutPage() {
  const { setTheme } = useTheme();

  useEffect(() => {
    setTheme('dark');
  }, [setTheme]);

  return (
    <main className="relative flex flex-col overflow-x-hidden bg-[#000000] px-2 flex-1">
      <article className="mt-2 flex flex-col items-center flex-1">
        <div className="w-full max-w-[800px] mx-auto flex flex-col px-5">
          
          {/* Header */}
          <header className="mb-16 mt-16 text-center">
            <h1 className="text-4xl md:text-6xl text-white mb-3 leading-tight">
              Zero allows people to control their inbox.
            </h1>
            <p className="text-xl text-white/60 mb-8 leading-relaxed max-w-3xl mx-auto">
              Zero's app gives people the ability to not lose control of their inbox with ai.
            </p>


            
            {/* Hero Image */}
            <div className="mb-52 aspect-[16/9] relative overflow-hidden bg-white/5 rounded-xl border max-w-3xl mx-auto">
              <img
                src="/blog/images/girl.png"
                alt="Zero gradient illustration"
                className="w-full h-full object-cover"
              />
            </div>
          </header>

          {/* Our Story */}
         
          {/* Why Zero  */}
          <section className="mb-52 flex flex-col items-center justify-center">
            <h2 className="text-3xl text-white mb-4 text-center">Why We Built Zero</h2>
            <div className="prose prose-invert prose-lg text-white/70 leading-relaxed max-w-lg">
              <p className="text-left text-lg mb-8">
                Zero's goal is to bring AI to email the right way. But it wasn't always that way. Zero started as an open source project to help people self host their email.
              </p>
              
              <p className="text-left text-lg mb-8">
                However, as we continued to build Zero, we noticed that our users wanted more. They wanted to something to help them control their inbox and get more done.
              </p>
              <p className="text-left text-lg">
                Since then, we've been working to bring AI to email the right way and build the first agentic inbox. We've built a team of experts in AI and email to help us achieve our mission!
              </p>
            </div>
          </section>

          {/* Our Team */}
          {/* <section className="mb-16">
            <h2 className="text-3xl font-bold text-white mb-6 text-center">Our Team</h2>
            
            <div className="text-center mb-8">
              <p className="text-white/70 text-lg mb-6">
                Zero is a team with one mission: bring agents to email.
              </p>
              
              <Button
                className="rounded-[10px] px-4 py-1 h-9 bg-white text-[14px] font-medium leading-[1.43] text-[#262626] hover:bg-white/90 transition-colors"
                onClick={() => window.location.href = '/team'}
              >
                Meet the rest of the team
              </Button>
            </div>
            
  
            <div className="aspect-[16/9] relative overflow-hidden bg-white/5 rounded-xl border max-w-2xl mx-auto">
              <img
                src="/founders.jpg"
                alt="Adam and Nizar, Zero founders"
                className="w-full h-full object-cover"
              />
            </div>
            <p className="text-xs text-white/50 text-center mt-3">
              Adam and Nizar at Y Combinator Demo Day
            </p>
          </section> */}

          {/* Investors Section */}
          <section className="mb-40">
            <h2 className="text-3xl text-white mb-2 text-center">Backed by The Best Investors</h2>
            <div className="prose prose-invert prose-lg text-white/70 leading-relaxed max-w-none mb-8">
              <p className="text-center">
                We're lucky to work with and be backed by some of the most incredible investors in the world. 
              </p>
            </div>

            {/* Investors Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 justify-items-center">
              {investors.map((investor, index) => {
                const totalInvestors = investors.length;
                const investorsPerRow = 4;
                const lastRowCount = totalInvestors % investorsPerRow;
                const isInLastRow = index >= totalInvestors - lastRowCount;
                
                let gridPositionClass = '';
                if (isInLastRow && lastRowCount === 2) {
                  const positionInLastRow = index - (totalInvestors - lastRowCount);
                  if (positionInLastRow === 0) gridPositionClass = 'lg:col-start-2';
                  if (positionInLastRow === 1) gridPositionClass = 'lg:col-start-3';
                }

                return (
                <div key={investor.name} className={`flex flex-col items-center text-center ${gridPositionClass}`}>
                  <div className="w-20 h-20 rounded-full overflow-hidden bg-white/5 mb-4 flex items-center justify-center">
                    {investor.image ? (
                      <img 
                        src={investor.image} 
                        alt={investor.name}
                        className="w-full h-full object-cover grayscale"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg">
                        {investor.name.split(' ').map(n => n[0]).join('')}
                      </div>
                    )}
                  </div>
                  <div className="text-sm font-medium text-white/90 mb-1">
                    {investor.name}
                  </div>
                  {investor.title && (
                    <div className="text-xs text-white/60">
                      {investor.title}
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          </section>
          
        </div>
      </article>
    </main>
  );
}

// Our investors
const investors = [
  { name: '1984 Ventures', title: '', image: '/investors/1984.png' },
  { name: 'Pioneer Fund', title: '', image: '/investors/pioneer.jpg' },
  { name: 'Lobster Capital', title: '', image: '/investors/lobster capital.jpeg' },
  { name: 'Dane Knecht', title: 'CTO of Cloudflare', image: '/investors/dane.jpg' },
  { name: 'Zeno Rocha', title: 'Founder of Resend', image: '/investors/zeno.jpg' },
  { name: 'Theo Browne', title: 'Founder of T3 Chat', image: '/investors/theo.jpg' },
  { name: 'Habib Haddad', title: 'E14 Fund', image: '/investors/habib haddad.jpeg' },
  { name: 'Archie McKenzie', title: 'Founder of General Translations', image: '/investors/archie.jpg' },
  { name: 'Grey Baker', title: 'Founder of Dependabot', image: '/investors/grey barker.jpg' },
  { name: 'Stefan Lederer', title: 'CEO of Bitmovin', image: '/investors/stefan.jpeg' },
  { name: 'Andres KG', title: 'Founder of The Network', image: '/investors/Andres.jpg' },
  { name: 'Britton Winterrose', title: 'Microsoft, Startups', image: '/investors/britton.jpg' },
  { name: 'Ted Stiefel', title: 'Angel Investor', image: '/investors/Ted Stiefel.jpg' },
  { name: 'Ryan Vogel', title: 'Angel Investor', image: '/investors/ryan.jpg' },
  { name: 'Raffael Vendrametto', title: 'Angel Investor', image: '/investors/raffael.jpeg' },
  { name: 'Zhihao Ni', title: 'Angel Investor', image: '/investors/Zhihao Ni.jpg' },
  { name: 'Adam Cohen Hillel', title: 'Angel Investor', image: '/investors/adam-cohen.jpg' },
  { name: 'Moataz Soliman', title: 'Angel Investor', image: '/investors/Moataz Soliman.jpeg' },
  
];


