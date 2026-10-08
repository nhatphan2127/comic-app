import { useEffect, useState } from 'react';

// Chromium-only event; other browsers install from their own menu.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** `install` is set while the browser offers to install the app, null otherwise. */
export default function useInstallPrompt() {
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const offer = (e: Event) => {
      e.preventDefault(); // keep the browser's mini-infobar away; we show our own button
      setEvent(e as BeforeInstallPromptEvent);
    };
    const installed = () => setEvent(null);
    window.addEventListener('beforeinstallprompt', offer);
    window.addEventListener('appinstalled', installed);
    return () => {
      window.removeEventListener('beforeinstallprompt', offer);
      window.removeEventListener('appinstalled', installed);
    };
  }, []);

  const install = event
    ? async () => {
        await event.prompt();
        await event.userChoice;
        setEvent(null); // the prompt can only be used once
      }
    : null;

  return install;
}
