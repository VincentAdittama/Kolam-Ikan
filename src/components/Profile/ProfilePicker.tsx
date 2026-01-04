import { useState } from 'react';
import { Check, ChevronDown, Plus, User, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ProfileBadge } from './ProfileBadge';
import { ProfileFormDialog } from './ProfileFormDialog';
import { ManageProfilesDialog } from './ManageProfilesDialog';
import { useAppStore } from '@/store/appStore';
import { useProfiles, useDefaultProfile } from '@/hooks/useQueries';
import type { Profile } from '@/types';
import { cn } from '@/lib/utils';

interface ProfilePickerProps {
  selectedProfileId?: string | null;
  onProfileSelect: (profile: Profile) => void;
  className?: string;
  showCreateButton?: boolean;
}

export function ProfilePicker({
  selectedProfileId,
  onProfileSelect,
  className,
  showCreateButton = true,
}: ProfilePickerProps) {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showManageDialog, setShowManageDialog] = useState(false);
  const { profiles, defaultProfile, activeProfileId } = useAppStore();
  
  // Fetch profiles on mount
  useProfiles();
  useDefaultProfile();

  // Use the selectedProfileId if provided, otherwise fall back to activeProfileId
  const currentProfileId = selectedProfileId ?? activeProfileId;
  const currentProfile = profiles.find(p => p.id === currentProfileId) || defaultProfile;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className={cn(
              'flex items-center gap-2 h-auto py-1 px-2',
              className
            )}
          >
            {currentProfile ? (
              <ProfileBadge profile={currentProfile} size="sm" showName />
            ) : (
              <>
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted">
                  <User className="h-4 w-4 text-muted-foreground" />
                </div>
                <span className="text-sm text-muted-foreground">Select Profile</span>
              </>
            )}
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          {profiles.map((profile) => (
            <DropdownMenuItem
              key={profile.id}
              onClick={() => onProfileSelect(profile)}
              className="flex items-center gap-2 cursor-pointer"
            >
              <ProfileBadge profile={profile} size="sm" />
              <div className="flex flex-col flex-1">
                <span className="text-sm font-medium">{profile.name}</span>
                <span className="text-xs text-muted-foreground capitalize">
                  {profile.role}
                </span>
              </div>
              {profile.id === currentProfileId && (
                <Check className="h-4 w-4 text-primary" />
              )}
            </DropdownMenuItem>
          ))}
          
          {showCreateButton && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setShowCreateDialog(true)}
                className="flex items-center gap-2 cursor-pointer text-muted-foreground"
              >
                <Plus className="h-4 w-4" />
                <span>Create New Profile</span>
              </DropdownMenuItem>
            </>
          )}
          
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setShowManageDialog(true)}
            className="flex items-center gap-2 cursor-pointer text-muted-foreground"
          >
            <Settings className="h-4 w-4" />
            <span>Manage Profiles</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ManageProfilesDialog 
        open={showManageDialog} 
        onOpenChange={setShowManageDialog} 
      />

      <ProfileFormDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onProfileSaved={(profile: Profile) => {
          onProfileSelect(profile);
          setShowCreateDialog(false);
        }}
      />
    </>
  );
}
