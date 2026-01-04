import { useState } from 'react';
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
import { useCreateProfile } from '@/hooks/useQueries';
import { PROFILE_COLORS, type Profile, type ProfileRole } from '@/types';
import { cn } from '@/lib/utils';

interface CreateProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProfileCreated?: (profile: Profile) => void;
}

export function CreateProfileDialog({
  open,
  onOpenChange,
  onProfileCreated,
}: CreateProfileDialogProps) {
  const [name, setName] = useState('');
  const [role, setRole] = useState<ProfileRole>('friend');
  const [color, setColor] = useState(PROFILE_COLORS[1]); // Start with second color (pink)
  const [initials, setInitials] = useState('');
  const [bio, setBio] = useState('');

  const createProfile = useCreateProfile();

  // Auto-generate initials from name
  const handleNameChange = (value: string) => {
    setName(value);
    if (!initials || initials === generateInitials(name)) {
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

  const handleCreate = async () => {
    if (!name.trim()) return;

    try {
      const profile = await createProfile.mutateAsync({
        name: name.trim(),
        role,
        color,
        initials: initials || generateInitials(name),
        bio: bio.trim() || undefined,
      });
      
      // Reset form
      setName('');
      setRole('friend');
      setColor(PROFILE_COLORS[1]);
      setInitials('');
      setBio('');
      
      onProfileCreated?.(profile);
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to create profile:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Profile</DialogTitle>
          <DialogDescription>
            Create a profile to track contributions from different voices and perspectives.
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
            onClick={handleCreate}
            disabled={!name.trim() || createProfile.isPending}
          >
            {createProfile.isPending ? 'Creating...' : 'Create Profile'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
