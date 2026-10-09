import type { ReactNode } from 'react';
import cx from '../../helpers/cx';
import style from './ui.module.css';

interface SettingSwitchProps {
  title: ReactNode;
  description?: ReactNode;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}

/** A labelled on/off setting row. */
export default function SettingSwitch({ title, description, checked, disabled, onChange }: SettingSwitchProps) {
  return (
    <label className={cx(style.setting, disabled && style.settingDisabled)}>
      <span className={style.settingText}>
        <strong>{title}</strong>
        {description ? <small>{description}</small> : null}
      </span>
      <input type="checkbox" className="sr-only" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className={cx(style.switch, checked && style.switchOn)} aria-hidden="true" />
    </label>
  );
}
