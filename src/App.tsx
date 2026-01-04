import { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Sidebar } from "@/components/Layout/Sidebar";
import { MainView } from "@/components/Layout/MainView";
import { RightPanel } from "@/components/Layout/RightPanel";
import { useAppStore } from "@/store/appStore";
import { useProfiles, useDefaultProfile } from "@/hooks/useQueries";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PanelLeft, PanelRight } from "lucide-react";
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
  const { sidebarVisible, rightPanelVisible, theme, toggleSidebar, toggleRightPanel } = useAppStore();
  
  // Load profiles on app startup
  useProfiles();
  useDefaultProfile();

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
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      {/* Left Sidebar Toggle Button (visible when sidebar collapsed) */}
      <div
        className={cn(
          "absolute left-0 top-0 z-50 transition-all duration-300",
          sidebarVisible ? "opacity-0 pointer-events-none -translate-x-2" : "opacity-100 translate-x-0"
        )}
      >
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className="m-2 h-8 w-8 bg-background/80 backdrop-blur border shadow-sm hover:bg-accent"
          title="Show Sidebar"
        >
          <PanelLeft className="h-4 w-4" />
        </Button>
      </div>

      {/* Sidebar */}
      <div
        className={cn(
          "transition-all duration-300 relative shrink-0",
          sidebarVisible ? "w-[280px]" : "w-0 overflow-hidden"
        )}
      >
        <Sidebar />
        {/* Toggle button inside sidebar */}
        {sidebarVisible && (
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            className="absolute right-2 top-3 h-6 w-6 opacity-0 hover:opacity-100 transition-opacity"
            title="Hide Sidebar"
          >
            <PanelLeft className="h-3.5 w-3.5" />
          </Button>
        )}
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
        {/* Toggle button inside right panel */}
        {rightPanelVisible && (
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleRightPanel}
            className="absolute left-2 top-3 h-6 w-6 opacity-0 hover:opacity-100 transition-opacity z-10"
            title="Hide Right Panel"
          >
            <PanelRight className="h-3.5 w-3.5" />
          </Button>
        )}
        <RightPanel />
      </div>

      {/* Right Panel Toggle Button (visible when right panel collapsed) */}
      <div
        className={cn(
          "absolute right-0 top-0 z-50 transition-all duration-300",
          rightPanelVisible ? "opacity-0 pointer-events-none translate-x-2" : "opacity-100 translate-x-0"
        )}
      >
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleRightPanel}
          className="m-2 h-8 w-8 bg-background/80 backdrop-blur border shadow-sm hover:bg-accent"
          title="Show Right Panel"
        >
          <PanelRight className="h-4 w-4" />
        </Button>
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
