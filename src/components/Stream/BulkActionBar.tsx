import { useMemo } from 'react';
import { User, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { ProfileBadge } from '@/components/Profile';
import { useAppStore } from '@/store/appStore';
import { useClearAllStaging, useBulkUpdateEntryProfile } from '@/hooks/useQueries';
import { devLog } from '@/lib/devLogger';
import type { Profile } from '@/types';

export function BulkActionBar() {
  const {
    entries,
    stagedEntryIds,
    profiles,
  } = useAppStore();

  const bulkUpdateEntryProfile = useBulkUpdateEntryProfile();
  const clearAllStaging = useClearAllStaging();

  const stagedEntries = useMemo(() => {
    return entries.filter((e) => stagedEntryIds.has(e.id));
  }, [entries, stagedEntryIds]);

  // Filter out AI blocks for the bulk change profile feature
  const userStagedEntries = useMemo(() => {
    return stagedEntries.filter(e => e.role === 'user');
  }, [stagedEntries]);

  const aiStagedCount = stagedEntries.length - userStagedEntries.length;

  if (stagedEntryIds.size === 0) return null;

  const handleBulkProfileChange = (profileId: string | null) => {
    const userSelectedIds = userStagedEntries.map(e => e.id);
    devLog.action('Bulk change entry profile', { 
        count: userSelectedIds.length, 
        profileId,
        ignoredAiCount: aiStagedCount 
    });
    
    // Update all user entries in one go
    bulkUpdateEntryProfile.mutate({ entryIds: userSelectedIds, profileId });
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-center gap-4 rounded-full border bg-background/95 p-2 pr-4 shadow-2xl backdrop-blur-md ring-1 ring-black/5 dark:ring-white/10">
        <div className="flex items-center gap-2 px-3 border-r h-8">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
            {stagedEntryIds.size}
          </span>
          <span className="text-xs font-medium">selected</span>
        </div>

        <div className="flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 gap-2 rounded-full px-3 text-xs"
                disabled={userStagedEntries.length === 0}
              >
                <User className="h-3.5 w-3.5" />
                Change Profile
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="w-56">
              <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Select Profile for {userStagedEntries.length} block{userStagedEntries.length !== 1 ? 's' : ''}
              </div>
              {aiStagedCount > 0 && (
                <div className="px-2 pb-1.5 text-[10px] text-amber-600 dark:text-amber-400 italic">
                  ({aiStagedCount} AI block{aiStagedCount !== 1 ? 's' : ''} will be ignored)
                </div>
              )}
              <DropdownMenuSeparator />
              {profiles.map((profile: Profile) => (
                <DropdownMenuItem
                  key={profile.id}
                  onClick={() => handleBulkProfileChange(profile.id)}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <ProfileBadge profile={profile} size="sm" />
                  <div className="flex flex-col flex-1">
                    <span className="text-sm font-medium">{profile.name}</span>
                    <span className="text-xs text-muted-foreground capitalize">{profile.role}</span>
                  </div>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => handleBulkProfileChange(null)}
                className="text-muted-foreground cursor-pointer"
              >
                Remove profiles
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button 
            variant="ghost" 
            size="sm" 
            className="h-8 gap-2 rounded-full px-3 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
            onClick={() => {
                devLog.action('Bulk deselect', { count: stagedEntryIds.size });
                clearAllStaging.mutate();
            }}
          >
            <X className="h-3.5 w-3.5" />
            Deselect All
          </Button>
        </div>
      </div>
    </div>
  );
}
