/**
 * Design System - UI Primitives
 * 
 * Reusable UI components for the charting platform.
 */

// Re-export utilities
export { default as clsx } from 'clsx';

// Button variants
export function getButtonClasses(variant: 'primary' | 'secondary' | 'ghost' | 'danger' = 'primary') {
  const base = 'px-4 py-2 rounded font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent';
  
  switch (variant) {
    case 'primary':
      return `${base} bg-accent hover:bg-accent-hover text-white`;
    case 'secondary':
      return `${base} bg-surface-elevated hover:bg-background-hover text-text-primary border border-border`;
    case 'ghost':
      return `${base} hover:bg-surface-elevated text-text-secondary hover:text-text-primary`;
    case 'danger':
      return `${base} bg-bear hover:bg-bear-muted text-white`;
    default:
      return base;
  }
}
