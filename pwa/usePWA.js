'use client';
/**
 * SokoAI — PWA Hooks
 * usePWA()              — install prompt, online status
 * usePushNotifications() — subscribe/unsubscribe kwa bei alerts
 */
import { useState, useEffect, useCallback } from 'react';

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';


// ── Service Worker registration ───────────────────────────────────
export function useServiceWorker() {
  const [registered, setRegistered] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then(reg => {
        console.log('[PWA] Service Worker registered:', reg.scope);
        setRegistered(true);
      })
      .catch(err => console.error('[PWA] SW registration failed:', err));
  }, []);

  return registered;
}


// ── Install prompt ────────────────────────────────────────────────
export function usePWAInstall() {
  const [installPrompt, setInstallPrompt] = useState(null);
  const [isInstalled,   setIsInstalled]   = useState(false);
  const [isIOS,         setIsIOS]         = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check kama tayari imewekwa
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone;
    setIsInstalled(isStandalone);

    // iOS detection (haiwezi kutumia beforeinstallprompt)
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    setIsIOS(ios);

    // Listen for install prompt (Android/Desktop)
    const handler = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const install = useCallback(async () => {
    if (!installPrompt) return false;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      setInstallPrompt(null);
      setIsInstalled(true);
    }
    return outcome === 'accepted';
  }, [installPrompt]);

  return { canInstall: !!installPrompt || isIOS, isInstalled, isIOS, install };
}


// ── Online status ─────────────────────────────────────────────────
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const onOnline  = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online',  onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online',  onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  return isOnline;
}


// ── Push Notifications ────────────────────────────────────────────
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

export function usePushNotifications() {
  const [permission,   setPermission]   = useState('default');
  const [subscribed,   setSubscribed]   = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    setPermission(Notification.permission);

    // Check kama tayari imesubscribe
    navigator.serviceWorker.ready.then(reg =>
      reg.pushManager.getSubscription()
    ).then(sub => {
      setSubscribed(!!sub);
    }).catch(() => {});
  }, []);

  const subscribe = useCallback(async (commodities = []) => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setError('Browser yako haikusaidia push notifications');
      return false;
    }

    setLoading(true); setError(null);
    try {
      // Omba ruhusa
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') {
        setError('Ruhusa ya notifications ilikataliwa');
        return false;
      }

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly:      true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
      });

      // Tuma subscription kwenye server
      await fetch('/api/v1/notifications/subscribe', {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': localStorage.getItem('sokoai_api_key') ?? '',
        },
        body: JSON.stringify({
          subscription: sub.toJSON(),
          commodities,  // Bidhaa anazotaka alerts
        }),
      });

      setSubscribed(true);
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const unsubscribe = useCallback(async () => {
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await sub.unsubscribe();
        await fetch('/api/v1/notifications/unsubscribe', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
      }
      setSubscribed(false);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  return { permission, subscribed, loading, error, subscribe, unsubscribe };
}


// ── Combined PWA hook ─────────────────────────────────────────────
export function usePWA() {
  const swRegistered = useServiceWorker();
  const install      = usePWAInstall();
  const isOnline     = useOnlineStatus();
  const push         = usePushNotifications();

  return { swRegistered, isOnline, ...install, push };
}
