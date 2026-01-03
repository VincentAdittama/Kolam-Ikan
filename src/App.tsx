import { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Sidebar } from "@/components/Layout/Sidebar";
import { MainView } from "@/components/Layout/MainView";
import { RightPanel } from "@/components/Layout/RightPanel";
import { useAppStore } from "@/store/appStore";
import { cn } from "@/lib/utils";
import "./App.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 minute
      refetchOnWindowFocus: false,
    },
  },
});

function AppLayout() {
  const { sidebarVisible, rightPanelVisible, theme } = useAppStore();

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
      {/* Sidebar */}
      <div
        className={cn(
          "transition-all duration-300",
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
          "transition-all duration-300",
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
