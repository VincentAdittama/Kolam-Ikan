import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCreateProfile, useUpdateProfile } from '@/hooks/useQueries';
import { PROFILE_COLORS, type Profile, type ProfileRole } from '@/types';
import { cn } from '@/lib/utils';

interface ProfileFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProfileSaved?: (profile: Profile) => void;
  initialProfile?: Profile;
}

export function ProfileFormDialog({
  open,
  onOpenChange,
  onProfileSaved,
  initialProfile,
}: ProfileFormDialogProps) {
  const isEditing = !!initialProfile;

  const [name, setName] = useState('');
  const [role, setRole] = useState<ProfileRole>('friend');
  const [color, setColor] = useState(PROFILE_COLORS[1]); 
  const [initials, setInitials] = useState('');
  const [bio, setBio] = useState('');

  const createProfile = useCreateProfile();
  const updateProfile = useUpdateProfile();

  // Reset or initialize form when dialog opens or initialProfile changes
  useEffect(() => {
    if (open) {
      if (initialProfile) {
        setName(initialProfile.name);
        setRole(initialProfile.role);
        setColor(initialProfile.color || PROFILE_COLORS[1]);
        setInitials(initialProfile.initials || '');
        setBio(initialProfile.bio || '');
      } else {
        // Reset defaults for create mode
        setName('');
        setRole('friend');
        setColor(PROFILE_COLORS[1]);
        setInitials('');
        setBio('');
      }
    }
  }, [open, initialProfile]);

  // Auto-generate initials from name
  const handleNameChange = (value: string) => {
    setName(value);
    // Only auto-generate if user hasn't manually set initials (or if it matches auto-generated)
    // For simplicity in edit mode, we might not want to overwrite existing initials unless empty
    if (!initials || (!isEditing && initials === generateInitials(name))) {
       setInitials(generateInitials(value));
    } else if (isEditing && initials === generateInitials(initialProfile?.name || '')) {
       // If editing and initials matched previous name, update them
       setInitials(generateInitials(value));
    }
  };

  const generateInitials = (name: string) => {
    return name
      .split(/\s+/)
      .filter(Boolean)
      .map((word) => word[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  const handleSave = async () => {
    if (!name.trim()) return;

    try {
      let savedProfile: Profile;

      if (isEditing && initialProfile) {
        await updateProfile.mutateAsync({
          profileId: initialProfile.id,
          input: {
            name: name.trim(),
            role,
            color,
            initials: initials || generateInitials(name),
            bio: bio.trim() || undefined,
          },
        });
        // We don't get the updated profile back from updateProfile mutation result usually 
        // unless we fetch it or the API returns it. 
        // Assuming optimistic update or invalidation handles it.
        // But let's construct it for callback if needed, or rely on invalidation.
        savedProfile = { ...initialProfile, 
            name: name.trim(), 
            role, 
            color, 
            initials: initials || generateInitials(name),
            bio: bio.trim() || undefined,
            updatedAt: Date.now()
        };
      } else {
        savedProfile = await createProfile.mutateAsync({
          name: name.trim(),
          role,
          color,
          initials: initials || generateInitials(name),
          bio: bio.trim() || undefined,
        });
      }
      
      onProfileSaved?.(savedProfile);
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to save profile:', error);
    }
  };

  const isPending = createProfile.isPending || updateProfile.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Profile' : 'Create New Profile'}</DialogTitle>
          <DialogDescription>
            {isEditing 
              ? 'Update profile details.' 
              : 'Create a profile to track contributions from different voices and perspectives.'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Name */}
          <div className="grid gap-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              placeholder="Alice Zhou"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
            />
          </div>

          {/* Role */}
          <div className="grid gap-2">
            <Label htmlFor="role">Type</Label>
            <Select value={role} onValueChange={(v) => setRole(v as ProfileRole)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="friend">Friend / Colleague</SelectItem>
                <SelectItem value="reference">Reference Source</SelectItem>
                <SelectItem value="self">Another version of yourself</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Initials & Color */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="initials">Initials</Label>
              <Input
                id="initials"
                placeholder="AZ"
                maxLength={2}
                value={initials}
                onChange={(e) => setInitials(e.target.value.toUpperCase())}
              />
            </div>
            <div className="grid gap-2">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-1">
                {PROFILE_COLORS.slice(0, 10).map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={cn(
                      'h-6 w-6 rounded-full transition-all',
                      color === c ? 'ring-2 ring-offset-2 ring-primary' : 'hover:scale-110'
                    )}
                    style={{ backgroundColor: c }}
                    onClick={() => setColor(c)}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-full text-white font-semibold"
              style={{ backgroundColor: color }}
            >
              {initials || generateInitials(name) || '??'}
            </div>
            <div className="flex flex-col">
              <span className="font-medium">{name || 'Profile Name'}</span>
              <span className="text-xs text-muted-foreground capitalize">{role}</span>
            </div>
          </div>

          {/* Bio */}
          <div className="grid gap-2">
            <Label htmlFor="bio">Bio (optional)</Label>
            <Textarea
              id="bio"
              placeholder="My college friend who studies philosophy..."
              value={bio}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setBio(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!name.trim() || isPending}
          >
            {isPending ? 'Saving...' : (isEditing ? 'Save Changes' : 'Create Profile')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
