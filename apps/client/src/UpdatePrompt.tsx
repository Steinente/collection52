import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useRegisterSW } from 'virtual:pwa-register/react';

export function UpdatePrompt() {
  const { t } = useTranslation();
  const [registration, setRegistration] = useState<ServiceWorkerRegistration>();
  const [updating, setUpdating] = useState(false);
  const { needRefresh: [needRefresh, setNeedRefresh], updateServiceWorker } = useRegisterSW({
    onRegisteredSW: (_url, currentRegistration) => setRegistration(currentRegistration)
  });

  useEffect(() => {
    if (!registration) return;
    const check = () => { if (document.visibilityState === 'visible' && navigator.onLine) void registration.update(); };
    const interval = window.setInterval(check, 15 * 60_000);
    window.addEventListener('online', check);
    document.addEventListener('visibilitychange', check);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('online', check);
      document.removeEventListener('visibilitychange', check);
    };
  }, [registration]);

  if (!needRefresh) return null;
  return createPortal(
    <aside className="update-prompt" role="status" aria-live="polite" aria-labelledby="app-update-title">
      <span className="update-prompt-icon" aria-hidden="true">↻</span>
      <div className="update-prompt-copy">
        <strong id="app-update-title">{t('appUpdateAvailable')}</strong>
        <span>{t('appUpdateDescription')}</span>
      </div>
      <div className="update-prompt-actions">
        <button type="button" onClick={() => setNeedRefresh(false)} disabled={updating}>{t('later')}</button>
        <button className="primary" type="button" disabled={updating} onClick={() => { setUpdating(true); void updateServiceWorker(true); }}>{t(updating ? 'appUpdating' : 'updateNow')}</button>
      </div>
    </aside>,
    document.body
  );
}
