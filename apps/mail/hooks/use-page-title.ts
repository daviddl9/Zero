import { useEffect } from 'react';

export function usePageTitle(title: string) {
  useEffect(() => {
    const fullTitle = title ? `${title} - Zero` : 'Zero';
    document.title = fullTitle;
    
    // Cleanup function to reset title when component unmounts
    return () => {
      document.title = 'Zero';
    };
  }, [title]);
} 