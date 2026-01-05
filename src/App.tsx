import { useEffect, useCallback, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { platform } from '@tauri-apps/plugin-os';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Sidebar } from "@/components/Layout/Sidebar";
import { MainView } from "@/components/Layout/MainView";
import { RightPanel } from "@/components/Layout/RightPanel";
import { useAppStore } from "@/store/appStore";
import { AuthView } from "@/components/Auth/AuthView";
import { supabase } from "@/lib/supabase";
import { useProfiles, useDefaultProfile } from "@/hooks/useQueries";
import { cn } from "@/lib/utils";
import "./App.css";
import 'tippy.js/dist/tippy.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 minute
      refetchOnWindowFocus: false,
    },
  },
});

function AppLayout() {
  const { 
    sidebarVisible, 
    rightPanelVisible, 
    theme, 
    setDragRegionHeight, 
    dragRegionHeight,
    isAuthenticated,
    setUser
  } = useAppStore();
  const [isMacos, setIsMacos] = useState(false);
  
  // Auth listener
  useEffect(() => {
    // Initial check
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setUser(session.user, session);
      }
    });

    // Listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setUser(session.user, session);
      } else {
        // We don't necessarily want to force logout to default-user here 
        // if they are intentionally using local-only, but for now let's be strict
      }
    });

    return () => subscription.unsubscribe();
  }, [setUser]);
  
  // Load profiles on app startup
  useProfiles();
  useDefaultProfile();

  // Set drag region height based on OS
  useEffect(() => {
    const initDragRegionHeight = async () => {
      try {
        // Check if running in Tauri before calling platform logic
        // This prevents the "platform is undefined" error on web
        const isTauri = typeof window !== 'undefined' && !!(window as any).__TAURI_INTERNALS__;
        
        if (!isTauri) {
             throw new Error("Not in Tauri environment");
        }

        const os = await platform();
        const isMac = os === 'macos';
        setIsMacos(isMac);
        
        // Always use 53px height as requested by user
        setDragRegionHeight(53);
        
        // Dynamically set traffic light width variable
        document.documentElement.style.setProperty(
          '--macos-traffic-light-width', 
          isMac ? '90px' : '0px'
        );

      } catch (error) {
        // Fallback for development (web) or when plugin is not available
        console.warn('Failed to detect OS, using default (web) configuration:', error);
        setIsMacos(false);
        setDragRegionHeight(53); // Always 53px
        
        // Ensure traffic light width is 0 for web defaults
        document.documentElement.style.setProperty('--macos-traffic-light-width', '0px');
      }
    };
    initDragRegionHeight();
  }, [setDragRegionHeight]);

  // ══════════════════════════════════════════════════════════════════════
  // SMART WINDOW DRAG - Only drag when clicking empty space in header area
  // ══════════════════════════════════════════════════════════════════════
  // This allows clicks on buttons, inputs, etc. to work normally while
  // still enabling window dragging from empty header space.
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Only enable dragging on macOS
    if (!isMacos) return;

    // Only trigger in the drag region height
    if (e.clientY > dragRegionHeight) return;
    
    // Don't drag if clicking on interactive elements
    const target = e.target as HTMLElement;
    const interactiveSelector = 'button, a, input, textarea, select, [role="button"], [role="menuitem"], [data-no-drag]';
    if (target.closest(interactiveSelector)) return;
    
    // Start native window drag
    e.preventDefault();
    getCurrentWindow().startDragging();
  }, [dragRegionHeight, isMacos]);

  useEffect(() => {
    const root = window.document.documentElement;

    const applyTheme = (isDark: boolean) => {
      if (isDark) {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
    };

    if (theme === "system") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      applyTheme(mediaQuery.matches);

      const handleChange = (e: MediaQueryListEvent) => {
        applyTheme(e.matches);
      };

      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    } else {
      applyTheme(theme === "dark");
    }
  }, [theme]);

    if (!isAuthenticated) {
    return <AuthView />;
  }

  return (
    <div 
      className="flex h-screen w-full overflow-hidden bg-background text-foreground relative"
      onMouseDown={handleMouseDown}
    >
      {/* Sidebar */}
      <div
        className={cn(
          "relative shrink-0 overflow-hidden transition-[width] duration-300 ease-in-out",
          sidebarVisible ? "w-[280px]" : "w-0"
        )}
      >
        <div 
          className={cn(
            "h-full w-[280px] transition-transform duration-300 ease-in-out",
            sidebarVisible ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <Sidebar />
        </div>
      </div>

      {/* Main View */}
      <MainView />

      {/* Right Panel */}
      <div
        className={cn(
          "relative shrink-0 overflow-hidden transition-[width] duration-300 ease-in-out",
          rightPanelVisible ? "w-[320px]" : "w-0"
        )}
      >
        <div
          className={cn(
            "h-full w-[320px] transition-transform duration-300 ease-in-out border-l",
            rightPanelVisible ? "translate-x-0" : "translate-x-full"
          )}
        >
          <RightPanel />
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={300}>
        <AppLayout />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
