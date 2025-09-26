import { useEffect, useRef } from 'react';

export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  preventDefault?: boolean;
  callback: () => void;
  description?: string;
}

export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[], enabled: boolean = true) {
  const shortcutsRef = useRef(shortcuts);
  
  // Update shortcuts ref when shortcuts change
  useEffect(() => {
    shortcutsRef.current = shortcuts;
  }, [shortcuts]);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't trigger shortcuts when user is typing in inputs
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      const shortcut = shortcutsRef.current.find(s => {
        const keyMatch = s.key.toLowerCase() === event.key.toLowerCase();
        const ctrlMatch = Boolean(s.ctrl) === event.ctrlKey;
        const shiftMatch = Boolean(s.shift) === event.shiftKey;
        const altMatch = Boolean(s.alt) === event.altKey;
        
        return keyMatch && ctrlMatch && shiftMatch && altMatch;
      });

      if (shortcut) {
        if (shortcut.preventDefault !== false) {
          event.preventDefault();
        }
        shortcut.callback();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [enabled]);

  return null;
}

// Common keyboard shortcut combinations
export const createSelectAllShortcut = (callback: () => void): KeyboardShortcut => ({
  key: 'a',
  ctrl: true,
  callback,
  description: 'Select all entries'
});

export const createDeleteShortcut = (callback: () => void): KeyboardShortcut => ({
  key: 'Delete',
  callback,
  description: 'Delete selected entries'
});

export const createEscapeShortcut = (callback: () => void): KeyboardShortcut => ({
  key: 'Escape',
  callback,
  description: 'Clear selection'
});

export const createRefreshShortcut = (callback: () => void): KeyboardShortcut => ({
  key: 'F5',
  callback,
  preventDefault: false,
  description: 'Refresh data'
});

export const createExportShortcuts = (
  exportCSV: () => void,
  exportPDF: () => void
): KeyboardShortcut[] => [
  {
    key: 'e',
    ctrl: true,
    callback: exportCSV,
    description: 'Export to CSV'
  },
  {
    key: 'p',
    ctrl: true,
    shift: true,
    callback: exportPDF,
    description: 'Export to PDF'
  }
];

// Arrow key navigation helpers
export const createNavigationShortcuts = (
  onArrowUp: () => void,
  onArrowDown: () => void,
  onEnter: () => void
): KeyboardShortcut[] => [
  {
    key: 'ArrowUp',
    callback: onArrowUp,
    description: 'Navigate up'
  },
  {
    key: 'ArrowDown', 
    callback: onArrowDown,
    description: 'Navigate down'
  },
  {
    key: 'Enter',
    callback: onEnter,
    description: 'Select/activate current item'
  }
];