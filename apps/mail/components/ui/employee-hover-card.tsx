import * as React from "react";
import * as HoverCard from "@radix-ui/react-hover-card";
import type { Employee } from "@/data/employees";

interface EmployeeHoverCardProps {
  employee: Employee;
  children: React.ReactNode;
}

export const EmployeeHoverCard: React.FC<EmployeeHoverCardProps> = ({
  employee,
  children,
}) => {
  return (
    <HoverCard.Root openDelay={200} closeDelay={100}>
      <HoverCard.Trigger asChild>
        {children}
      </HoverCard.Trigger>
      <HoverCard.Portal>
        <HoverCard.Content
          side="top"
          className="w-[300px] rounded-xl bg-black/95 backdrop-blur-xl border border-white/10 p-6 shadow-2xl z-50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=open]:duration-200 data-[state=closed]:duration-150 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2"
          sideOffset={8}
        >
          <div className="flex flex-col gap-3">
            {/* Profile Image & Basic Info */}
            <div className="flex items-start gap-3">
              <img
                className="w-12 h-12 rounded-full object-cover border border-white/20"
                src={employee.profileImage}
                alt={employee.fullName}
              />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-white text-base leading-tight">
                  {employee.fullName}
                </div>
                <div className="text-white/70 text-sm mt-0.5">
                  {employee.role}
                </div>
              </div>
            </div>

            {/* Location */}
            <div className="flex items-center gap-2 text-white/60">
              <svg 
                width="16" 
                height="16" 
                viewBox="0 0 24 24" 
                fill="currentColor"
                className="w-4 h-4 opacity-60"
              >
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
              </svg>
              <span className="text-sm">
                {employee.location.city}, {employee.location.country}
              </span>
            </div>

            {/* Current Time */}
            <div className="flex items-center gap-2 text-white/60">
              <svg 
                width="16" 
                height="16" 
                viewBox="0 0 24 24" 
                fill="currentColor"
                className="w-4 h-4 opacity-60"
              >
                <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20M12.5,7V12.25L17,14.92L16.25,16.15L11,13V7H12.5Z"/>
              </svg>
              <span className="text-sm">
                {employee.getCurrentTime()} (local time)
              </span>
            </div>

            {/* Email */}
            <div className="flex items-center gap-2 text-white/60">
              <svg 
                width="16" 
                height="16" 
                viewBox="0 0 24 24" 
                fill="currentColor"
                className="w-4 h-4 opacity-60"
              >
                <path d="M20,8L12,13L4,8V6L12,11L20,6M20,4H4C2.89,4 2,4.89 2,6V18A2,2 0 0,0 4,20H20A2,2 0 0,0 22,18V6C22,4.89 21.1,4 20,4Z"/>
              </svg>
              <a
                href={`mailto:${employee.email}`}
                className="text-sm hover:text-white transition-colors"
              >
                {employee.email}
              </a>
            </div>

            {/* X (Twitter) */}
            {employee.social?.twitter && (
              <div className="flex items-center gap-2 text-white/60">
                <svg 
                  width="16" 
                  height="16" 
                  viewBox="0 0 24 24" 
                  fill="currentColor"
                  className="w-4 h-4 opacity-60"
                >
                  <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z"/>
                </svg>
                <a
                  href={employee.social.twitter}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm hover:text-white transition-colors"
                >
                  @{employee.social.twitter.split('/').pop()}
                </a>
              </div>
            )}
          </div>
        </HoverCard.Content>
      </HoverCard.Portal>
    </HoverCard.Root>
  );
}; 