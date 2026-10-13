/** Refresh device choices after tablet suspension or route changes; never activate media. */
export function subscribeMeetingDeviceRecovery(refresh: () => void) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const resume = () => {
    clearTimeout(timer);
    if (document.visibilityState === 'hidden') return;
    timer = setTimeout(refresh, 0);
  };
  document.addEventListener('visibilitychange', resume);
  window.addEventListener('pageshow', resume);
  window.addEventListener('online', resume);
  const devices = navigator.mediaDevices;
  devices?.addEventListener?.('devicechange', resume);
  return () => {
    clearTimeout(timer);
    document.removeEventListener('visibilitychange', resume);
    window.removeEventListener('pageshow', resume);
    window.removeEventListener('online', resume);
    devices?.removeEventListener?.('devicechange', resume);
  };
}
