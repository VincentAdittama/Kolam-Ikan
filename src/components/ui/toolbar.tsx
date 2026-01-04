import * as React from 'react';
import { cn } from '@/lib/utils';

interface ToolbarProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'fixed';
}

const Toolbar = React.forwardRef<HTMLDivElement, ToolbarProps>(
  ({ className, variant = 'default', ...props }, ref) => (
    <div
      ref={ref}
      role="toolbar"
      aria-label="toolbar"
      data-variant={variant}
      className={cn(
        'tiptap-toolbar flex items-center gap-1 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60 px-2 py-1.5',
        variant === 'fixed' && 'sticky top-0 z-10',
        className
      )}
      {...props}
    />
  )
);
Toolbar.displayName = 'Toolbar';

type ToolbarGroupProps = React.HTMLAttributes<HTMLDivElement>;

const ToolbarGroup = React.forwardRef<HTMLDivElement, ToolbarGroupProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      role="group"
      className={cn('tiptap-toolbar-group flex items-center gap-0.5', className)}
      {...props}
    />
  )
);
ToolbarGroup.displayName = 'ToolbarGroup';

interface ToolbarSeparatorProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: 'horizontal' | 'vertical';
}

const ToolbarSeparator = React.forwardRef<HTMLDivElement, ToolbarSeparatorProps>(
  ({ className, orientation = 'vertical', ...props }, ref) => (
    <div
      ref={ref}
      role="none"
      data-orientation={orientation}
      className={cn(
        'tiptap-separator',
        orientation === 'vertical' ? 'mx-1.5 h-5 w-px bg-border' : 'my-1.5 h-px w-full bg-border',
        className
      )}
      {...props}
    />
  )
);
ToolbarSeparator.displayName = 'ToolbarSeparator';

interface ToolbarButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isActive?: boolean;
  tooltip?: string;
}

const ToolbarButton = React.forwardRef<HTMLButtonElement, ToolbarButtonProps>(
  ({ className, isActive, disabled, children, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      role="button"
      tabIndex={-1}
      disabled={disabled}
      data-style="ghost"
      data-active-state={isActive ? 'on' : 'off'}
      data-disabled={disabled ? 'true' : undefined}
      aria-pressed={isActive}
      className={cn(
        'tiptap-button inline-flex items-center justify-center rounded-md h-8 w-8 text-sm font-medium transition-colors',
        'hover:bg-accent hover:text-accent-foreground',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
        'disabled:pointer-events-none disabled:opacity-50',
        isActive && 'bg-accent text-accent-foreground',
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
);
ToolbarButton.displayName = 'ToolbarButton';

const ToolbarSpacer = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex-1', className)} {...props} />
  )
);
ToolbarSpacer.displayName = 'ToolbarSpacer';

export { Toolbar, ToolbarGroup, ToolbarSeparator, ToolbarButton, ToolbarSpacer };
