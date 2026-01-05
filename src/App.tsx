import { useEffect, useCallback } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { platform } from '@tauri-apps/plugin-os';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Sidebar } from "@/components/Layout/Sidebar";
import { MainView } from "@/components/Layout/MainView";
import { RightPanel } from "@/components/Layout/RightPanel";
import { useAppStore } from "@/store/appStore";
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
  const { sidebarVisible, rightPanelVisible, theme, setDragRegionHeight, dragRegionHeight } = useAppStore();
  
  // Load profiles on app startup
  useProfiles();
  useDefaultProfile();

  // Set drag region height based on OS
  useEffect(() => {
    const initDragRegionHeight = async () => {
      try {
        const os = await platform();
        const height = os === 'macos' ? 53 : 32;
        setDragRegionHeight(height);
      } catch (error) {
        // Fallback for development or when plugin is not available
        console.warn('Failed to detect OS, using default height:', error);
        setDragRegionHeight(53); // Default to macOS height
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
    // Only trigger in the drag region height
    if (e.clientY > dragRegionHeight) return;
    
    // Don't drag if clicking on interactive elements
    const target = e.target as HTMLElement;
    const interactiveSelector = 'button, a, input, textarea, select, [role="button"], [role="menuitem"], [data-no-drag]';
    if (target.closest(interactiveSelector)) return;
    
    // Start native window drag
    e.preventDefault();
    getCurrentWindow().startDragging();
  }, [dragRegionHeight]);

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

  return (
    <div 
      className="flex h-screen w-full overflow-hidden bg-background text-foreground relative"
      onMouseDown={handleMouseDown}
    >
      {/* Sidebar */}
      <div
        className={cn(
          "transition-all duration-300 relative shrink-0",
          sidebarVisible ? "w-[280px]" : "w-0 overflow-hidden"
        )}
      >
        <Sidebar />
      </div>

      {/* Main View */}
      <MainView />

      {/* Right Panel */}
      <div
        className={cn(
          "transition-all duration-300 relative shrink-0",
          rightPanelVisible ? "w-[320px]" : "w-0 overflow-hidden"
        )}
      >
        <RightPanel />
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
