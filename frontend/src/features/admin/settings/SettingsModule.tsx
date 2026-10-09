import { useEffect, useState } from 'react';
import { adminApi } from '../../../services/api';
import { useToast } from '../../../context/ToastContext';
import Page, { Card, PageState } from '../../../console/ui/Page';
import SettingSwitch from '../../../console/ui/Switch';

/** /admin/settings: platform-wide switches. New settings go in their own Card here. */
export default function SettingsModule() {
  const toast = useToast();
  const [autoAccept, setAutoAccept] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    adminApi
      .getSettings()
      .then((s) => !cancelled && setAutoAccept(Boolean(s.autoAccept)))
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : 'Unable to load settings'));
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleAutoAccept = async (next: boolean) => {
    setSaving(true);
    try {
      const res = await adminApi.setAutoAccept(next);
      setAutoAccept(Boolean(res.enabled));
      toast.success(res.enabled ? 'New submissions now go live right away.' : 'New submissions wait for a moderator again.');
    } catch (err) {
      toast.error(err, 'Unable to update the setting');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Page title="Settings" description="Platform-wide behaviour.">
      <PageState loading={autoAccept === null && !error} error={error}>
        <Card title="Moderation">
          <SettingSwitch
            title="Auto-approve submissions"
            description="New comics and chapters go live without a moderator reviewing them first."
            checked={Boolean(autoAccept)}
            disabled={saving}
            onChange={(next) => void toggleAutoAccept(next)}
          />
        </Card>
      </PageState>
    </Page>
  );
}
