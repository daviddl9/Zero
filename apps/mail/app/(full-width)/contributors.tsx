import { useTheme } from 'next-themes';
import { useEffect, useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { GitGraph } from 'lucide-react';

interface Contributor {
  login: string;
  avatar_url: string;
  contributions: number;
  html_url: string;
}

const excludedUsernames = new Set([
  'bot1',
  'dependabot',
  'github-actions',
  'zerodotemail',
  'autofix-ci[bot]',
]);

const coreTeamMembers = [
  'nizzyabi',
  'ahmetskilinc',
  'BlankParticle',
  'needlexo',
  'dakdevs',
  'mrgsub',
];

// Contributor descriptions mapping
const contributorDescriptions: Record<string, string> = {
  // Add specific descriptions for key contributors here
  // Example: 'username': 'Description of their contribution'
};

// Function to get contributor description
const getContributorDescription = (contributor: Contributor): string => {
  // Check if we have a specific description for this contributor
  if (contributorDescriptions[contributor.login]) {
    return contributorDescriptions[contributor.login];
  }
  
  // Generate description based on contribution count
  if (contributor.contributions >= 100) {
    return 'Major contributor to Zero';
  } else if (contributor.contributions >= 50) {
    return 'Active contributor';
  } else if (contributor.contributions >= 20) {
    return 'Regular contributor';
  } else if (contributor.contributions >= 10) {
    return 'Frequent contributor';
  } else {
    return 'Community contributor';
  }
};

const REPOSITORY = 'Mail-0/Zero';

export default function ContributorsPage() {
  const { setTheme } = useTheme();
  const [allContributors, setAllContributors] = useState<Contributor[]>([]);

  useEffect(() => {
    setTheme('dark');
  }, [setTheme]);

  const { data: initialContributors } = useQuery({
    queryFn: () =>
      fetch(`https://api.github.com/repos/${REPOSITORY}/contributors?per_page=100&page=1`).then(
        (res) => res.json(),
      ) as Promise<Contributor[]>,
    queryKey: ['contributors', REPOSITORY],
  });

  const { data: additionalContributors } = useQuery({
    queryFn: () =>
      fetch(`https://api.github.com/repos/${REPOSITORY}/contributors?per_page=100&page=2`).then(
        (res) => res.json(),
      ) as Promise<Contributor[]>,
    queryKey: ['additional-contributors', REPOSITORY],
    enabled: initialContributors && initialContributors?.length === 100,
  });

  const { data: thirdPageContributors } = useQuery({
    queryFn: () =>
      fetch(`https://api.github.com/repos/${REPOSITORY}/contributors?per_page=100&page=3`).then(
        (res) => res.json(),
      ) as Promise<Contributor[]>,
    queryKey: ['third-page-contributors', REPOSITORY],
    enabled: additionalContributors && additionalContributors?.length === 100,
  });

  useEffect(() => {
    if (initialContributors) {
      const contributors = [initialContributors];
      if (additionalContributors) {
        contributors.push(additionalContributors);
      }
      if (thirdPageContributors) {
        contributors.push(thirdPageContributors);
      }
      setAllContributors(contributors.flat());
    }
  }, [initialContributors, additionalContributors, thirdPageContributors]);

  const filteredContributors = useMemo(
    () =>
      allContributors
        ?.filter(
          (contributor) =>
            !excludedUsernames.has(contributor.login) &&
            !coreTeamMembers.some(
              (member) => member.toLowerCase() === contributor.login.toLowerCase(),
            ),
        )
        .sort((a, b) => b.contributions - a.contributions),
    [allContributors],
  );

  return (
    <main className="relative flex flex-col overflow-x-hidden bg-black flex-1">
      <section className="mt-2 flex flex-col items-center flex-1">
        <div className="w-full max-w-[1200px] mx-auto flex flex-col">
          
          {/* Header */}
          <div className="flex flex-col items-center mb-8">
            <div className="mb-8">
              <h1 className="text-6xl font-normal text-white text-center mb-4 mt-20">
                Contributors
              </h1>
              <p className="text-xl text-white/60 text-center max-w-2xl mx-auto">
                Thank you to all the amazing contributors who have helped make Zero possible. Every contribution, big or small, makes a difference.
              </p>
            </div>
          </div>

          {/* Contributors Grid */}
          <div className="mb-16">
            {!filteredContributors || filteredContributors.length === 0 ? (
              <div className="flex items-center justify-center py-16">
                <div className="text-white/60">Loading contributors...</div>
              </div>
            ) : (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-12 justify-items-center max-w-[1000px] mx-auto">
                 {filteredContributors.map((contributor, index) => {
                   // For centering incomplete rows (similar to team page logic)
                   const totalItems = filteredContributors.length;
                   const remainder = totalItems % 5;
                   
                   // Calculate positioning for incomplete last row
                   let gridPositionClass = '';
                   if (remainder !== 0 && index >= totalItems - remainder) {
                     const positionInLastRow = index - (totalItems - remainder);
                     if (remainder === 1) {
                       gridPositionClass = 'xl:col-start-3'; // Center single item
                     } else if (remainder === 2) {
                       gridPositionClass = positionInLastRow === 0 ? 'xl:col-start-2' : 'xl:col-start-4'; // Center 2 items
                     } else if (remainder === 3) {
                       gridPositionClass = positionInLastRow === 0 ? 'xl:col-start-2' : ''; // Center 3 items
                     } else if (remainder === 4) {
                       gridPositionClass = positionInLastRow === 0 ? 'xl:col-start-1' : ''; // Center 4 items
                     }
                   }
                   
                   return (
                   <a
                     key={contributor.login}
                     href={contributor.html_url}
                     target="_blank"
                     rel="noopener noreferrer"
                     className={`flex flex-col items-center group cursor-pointer ${gridPositionClass}`}
                   >
                                       {/* Profile Picture */}
                   <div className="w-20 h-20 rounded-full overflow-hidden bg-white/5 mb-4">
                     <Avatar className="w-full h-full">
                       <AvatarImage
                         src={contributor.avatar_url}
                         alt={contributor.login}
                         className="object-cover filter grayscale"
                       />
                        <AvatarFallback className="text-xs bg-white/10 text-white">
                          {contributor.login.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                    
                    {/* Name and Contributions */}
                    <div className="text-center">
                      <h3 className="text-md font-medium text-white/90 mb-1">
                        {contributor.login}
                      </h3>
                      <div className="flex items-center justify-center gap-1 text-white/60">
                       
                        <span className="text-xs">
                          {contributor.contributions} commits
                        </span>
                      </div>
                    </div>
                                     </a>
                   );
                 })}
               </div>
            )}
          </div>
          
        </div>
      </section>
    </main>
  );
}
