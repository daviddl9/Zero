import {
  ChevronDown,
  CurvedArrow,
  GitHub,
  Plus,
  Cube,
  MediumStack,
  Clock,
  PanelLeftOpen,
  Check,
  Filter,
  Search,
  User,
  Lightning,
  ExclamationTriangle,
  Bell,
  Tag,
  GroupPeople,
  X,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Figma,
  Docx,
  ImageFile,
  Expand,
} from '../icons/icons';
import { PixelatedBackground, PixelatedLeft, PixelatedRight } from '@/components/home/pixelated-bg';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { signIn, useSession } from '@/lib/auth-client';
import { Link, useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { Balancer } from 'react-wrap-balancer';

import { useTheme } from 'next-themes';
import { motion } from 'motion/react';
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import Footer from './footer';
import React from 'react';


// Declare UnicornStudio as a global variable
declare global {
  interface Window {
    UnicornStudio: {
      addScene: (options: {
        elementId: string;
        fps?: number;
        scale?: number;
        dpi?: number;
        lazyLoad?: boolean;
        filePath?: string;
        altText?: string;
        ariaLabel?: string;
        interactivity?: {
          mouse?: {
            disableMobile?: boolean;
            disabled?: boolean;
          };
        };
      }) => Promise<any>;
      destroy: () => void;
    };
  }
}

const firstRowQueries: string[] = [
  'Show recent design feedback',
  'Reply to Nick',
  'Find invoice from Stripe',
];

const secondRowQueries: string[] = [
  'Schedule meeting with Sarah',
  'What did alex say about the design',
];

const tabs = [
  { label: 'Chat With Your Inbox', value: 'smart-categorization' },
  { label: 'Smart Labels', value: 'ai-features' },
  { label: 'Write Better Emails', value: 'feature-3' },
];

export default function HomeContent() {
  const { setTheme } = useTheme();
  const { data: session } = useSession();
  const navigate = useNavigate();
  const meshContainerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<any>(null);

  useEffect(() => {
    setTheme('dark');
  }, [setTheme]);

  useEffect(() => {
    // Prevent multiple initializations
    if (sceneRef.current) return;
    
    // Check if there's already a canvas in this container
    const existingCanvas = meshContainerRef.current?.querySelector('canvas');
    if (existingCanvas) return;

    // Check if script is already loaded
    const existingScript = document.querySelector('script[src*="unicornStudio.umd.js"]');
    
    if (existingScript) {
      // Script already exists, just initialize the scene
      if (window.UnicornStudio && meshContainerRef.current) {
        initializeScene();
      }
      return;
    }

    // Load Unicorn Studio script
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/gh/hiunicornstudio/unicornstudio.js@v1.4.29/dist/unicornStudio.umd.js';
    script.async = true;
    
    script.onload = () => {
      if (window.UnicornStudio && meshContainerRef.current && !sceneRef.current) {
        initializeScene();
      }
    };

    document.head.appendChild(script);

    function initializeScene() {
      // Double-check no scene exists before creating
      if (sceneRef.current) return;
      
      window.UnicornStudio.addScene({
        elementId: 'unicorn-mesh',
        fps: 60,
        scale: 1,
        dpi: 1.5,
        lazyLoad: false,
        filePath: '/mesh.json',
        altText: 'Interactive mesh background',
        ariaLabel: 'Animated mesh background effect',
        interactivity: {
          mouse: {
            disableMobile: false,
            disabled: false,
          },
        },
      })
      .then((scene) => {
        sceneRef.current = scene;
      })
      .catch((err) => {
        console.error('Failed to load Unicorn Studio scene:', err);
      });
    }

    // Cleanup function
    return () => {
      if (sceneRef.current) {
        sceneRef.current.destroy();
        sceneRef.current = null;
      }
    };
  }, []);

  return (
    <main className="relative flex flex-1 flex-col overflow-x-hidden bg-[#000000] px-2">
      <section className="mt-2 flex flex-col items-center px-4">
        <div className="hero-grid-border w-full max-w-[1200px] flex flex-col items-center">
          {/* Interactive mesh background */}
          <div 
            id="unicorn-mesh"
            ref={meshContainerRef}
            className="absolute inset-0 z-1 h-full opacity-50"
            style={{ pointerEvents: 'none' }}
            data-unicorn-container="true"
          />
          
          {/* All four corner plus signs */}
          <div className="corner-plus -top-[14px] -left-[14px]">+</div>
          <div className="corner-plus -top-[14px] -right-[14px]">+</div>
          <div className="corner-plus -bottom-[14px] -left-[14px]">+</div>
          <div className="corner-plus -bottom-[14px] -right-[14px]">+</div>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="relative z-10 my-8 inline-flex items-center justify-center gap-2 rounded-[10px] border border-white/15 bg-white/10 px-2 py-1 backdrop-blur-[20px]"
          >
          <Link to="https://www.ycombinator.com/launches/NTI-zero-ai-native-email" target="_blank" className="flex items-center gap-2 text-sm text-[#D4D4D4]">
            Backed by
            <span>
              <img
                src="/yc-small.svg"
                alt="Y Combinator"
                className="rounded-[2px]"
                width={16}
                height={16}
              />
            </span>
            Combinator
          </Link>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="relative z-10 text-center text-4xl font-medium md:text-6xl"
        >
          <Balancer className="mb-3 max-w-[1130px]">
            AI Powered Email, Built to Save You Time
          </Balancer>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="relative z-10 mx-auto mb-4 max-w-[498px] text-center text-sm font-normal leading-5 text-white/60"
        >
          Email hasn't changed in 20 years. It's bloated, chaotic, and slow. We rebuilt it from the ground up. Fast, focused, and powered by AI that actually helps.
        </motion.p>

        {/* Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="relative z-10 mb-8 flex justify-center gap-2.5"
        >
          <Button
            onClick={() => {
              if (session) {
                navigate('/mail/inbox');
              } else {
                toast.promise(
                  signIn.social({
                    provider: 'google',
                    callbackURL: `${window.location.origin}/mail`,
                  }),
                  {
                    error: 'Login redirect failed',
                  },
                );
              }
            }}
            className="bg-white text-[#262626] hover:bg-white/90"
          >
            Create a Free Account
          </Button>
          <Button
            variant="outline"
            className="border-white/10 bg-white/10 text-white backdrop-blur-[20px] hover:bg-white/20"
          >
            Watch Demo
          </Button>
        </motion.div>


        </div>
      </section>

      <section className="my-40 flex flex-col items-center px-4">
      </section>


     
    </main>
  );
}
