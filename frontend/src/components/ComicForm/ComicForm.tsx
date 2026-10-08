import { useRef, type ChangeEvent, type ReactNode } from 'react';
import { ImagePlus, X } from 'lucide-react';
import {
  CONTENT_RATING_OPTIONS,
  DEMOGRAPHIC_OPTIONS,
  FORMAT_OPTIONS,
  GENRE_OPTIONS,
  STATUS_OPTIONS,
  TYPE_OPTIONS,
} from '../../constants/comicOptions';
import { slugify } from '../../helpers/utils';
import Dropdown, { DropdownItem } from '../Dropdown/Dropdown';
import cx from '../../helpers/cx';
import type { ComicFormValues } from './comicFormValues';
import styles from './ComicForm.module.css';

interface ComicFormProps {
  values: ComicFormValues;
  onChange?: (values: ComicFormValues) => void;
  readOnly?: boolean;
}

function Field({ label, required, children, className }: { label: string; required?: boolean; children: ReactNode; className?: string }) {
  return (
    <div className={cx(styles.field, className)}>
      <span className={styles.label}>
        {label}
        {required ? <span className={styles.req}>*</span> : null}
      </span>
      {children}
    </div>
  );
}

/** Comic metadata form. With `readOnly` it doubles as a detail view for moderators. */
export default function ComicForm({ values, onChange, readOnly = false }: ComicFormProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const set = <K extends keyof ComicFormValues>(key: K, value: ComicFormValues[K]) => onChange?.({ ...values, [key]: value });

  const toggle = (key: 'genres' | 'formats', tag: string) =>
    set(key, values[key].includes(tag) ? values[key].filter((t) => t !== tag) : [...values[key], tag]);

  const pickCover = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (values.coverPreview?.startsWith('blob:')) URL.revokeObjectURL(values.coverPreview);
    onChange?.({ ...values, cover: file, coverPreview: URL.createObjectURL(file) });
  };

  const select = (key: 'type' | 'demographic' | 'contentRating' | 'releaseStatus', options: readonly string[], placeholder: string) =>
    readOnly ? (
      <div className={styles.static}>{values[key] || '—'}</div>
    ) : (
      <Dropdown value={values[key] || <span className={styles.placeholder}>{placeholder}</span>}>
        {(close) =>
          options.map((opt) => (
            <DropdownItem
              key={opt}
              kind="radio"
              selected={values[key] === opt}
              onClick={() => {
                set(key, opt);
                close();
              }}
            >
              {opt}
            </DropdownItem>
          ))
        }
      </Dropdown>
    );

  const text = (key: 'name' | 'url' | 'author' | 'artist' | 'source', placeholder: string, transform?: (v: string) => Partial<ComicFormValues>) =>
    readOnly ? (
      <div className={styles.static}>{values[key] || '—'}</div>
    ) : (
      <input
        className="input"
        placeholder={placeholder}
        value={values[key]}
        onChange={(e) => onChange?.({ ...values, [key]: e.target.value, ...transform?.(e.target.value) })}
      />
    );

  const tagGroup = (key: 'genres' | 'formats', options: readonly string[]) => (
    <div className={styles.tags}>
      {(readOnly ? options.filter((o) => values[key].includes(o)) : options).map((tag) => (
        <button
          key={tag}
          type="button"
          disabled={readOnly}
          aria-pressed={values[key].includes(tag)}
          className={cx(styles.tag, values[key].includes(tag) && styles.tagOn)}
          onClick={() => toggle(key, tag)}
        >
          {tag}
        </button>
      ))}
      {readOnly && values[key].length === 0 ? <span className={styles.placeholder}>None</span> : null}
    </div>
  );

  return (
    <div className={styles.form}>
      <div className={styles.coverCol}>
        <Field label="Cover" required={!readOnly}>
          <div className={styles.cover}>
            {values.coverPreview ? (
              <>
                <img src={values.coverPreview} alt="Cover preview" />
                {!readOnly ? (
                  <button
                    type="button"
                    className={styles.coverRemove}
                    aria-label="Remove cover"
                    onClick={() => onChange?.({ ...values, cover: null, coverPreview: null })}
                  >
                    <X size={14} />
                  </button>
                ) : null}
              </>
            ) : (
              <button type="button" className={styles.coverPick} disabled={readOnly} onClick={() => fileRef.current?.click()}>
                <ImagePlus size={26} />
                Upload cover
              </button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="sr-only" onChange={pickCover} />
        </Field>

        <div className={styles.pair}>
          <Field label="Year">
            {readOnly ? (
              <div className={styles.static}>{values.releasingYear}</div>
            ) : (
              <input
                className="input"
                type="number"
                min={1950}
                max={new Date().getFullYear() + 1}
                value={values.releasingYear}
                onChange={(e) => set('releasingYear', Number(e.target.value) || new Date().getFullYear())}
              />
            )}
          </Field>
          <Field label="Status">{select('releaseStatus', STATUS_OPTIONS, 'Choose')}</Field>
        </div>
        <Field label="Author">{text('author', 'Author name')}</Field>
        <Field label="Artist">{text('artist', 'Artist name')}</Field>
      </div>

      <div className={styles.mainCol}>
        <Field label="Title" required={!readOnly}>
          {text('name', 'Comic title', (v) => ({ url: slugify(v) }))}
        </Field>
        <Field label="URL slug" required={!readOnly}>
          {text('url', 'comic-url-slug')}
        </Field>
        <div className={styles.triple}>
          <Field label="Type" required={!readOnly}>
            {select('type', TYPE_OPTIONS, 'Choose type')}
          </Field>
          <Field label="Demographic" required={!readOnly}>
            {select('demographic', DEMOGRAPHIC_OPTIONS, 'Choose')}
          </Field>
          <Field label="Content rating" required={!readOnly}>
            {select('contentRating', CONTENT_RATING_OPTIONS, 'Choose')}
          </Field>
        </div>
        <Field label="Description">
          {readOnly ? (
            <div className={cx(styles.static, styles.staticLong)}>{values.description || '—'}</div>
          ) : (
            <textarea
              className="input"
              rows={6}
              placeholder="What is this story about?"
              value={values.description}
              onChange={(e) => set('description', e.target.value)}
            />
          )}
        </Field>
      </div>

      <Field label="Genres" className={styles.full}>
        {tagGroup('genres', GENRE_OPTIONS)}
      </Field>
      <Field label="Formats" className={styles.full}>
        {tagGroup('formats', FORMAT_OPTIONS)}
      </Field>
    </div>
  );
}
