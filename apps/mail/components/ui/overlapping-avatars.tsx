import React from 'react';
import { getAllEmployees, Employee } from '@/data/employees';
import { EmployeeHoverCard } from './employee-hover-card';

interface OverlappingAvatarsProps {
  maxDisplay?: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const OverlappingAvatars: React.FC<OverlappingAvatarsProps> = ({
  maxDisplay = 6,
  size = 'md',
  className = ''
}) => {
  const allEmployees = getAllEmployees();
  const displayEmployees = allEmployees.slice(0, maxDisplay);
  const remainingCount = Math.max(0, allEmployees.length - maxDisplay);

  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16'
  };

  const offsetClasses = {
    sm: '-ml-2',
    md: '-ml-3',
    lg: '-ml-4'
  };

  return (
    <div className={`flex items-center ${className}`}>
      {displayEmployees.map((employee, index) => (
        <EmployeeHoverCard key={employee.id} employee={employee}>
          <div
            className={`
              ${sizeClasses[size]} 
              ${index > 0 ? offsetClasses[size] : ''} 
              relative rounded-full border-2 border-white dark:border-gray-900 
              overflow-hidden cursor-pointer transition-transform hover:scale-110 hover:z-10
              bg-white dark:bg-gray-900 shadow-lg
            `}
            style={{ zIndex: displayEmployees.length - index }}
          >
            <img
              src={employee.profileImage}
              alt={employee.fullName}
              className="w-full h-full object-cover"
            />
          </div>
        </EmployeeHoverCard>
      ))}
      
      {remainingCount > 0 && (
        <div
          className={`
            ${sizeClasses[size]} 
            ${offsetClasses[size]} 
            relative rounded-full border-2 border-white dark:border-gray-900 
            bg-gray-100 dark:bg-gray-800 
            flex items-center justify-center text-xs font-medium text-gray-600 dark:text-gray-300
            shadow-lg
          `}
          style={{ zIndex: 0 }}
        >
          +{remainingCount}
        </div>
      )}
    </div>
  );
};

export default OverlappingAvatars; 