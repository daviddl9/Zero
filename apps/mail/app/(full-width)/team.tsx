import { useTheme } from 'next-themes';
import { useEffect } from 'react';
import { getAllEmployees } from '@/data/employees';
import { EmployeeHoverCard } from '@/components/ui/employee-hover-card';

export default function TeamPage() {
  const { setTheme } = useTheme();

  useEffect(() => {
    setTheme('dark');
  }, [setTheme]);

  // Get all employees except the "zero-team" placeholder entry
  const teamMembers = getAllEmployees().filter(employee => employee.id !== 'zero-team');

  return (
    <main className="relative flex flex-col overflow-x-hidden bg-black flex-1">
      <section className="mt-2 flex flex-col items-center flex-1">
        <div className="w-full max-w-[1200px] mx-auto flex flex-col">
          
          {/* Header */}
          <div className="flex flex-col items-center mb-16">
            <div className="mb-8">
              <h1 className="text-6xl font-normal text-white text-center mb-4 mt-20">
                The Zero Team
              </h1>
              <p className="text-xl text-white/60 text-center max-w-2xl mx-auto">
                Meet the passionate team behind Zero, working together to revolutionize email management and create the future of productivity.
              </p>
            </div>
          </div>

          {/* Team Grid */}
          <div className="mb-16">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8 justify-items-center">
              {teamMembers.map((member, index) => {
                // For the last row, if we have exactly 2 remaining members, center them
                const isLastTwo = index >= teamMembers.length - 2 && teamMembers.length % 4 === 2;
                
                return (
                  <EmployeeHoverCard key={member.id} employee={member}>
                    <div
                      className={`flex flex-col items-center group cursor-pointer ${
                        isLastTwo ? 'lg:col-start-2 lg:col-span-1' : ''
                      } ${
                        index === teamMembers.length - 1 && teamMembers.length % 4 === 2 ? 'lg:col-start-3' : ''
                      }`}
                    >
                      {/* Profile Picture */}
                      <div className="w-32 h-32 rounded-full overflow-hidden bg-white/5 mb-4 ring-2 ring-white/10">
                        <img
                          src={member.profileImage}
                          alt={member.fullName}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      
                      {/* Name and Role */}
                      <div className="text-center">
                        <h3 className="text-xl font-medium text-white mb-1">
                          {member.fullName.split(' ')[0]} {/* First name only */}
                        </h3>
                        <p className="text-white/60 text-sm">
                          {member.role}
                        </p>
                      </div>
                    </div>
                  </EmployeeHoverCard>
                );
              })}
            </div>
          </div>
          
        </div>
      </section>
    </main>
  );
} 