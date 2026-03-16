'use client';

import { Moon, Sun, SunMoon } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Button } from '@iconicedu/ui-web/ui/button';

export function ThemeToggle({ ...props }) {
  const { setTheme, theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    // Default to system theme when nothing is set.
    if (!theme) {
      setTheme('system');
    }
  }, [setTheme, theme]);

  const currentTheme = theme ?? 'system';

  const getIcon = () => {
    switch (currentTheme) {
      case 'light':
        return Sun;
      case 'dark':
        return Moon;
      case 'system':
      default:
        return SunMoon;
    }
  };

  const Icon = getIcon();

  const handleToggle = () => {
    // Cycle: system → light → dark → system
    const nextTheme =
      currentTheme === 'system' ? 'light' : currentTheme === 'light' ? 'dark' : 'system';
    setTheme(nextTheme);
  };

  return (
    <Button
      variant="ghost"
      className="relative p-0 size-9"
      aria-label={`Toggle theme (current: ${currentTheme})`}
      onClick={handleToggle}
      {...props}
    >
      {mounted ? <Icon className="h-4 w-4" /> : null}
    </Button>
  );
}
