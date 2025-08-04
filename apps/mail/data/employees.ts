export interface Employee {
  id: string;
  fullName: string;
  role: string;
  location: {
    city: string;
    country: string;
  };
  timezone: string;
  getCurrentTime: () => string;
  email: string;
  profileImage: string;
  social: {
    twitter?: string;
    linkedin?: string;
    github?: string;
  };
}

export const employees: Record<string, Employee> = {
  "nizzy-abi-zaher": {
    id: "nizzy-abi-zaher",
    fullName: "Nizzy Abi Zaher",
    role: "CEO & Co-Founder",
    location: {
      city: "San Francisco",
      country: "CA"
    },
    timezone: "America/Los_Angeles",
    getCurrentTime: () => new Date().toLocaleTimeString("en-US", { timeZone: "America/Los_Angeles", hour: 'numeric', minute: '2-digit', hour12: true }),
    email: "nizzy@0.email",
    profileImage: "/team/nizzy.jpg",
    social: {
      twitter: "https://twitter.com/nizzyabi",
      linkedin: "https://linkedin.com/in/nizzy",
      github: "https://github.com/nizzy"
    }
  },
  
  "adam-wazzan": {
    id: "adam-wazzan",
    fullName: "Adam Wazzan",
    role: "CTO & Co-Founder",
    location: {
      city: "Vancouver",
      country: "BC"
    },
    timezone: "America/Vancouver",
    getCurrentTime: () => new Date().toLocaleTimeString("en-US", { timeZone: "America/Vancouver", hour: 'numeric', minute: '2-digit', hour12: true }),
    email: "1@0.email",
    profileImage: "/team/adam.jpg",
    social: {
      twitter: "https://twitter.com/cmdhaus",
      linkedin: "https://linkedin.com/in/adamwazzan",
      github: "https://github.com/adamwazzan"
    }
  },

  "ahmet-kilinc": {
    id: "ahmet-kilinc",
    fullName: "Ahmet Kilinc",
    role: "Founding Engineer",
    location: {
      city: "Istanbul", // Update with actual location
      country: "Turkey"
    },
    timezone: "Europe/Istanbul", // Update with actual timezone
    getCurrentTime: () => new Date().toLocaleTimeString("en-US", { timeZone: "Europe/Istanbul", hour: 'numeric', minute: '2-digit', hour12: true }),
    email: "ahmet@0.email",
    profileImage: "/team/ahmet.jpg",
    social: {
      twitter: "https://twitter.com/bruvimtired",
      linkedin: "https://linkedin.com/in/ahmetkilinc",
      github: "https://github.com/ahmetkilinc"
    }
  },

  "amrit-rai": {
    id: "amrit-rai",
    fullName: "Amrit Rai",
    role: "Founding Engineer",
    location: {
      city: "Maharashtra",
      country: "India"
    },
    timezone: "Asia/Kolkata",
    getCurrentTime: () => new Date().toLocaleTimeString("en-US", { timeZone: "Asia/Kolkata", hour: 'numeric', minute: '2-digit', hour12: true }),
    email: "amrit@0.email",
    profileImage: "/team/amrit.jpg",
    social: {
      twitter: "https://twitter.com/amritwt",
      linkedin: "https://linkedin.com/in/amritrai",
      github: "https://github.com/amritrai"
    }
  },

  "adam-gaida": {
    id: "adam-gaida",
    fullName: "Adam Gaida",
    role: "Intern",
    location: {
      city: "Dubai",
      country: "UAE"
    },
    timezone: "Asia/Dubai",
    getCurrentTime: () => new Date().toLocaleTimeString("en-US", { timeZone: "Asia/Dubai", hour: 'numeric', minute: '2-digit', hour12: true }),
    email: "adamg@0.email",
    profileImage: "/team/adamg.jpg",
    social: {
      twitter: "https://twitter.com/adamghaida",
      linkedin: "https://linkedin.com/in/adamgaida",
      github: "https://github.com/adamgaida"
    }
  },

  "aaron-mahlke": {
    id: "aaron-mahlke",
    fullName: "Aaron Mahlke",
    role: "Founding Design Engineer",
    location: {
      city: "Berlin", // Update with actual location
      country: "Germany"
    },
    timezone: "Europe/Berlin", // Update with actual timezone
    getCurrentTime: () => new Date().toLocaleTimeString("en-US", { timeZone: "Europe/Berlin", hour: 'numeric', minute: '2-digit', hour12: true }),
    email: "aaron@0.email",
    profileImage: "/team/aaron.jpg",
    social: {
      twitter: "https://twitter.com/aaronmahlke",
      linkedin: "https://linkedin.com/in/aaronmahlke",
      github: "https://github.com/aaronmahlke"
    }
      },

    "zero-team": {
    id: "zero-team",
    fullName: "Zero Team",
    role: "Engineering Team",
    location: {
      city: "Remote",
      country: "Global"
    },
    timezone: "UTC",
    getCurrentTime: () => new Date().toLocaleTimeString("en-US", { timeZone: "UTC", hour: 'numeric', minute: '2-digit', hour12: true }) + " UTC",
    email: "team@0.email",
    profileImage: "/team/nizzy.jpg", // Using Nizzy's image as fallback for team
    social: {
      twitter: "https://twitter.com/zeromail",
      github: "https://github.com/zeromail"
    }
  }
};

// Helper functions
export const getEmployeeById = (id: string): Employee | undefined => {
  return employees[id];
};

export const getEmployeeByName = (name: string): Employee | undefined => {
  return Object.values(employees).find(emp => 
    emp.fullName.toLowerCase().includes(name.toLowerCase())
  );
};

export const getAllEmployees = (): Employee[] => {
  return Object.values(employees);
};

export const getEmployeesByRole = (role: string): Employee[] => {
  return Object.values(employees).filter(emp => 
    emp.role.toLowerCase().includes(role.toLowerCase())
  );
};

// Team collections for easy reference
export const teams = {
  leadership: ["nizzy-abi-zaher", "adam-wazzan"],
  engineering: ["nizzy-abi-zaher", "adam-wazzan", "ahmet-kilinc", "amrit-rai", "adam-gaida", "aaron-mahlke"],
  design: ["aaron-mahlke"],
  marketing: ["adam-gaida"],
  all: Object.keys(employees)
};

export default employees; 