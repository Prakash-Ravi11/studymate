import {
  Home, BookOpen, CheckSquare, CalendarDays,
  FileText, FolderOpen, Mic, Settings, GraduationCap,
  type LucideIcon,
} from 'lucide-react';

export type NavItem = { href: string; label: string; icon: LucideIcon };

/**
 * Navigation is split so the sidebar reads as two short lists rather than one
 * long one (section 29). "Plan" is what you act on; "Library" is what you have
 * collected.
 */
export const PLAN_NAV: NavItem[] = [
  { href: '/home', label: 'Home', icon: Home },
  { href: '/subjects', label: 'Subjects', icon: BookOpen },
  { href: '/tasks', label: 'Tasks', icon: CheckSquare },
  { href: '/calendar', label: 'Calendar', icon: CalendarDays },
];

export const LIBRARY_NAV: NavItem[] = [
  { href: '/notes', label: 'Notes', icon: FileText },
  { href: '/resources', label: 'Resources', icon: FolderOpen },
  { href: '/voice', label: 'Voice notes', icon: Mic },
];

export const SETTINGS_NAV: NavItem = { href: '/settings', label: 'Settings', icon: Settings };

/** Distraction-free capture screen; reachable but never in the way. */
export const CLASS_MODE_NAV: NavItem = {
  href: '/class',
  label: 'Class mode',
  icon: GraduationCap,
};

/** The four that earn a slot in the mobile tab bar; the rest live under More. */
export const MOBILE_NAV: NavItem[] = [
  { href: '/home', label: 'Home', icon: Home },
  { href: '/subjects', label: 'Subjects', icon: BookOpen },
  { href: '/tasks', label: 'Tasks', icon: CheckSquare },
  { href: '/calendar', label: 'Calendar', icon: CalendarDays },
];

export function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
