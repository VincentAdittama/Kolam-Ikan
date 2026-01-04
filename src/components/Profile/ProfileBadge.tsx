import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { Profile, ProfileRole } from '@/types';

interface ProfileBadgeProps {
  profile: Profile;
  size?: 'sm' | 'md' | 'lg';
  showName?: boolean;
  showRole?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: 'h-6 w-6 text-xs',
  md: 'h-8 w-8 text-sm',
  lg: 'h-10 w-10 text-base',
};

const roleLabels: Record<ProfileRole, string> = {
  self: 'You',
  friend: 'Friend',
  reference: 'Reference',
  ai: 'AI',
};

const roleBorderStyles: Record<ProfileRole, string> = {
  self: 'border-2 border-solid',
  friend: 'border-2 border-dashed',
  reference: 'border-2 border-dotted',
  ai: 'border-2 border-solid bg-gradient-to-br from-primary/20 to-secondary/20',
};

export function ProfileBadge({
  profile,
  size = 'md',
  showName = false,
  showRole = false,
  className,
}: ProfileBadgeProps) {
  const initials = profile.initials || profile.name.slice(0, 2).toUpperCase();
  const backgroundColor = profile.color || '#3B82F6';
  
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={cn('flex items-center gap-2', className)}>
          <div
            className={cn(
              'flex items-center justify-center rounded-full font-semibold text-white shrink-0',
              sizeClasses[size],
              roleBorderStyles[profile.role as ProfileRole]
            )}
            style={{ 
              backgroundColor,
              borderColor: backgroundColor,
            }}
          >
            {initials}
          </div>
          
          {showName && (
            <div className="flex flex-col">
              <span className="text-sm font-medium leading-tight">
                {profile.name}
              </span>
              {showRole && (
                <span className="text-xs text-muted-foreground leading-tight">
                  {roleLabels[profile.role as ProfileRole]}
                </span>
              )}
            </div>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent side="right" className="max-w-xs">
        <div className="flex flex-col gap-1">
          <span className="font-medium">{profile.name}</span>
          <span className="text-xs text-muted-foreground">
            {roleLabels[profile.role as ProfileRole]}
          </span>
          {profile.bio && (
            <span className="text-xs text-muted-foreground italic">
              "{profile.bio}"
            </span>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
