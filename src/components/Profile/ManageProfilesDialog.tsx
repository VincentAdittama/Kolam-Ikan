import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useProfiles, useDeleteProfile, useDefaultProfile } from '@/hooks/useQueries';
import * as api from '@/services/api';
import { ProfileBadge } from './ProfileBadge';
import { ProfileFormDialog } from './ProfileFormDialog';
import { Pencil, Plus, Trash2, AlertTriangle } from 'lucide-react';
import type { Profile } from '@/types';
import { useAppStore } from '@/store/appStore';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';

interface ManageProfilesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ManageProfilesDialog({
  open,
  onOpenChange,
}: ManageProfilesDialogProps) {
  const { profiles } = useAppStore();
  const deleteProfile = useDeleteProfile();
  
  // Need to ensure profiles are loaded
  useProfiles();
  const { data: defaultProfile } = useDefaultProfile();

  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [showFormDialog, setShowFormDialog] = useState(false);

  const [profileToDelete, setProfileToDelete] = useState<string | null>(null);
  const [entriesCount, setEntriesCount] = useState<number>(0);
  const [reassignProfileId, setReassignProfileId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [checkingCount, setCheckingCount] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Set default reassign profile to system default if available
  useEffect(() => {
    if (defaultProfile && !reassignProfileId && !profileToDelete) {
       setReassignProfileId(defaultProfile.id);
    }
  }, [defaultProfile, reassignProfileId, profileToDelete]);

  const handleCreateClick = () => {
    setEditingProfile(null);
    setShowFormDialog(true);
  };

  const handleEditClick = (profile: Profile) => {
    setEditingProfile(profile);
    setShowFormDialog(true);
  };

  const handleDeleteClick = async (profileId: string) => {
    setCheckingCount(true);
    setError(null);
    try {
      const count = await api.getProfileEntryCount(profileId);
      setEntriesCount(count);
      setProfileToDelete(profileId);
      // Reset reassign selection to default (or first available other than deleted)
      const otherProfile = profiles.find(p => p.id !== profileId && p.isDefault) 
                        || profiles.find(p => p.id !== profileId);
      if (otherProfile) {
        console.log("DEBUG: Setting reassignProfileId to", otherProfile.id);
        setReassignProfileId(otherProfile.id);
      } else {
        setReassignProfileId(null);
      }
    } catch (error: any) {
      console.error("Failed to check profile entries:", error);
      setError(error.message || "Failed to check associated entries.");
    } finally {
      setCheckingCount(false);
    }
  };

  const confirmDelete = async () => {
    if (!profileToDelete) return;
    
    setIsDeleting(true);
    console.log("DEBUG: confirmDelete payload " + JSON.stringify({
      profileId: profileToDelete,
      entriesCount,
      reassignProfileId
    }));
    try {
      await deleteProfile.mutateAsync({
        profileId: profileToDelete,
        reassignToId: entriesCount > 0 && reassignProfileId ? reassignProfileId : undefined
      });
      setProfileToDelete(null);
    } catch (error: any) {
      console.error("Failed to delete profile:", error);
      setError(error.message || "Failed to delete profile. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  const profileToDeleteObj = profiles.find(p => p.id === profileToDelete);
  const availableProfiles = profiles.filter(p => p.id !== profileToDelete);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md md:max-w-lg">
          <DialogHeader>
            <DialogTitle>Manage Profiles</DialogTitle>
            <DialogDescription>
              Create, edit, or remove profiles used in your stories.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-4 h-[60vh]">
            <div className="flex justify-end">
              <Button onClick={handleCreateClick} size="sm" className="gap-1">
                <Plus className="h-4 w-4" />
                New Profile
              </Button>
            </div>
            
            <ScrollArea className="flex-1 rounded-md border p-2">
              <div className="space-y-2">
                {profiles.length === 0 && (
                   <div className="text-center py-8 text-muted-foreground">
                     No profiles found.
                   </div>
                )}
                {profiles.map((profile) => (
                  <div
                    key={profile.id}
                    className="flex items-center justify-between p-2 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <ProfileBadge profile={profile} />
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{profile.name}</span>
                          {profile.isDefault && (
                             <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">Default</span>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground capitalize">
                          {profile.role}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={() => handleEditClick(profile)}
                      >
                        <Pencil className="h-4 w-4" />
                        <span className="sr-only">Edit</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDeleteClick(profile.id)}
                        disabled={profile.isDefault || isDeleting || checkingCount}
                        title={profile.isDefault ? "Cannot delete default profile" : "Delete profile"}
                      >
                        {checkingCount && profileToDelete === profile.id ? (
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                        <span className="sr-only">Delete</span>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Delete Confirmation Dialog */}
       <Dialog open={!!profileToDelete} onOpenChange={(open) => !open && !isDeleting && setProfileToDelete(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Delete Profile
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{profileToDeleteObj?.name}</strong>?
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
             {error && (
               <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-md">
                 {error}
               </div>
             )}
             {entriesCount > 0 ? (
               <div className="p-4 bg-muted/50 rounded-lg space-y-3">
                 <div className="text-sm font-medium">
                   This profile is used in <span className="text-primary">{entriesCount}</span> entries.
                 </div>
                 <div className="text-sm text-muted-foreground">
                   You must reassign these entries to another profile before deleting.
                 </div>
                 
                 <div className="space-y-1.5 pt-2">
                   <Label>Reassign to</Label>
                   <Select 
                     value={reassignProfileId || undefined} 
                     onValueChange={(val) => setReassignProfileId(val)}
                   >
                      <SelectTrigger>
                        <SelectValue placeholder="Select profile..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableProfiles.map(p => (
                          <SelectItem key={p.id} value={p.id}>
                            <div className="flex items-center gap-2">
                              <ProfileBadge profile={p} size="sm" />
                              <span>{p.name}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                   </Select>
                 </div>
               </div>
             ) : (
               <p className="text-sm text-muted-foreground">
                 This action cannot be undone. The profile will be permanently removed.
               </p>
             )}
          </div>

          <div className="flex justify-end gap-2 mt-2">
            <Button variant="ghost" onClick={() => setProfileToDelete(null)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={confirmDelete}
              disabled={isDeleting || (entriesCount > 0 && !reassignProfileId)}
            >
              {isDeleting ? "Deleting..." : "Delete Profile"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Form Dialog nested here */}
      <ProfileFormDialog
        open={showFormDialog}
        onOpenChange={setShowFormDialog}
        initialProfile={editingProfile || undefined}
        onProfileSaved={() => {
           // List updates automatically via query invalidation
        }}
      />
    </>
  );
}
