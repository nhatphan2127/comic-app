import { useEffect, useState, useCallback, useRef } from 'react';
import { Upload, X } from 'lucide-react';
import type { ComicContributor } from '../../../../types/types';
import { API_UPLOADS, comicApi, comicContributorApi } from '../../../../services/api';
import { ComicRow } from '../../../../components/UploadComicCard/UploadComicCard';
import { slugify, formatDisplayValue } from '../../../../helpers/utils';

import style from './ComicSuggestionPanel.module.css';

const TYPE_OPTIONS = ['Manga', 'Manhwa', 'Manhua', 'Other'];
export const DEMOGRAPHIC_OPTIONS = ['Josei', 'Seinen', 'Shoujo', 'Shounen'];
export const STATUS_OPTIONS = ['Releasing', 'Finished', 'On hiatus', 'Discontinued'];
export const CONTENT_FILTER = ['Safe', 'Suggestive', 'Erotica', 'Pornographic'];

const ALL_GENRES = [
  'Action', 'Adult', 'Adventure', 'Boys Love', 'Comedy', 'Crime', 'Drama', 'Ecchi',
  'Fantasy', 'Girls Love', 'Harem', 'Hentai', 'Historical', 'Horror', 'Isekai',
  'Magical Girls', 'Mature', 'Mecha', 'Medical', 'Mystery', 'Philosophical',
  'Psychological', 'Romance', 'Sci-Fi', 'Slice of Life', 'Smut', 'Sports',
  'Superhero', 'Thriller', 'Tragedy', 'Wuxia'
];

const ALL_FORMATS = [
  '4-Koma', 'Adaptation', 'Anthology', 'Award Winning', 'Doujinshi',
  'Full Color', 'Long Strip', 'Oneshot', 'Web Comic'
];

const createEmptyFormData = () => ({
  name: '',
  source: '',
  url: '',
  description: '',
  image: null as File | null,
  type: '',
  releasingYear: new Date().getFullYear(),
  author: '',
  artist: '',
  otherNames: '',
  correspondingCountries: '',
});

// Định nghĩa Component Dropdown dùng chung cấu trúc fdrop chính xác của bạn
interface CustomFormDropdownProps {
  label: string;
  value: string;
  options: string[];
  isOpen: boolean;
  onToggle: () => void;
  onSelect: (val: string) => void;
  placeholder?: string;
}

function CustomFormDropdown({
  label,
  value,
  options,
  isOpen,
  onToggle,
  onSelect,
  placeholder = 'Choose option',
}: CustomFormDropdownProps) {
  return (
    <div
      className={`${style['form-group']} ${style['fdrop']} ${isOpen ? style['is-open'] || 'is-open' : ''}`}
      onClick={(e) => e.stopPropagation()}
    >
      <label className={style['form-label']}>{label}</label>

      <button
        type="button"
        className={`${style['fdrop__btn']} ${style['form-input']}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen ? 'true' : 'false'}
        onClick={onToggle}
      >
        <span className={style['fdrop__value']}>{value || placeholder}</span>
        <svg
          className={style['fdrop__caret']}
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Chỉ render thẻ ul khi isOpen bằng true giống hệt như mã HTML mẫu */}
      {isOpen && (
        <ul className={style['fdrop__pop']} role="listbox">
          {options.map((opt) => {
            const isActive = value === opt;
            return (
              <li
                key={opt}
                role="option"
                aria-selected={isActive ? 'true' : 'false'}
                className={`${style['fdrop__item']} ${isActive ? style['is-active'] || 'is-active' : ''}`}
                onClick={() => onSelect(opt)}
              >
                <span className={`${style['fdrop__check']} ${style['fdrop__check--radio']}`} aria-hidden="true" />
                {opt}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function ComicSuggestionPanel() {
  const [activeTab, setActiveTab] = useState<'all' | 'accept' | 'pending' | 'reject'>('all');

  // Danh sách dữ liệu gợi ý từ contributor
  const [contributions, setContributions] = useState<ComicContributor[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [showForm, setShowForm] = useState(false);
  const [editingComicId, setEditingComicId] = useState<string | null>(null);
  const [formData, setFormData] = useState(createEmptyFormData);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [selectedGenres, setSelectedGenres] = useState<Record<string, boolean>>({});
  const [selectedFormats, setSelectedFormats] = useState<Record<string, boolean>>({});
  const [selectedDemographic, setSelectedDemographic] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedContentFilter, setSelectedContentFilter] = useState('');

  const imageInputRef = useRef<HTMLInputElement>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const resetForm = useCallback(() => {
    setFormData(createEmptyFormData());
    setSelectedGenres({});
    setSelectedFormats({});
    setSelectedDemographic('');
    setSelectedStatus('');
    setSelectedContentFilter('');
    setPreviewImage(null);
    setEditingComicId(null);
    if (imageInputRef.current) {
      imageInputRef.current.value = '';
    }
  }, []);

  const openCreateForm = useCallback(() => {
    resetForm();
    setShowForm(true);
    setStatusMessage(null);
  }, [resetForm]);

  const populateFormFromComic = useCallback(async (contrib: ComicContributor) => {
    try {
      const comic = await comicApi.getByUrl(contrib.comic.url || contrib.comicId);
      const genreMap = Object.fromEntries((comic.genres || []).map((genre) => [genre, true]));
      const formatMap = Object.fromEntries((comic.formats || []).map((format) => [format, true]));

      setFormData({
        name: comic.name || '',
        source: comic.source || '',
        url: comic.url || '',
        description: comic.description || '',
        image: null,
        type: comic.types || '',
        releasingYear: Number(comic.releasingYear) || new Date().getFullYear(),
        author: comic.author || '',
        artist: comic.artist || '',
        otherNames: '',
        correspondingCountries: '',
      });
      setSelectedGenres(genreMap);
      setSelectedFormats(formatMap);
      setSelectedDemographic(formatDisplayValue(comic.demographic, DEMOGRAPHIC_OPTIONS));
      setSelectedStatus(formatDisplayValue(comic.releaseStatus, STATUS_OPTIONS));
      setSelectedContentFilter(formatDisplayValue(comic.contentRating, CONTENT_FILTER));
      setPreviewImage(comic.coverUrl ? `${API_UPLOADS}${comic.coverUrl}` : null);
      setEditingComicId(contrib.comicId);
      setShowForm(true);
      setStatusMessage(null);
    } catch (err: unknown) {
      setStatusMessage(err instanceof Error ? err.message : 'Failed to load comic details.');
    }
  }, []);

  // State quản lý dropdown nào đang được mở ('type' | 'demographic' | 'status' | 'contentFilter' | null)
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  const toggleDropdown = (name: string) => {
    setActiveDropdown((prev) => (prev === name ? null : name));
  };

  // Click-outside: Đóng tất cả dropdown khi nhấn chuột ra ngoài vùng .fdrop
  useEffect(() => {
    const handleClickOutside = () => {
      setActiveDropdown(null);
    };
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);

  const filteredContributions = contributions.filter(contrib => activeTab === 'all' || contrib.status === activeTab);

  const loadContributions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await comicContributorApi.listMyContributions();
      setContributions(items || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load contributions');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormData((prev) => ({ ...prev, image: file }));
      const reader = new FileReader();
      reader.onload = (event) => {
        setPreviewImage(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleInputChange = (field: keyof ReturnType<typeof createEmptyFormData>, value: string | number | File | null) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value } as ReturnType<typeof createEmptyFormData>;
      if (field === 'name') {
        updated.url = slugify(value as string);
      }
      return updated;
    });
  };

  const toggleTag = (tag: string, isGenre: boolean) => {
    const setState = isGenre ? setSelectedGenres : setSelectedFormats;
    setState((prev) => {
      const updated = { ...prev };
      if (updated[tag]) {
        delete updated[tag];
      } else {
        updated[tag] = true;
      }
      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);

    if (!formData.name.trim()) {
      setStatusMessage('Comic name is required.');
      return;
    }
    if (!formData.type) {
      setStatusMessage('Comic type is required.');
      return;
    }
    if (!selectedDemographic) {
      setStatusMessage('Demographic is required.');
      return;
    }
    if (!selectedContentFilter) {
      setStatusMessage('Content Filter is required.');
      return;
    }
    if (!formData.image && !previewImage && !editingComicId) {
      setStatusMessage('Cover image is required.');
      return;
    }
    if (!formData.url.trim()) {
      setStatusMessage('Comic URL/Slug is required.');
      return;
    }

    const form = new FormData();
    form.append('name', formData.name.trim());
    form.append('source', formData.source.trim());
    form.append('url', slugify(formData.url.trim()));
    form.append('description', formData.description.trim());
    form.append('types', formData.type);
    form.append('contentRating', selectedContentFilter.toLowerCase());
    form.append('demographic', selectedDemographic);
    form.append('releaseStatus', selectedStatus || 'releasing');
    form.append('releasingYear', String(formData.releasingYear));

    if (formData.author.trim()) form.append('author', formData.author.trim());
    if (formData.artist.trim()) form.append('artist', formData.artist.trim());
    if (formData.image) form.append('coverImage', formData.image);

    Object.keys(selectedGenres).forEach((genre) => form.append('genres', genre));
    Object.keys(selectedFormats).forEach((format) => form.append('formats', format));

    try {
      setIsSaving(true);
      if (editingComicId) {
        await comicApi.update(editingComicId, form);
        setStatusMessage('Comic updated successfully and moved back to pending.');
      } else {
        await comicApi.create(form);
        setStatusMessage('Comic created successfully.');
      }
      setShowForm(false);
      resetForm();
      setActiveTab('pending');
      await loadContributions();
    } catch (error: unknown) {
      setStatusMessage(error instanceof Error ? error.message : 'Failed to save comic.');
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    loadContributions();
  }, [loadContributions]);

  return (
    <div className={style['suggestions-container']}>
      {/* Header */}
      <div className={style['section-header']} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 'bold' }}>
            {showForm ? 'Suggest New Comic' : 'Suggested Comics'}
          </h2>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          {showForm ? (
            <button
              type="button"
              className={`${style['ubtn']} ${style['ubtn--back']} ${style['ubtn--sm']}`}
              onClick={() => {
                setShowForm(false);
                resetForm();
              }}
            >
              Back
            </button>
          ) : (
            <button
              type="button"
              className={`${style['ubtn']} ${style['ubtn--primary']} ${style['ubtn--sm']}`}
              onClick={openCreateForm}
            >
              + Suggest Comic
            </button>
          )}
        </div>
      </div>

      {/* Tabs & Filters */}
      {!showForm && (
        <div className={style['nfilters']} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div className={style['useg']}>
            <button
              type="button"
              className={`${style['useg__btn']} ${activeTab === 'pending' ? style['is-on'] || 'is-on' : ''}`}
              onClick={() => setActiveTab('pending')}
            >
              <span className={`${style['useg__count']} ${style['mono'] || 'mono'}`}>{contributions.filter(c => c.status === 'pending').length}</span>
              Pending
            </button>
            <button
              type="button"
              className={`${style['useg__btn']} ${activeTab === 'accept' ? style['is-on'] || 'is-on' : ''}`}
              onClick={() => setActiveTab('accept')}
            >
              <span className={`${style['useg__count']} ${style['mono'] || 'mono'}`}>{contributions.filter(c => c.status === 'accept').length}</span>
              Accepted
            </button>
            <button
              type="button"
              className={`${style['useg__btn']} ${activeTab === 'reject' ? style['is-on'] || 'is-on' : ''}`}
              onClick={() => setActiveTab('reject')}
            >
              <span className={`${style['useg__count']} ${style['mono'] || 'mono'}`}>{contributions.filter(c => c.status === 'reject').length}</span>
              Rejected
            </button>
            <button
              type="button"
              className={`${style['useg__btn']} ${activeTab === 'all' ? style['is-on'] || 'is-on' : ''}`}
              onClick={() => setActiveTab('all')}
            >
              <span className={`${style['useg__count']} ${style['mono'] || 'mono'}`}>{contributions.length}</span>
              All
            </button>
          </div>
        </div>
      )}

      {/* Thông báo lỗi hoặc Trạng thái tải */}
      {statusMessage && (
        <div className={style['status-message']} style={{ padding: '12px', marginBottom: '16px', borderRadius: '4px', background: '#25262c', color: '#fff' }}>
          {statusMessage}
        </div>
      )}

      {loading ? (
        <div className={style['uempty']}>Loading...</div>
      ) : error ? (
        <div className={style['uempty']}>{error}</div>
      ) : showForm ? (
        /* Giao diện Form Gợi ý Comic */
        <div className={style['comic-form-container']}>
          <div className={style['comic-form-header']}>
            <h3 className={style['comic-form-title']}>{editingComicId ? 'Edit Comic' : 'Add New Comic'}</h3>
            <button
              type="button"
              className={style['comic-form-close-btn']}
              onClick={() => {
                setShowForm(false);
                resetForm();
              }}
              aria-label="Close form"
            >
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className={style['comic-form']}>
            {/* LEFT COLUMN */}
            <div className={style['comic-form-left']}>
              <div className={style['form-group']}>
                <label className={style['form-label']}>Image *</label>
                <div className={style['image-upload-box']}>
                  {previewImage ? (
                    <div className={style['image-preview']}>
                      <img src={previewImage} alt="Comic preview" className={style['preview-img']} />
                      <button
                        type="button"
                        className={style['remove-image-btn']}
                        onClick={() => {
                          setPreviewImage(null);
                          setFormData((prev) => ({ ...prev, image: null }));
                          if (imageInputRef.current) imageInputRef.current.value = '';
                        }}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className={style['image-upload-btn']}
                      onClick={() => imageInputRef.current?.click()}
                    >
                      <Upload size={24} strokeWidth={1.5} />
                      <span>Click to upload image</span>
                    </button>
                  )}
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    style={{ display: 'none' }}
                  />
                </div>
              </div>

              <div className={style['form-row-2col']}>
                <div className={style['form-group']}>
                  <label className={style['form-label']}>Releasing Year</label>
                  <input
                    type="number"
                    className={style['form-input']}
                    value={formData.releasingYear}
                    onChange={(e) => handleInputChange('releasingYear', parseInt(e.target.value) || new Date().getFullYear())}
                    min="1990"
                    max={new Date().getFullYear() + 1}
                  />
                </div>

                {/* 1. Dropdown STATUS_OPTIONS */}
                <div className={style['form-group']}>
                  <CustomFormDropdown
                    label="Releasing Status"
                    value={selectedStatus}
                    options={STATUS_OPTIONS}
                    isOpen={activeDropdown === 'status'}
                    onToggle={() => toggleDropdown('status')}
                    onSelect={(val) => {
                      setSelectedStatus(val);
                      setActiveDropdown(null);
                    }}
                    placeholder="Choose status"
                  />
                </div>
              </div>

              <div className={style['form-group']}>
                <label className={style['form-label']}>Author</label>
                <input
                  type="text"
                  className={style['form-input']}
                  value={formData.author}
                  onChange={(e) => handleInputChange('author', e.target.value)}
                  placeholder="Enter author name"
                />
              </div>

              <div className={style['form-group']}>
                <label className={style['form-label']}>Artist</label>
                <input
                  type="text"
                  className={style['form-input']}
                  value={formData.artist}
                  onChange={(e) => handleInputChange('artist', e.target.value)}
                  placeholder="Enter artist name"
                />
              </div>
            </div>

            {/* RIGHT COLUMN */}
            <div className={style['comic-form-right']}>
              <div className={style['form-group']}>
                <label className={style['form-label']}>Name *</label>
                <input
                  type="text"
                  className={style['form-input']}
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="Enter comic name"
                  required
                />
              </div>

              <div className={style['form-group']}>
                <label className={style['form-label']}>Slug (Auto-generated)</label>
                <input
                  type="text"
                  className={style['form-input']}
                  value={formData.url}
                  onChange={(e) => handleInputChange('url', slugify(e.target.value))}
                  placeholder="comic-url-slug"
                  required
                />
              </div>

              <div className={style['form-row-3col']}>
                {/* 2. Dropdown TYPE_OPTIONS */}
                <div className={style['form-group']}>
                  <CustomFormDropdown
                    label="Type *"
                    value={formData.type}
                    options={TYPE_OPTIONS}
                    isOpen={activeDropdown === 'type'}
                    onToggle={() => toggleDropdown('type')}
                    onSelect={(val) => {
                      handleInputChange('type', val);
                      setActiveDropdown(null);
                    }}
                    placeholder="Choose type"
                  />
                </div>

                {/* 3. Dropdown DEMOGRAPHIC_OPTIONS */}
                <div className={style['form-group']}>
                  <CustomFormDropdown
                    label="Demographic *"
                    value={selectedDemographic}
                    options={DEMOGRAPHIC_OPTIONS}
                    isOpen={activeDropdown === 'demographic'}
                    onToggle={() => toggleDropdown('demographic')}
                    onSelect={(val) => {
                      setSelectedDemographic(val);
                      setActiveDropdown(null);
                    }}
                    placeholder="Choose demographic"
                  />
                </div>

                {/* 4. Dropdown CONTENT_FILTER */}
                <div className={style['form-group']}>
                  <CustomFormDropdown
                    label="Content Filter *"
                    value={selectedContentFilter}
                    options={CONTENT_FILTER}
                    isOpen={activeDropdown === 'contentFilter'}
                    onToggle={() => toggleDropdown('contentFilter')}
                    onSelect={(val) => {
                      setSelectedContentFilter(val);
                      setActiveDropdown(null);
                    }}
                    placeholder="Choose Filter"
                  />
                </div>
              </div>

              <div className={style['form-group']}>
                <label className={style['form-label']}>Other Names & Countries (per line)</label>
                <textarea
                  className={style['form-textarea']}
                  value={formData.otherNames}
                  onChange={(e) => handleInputChange('otherNames', e.target.value)}
                  placeholder={`Name1,Country1\nName2,Country2`}
                  rows={3}
                />
              </div>

              <div className={style['form-group']}>
                <label className={style['form-label']}>Description</label>
                <textarea
                  style={{ minHeight: '132px' }}
                  className={style['form-textarea']}
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="Enter comic description"
                  rows={4}
                />
              </div>
            </div>

            {/* Formats - FULL WIDTH */}
            <div className={style['form-full']}>
              <div className={style['form-group']}>
                <label className={style['form-label']}>Formats</label>
                <div className={style['direct-tags-box']}>
                  <ul className={style['direct-tags-grid']}>
                    {ALL_FORMATS.map((format) => {
                      const isSelected = !!selectedFormats[format];
                      return (
                        <li key={format}>
                          <button
                            type="button"
                            className={`${style['tagpop__item']} ${isSelected ? style['tag-on'] || 'tag-on' : style['tag-off'] || 'tag-off'}`}
                            onClick={() => toggleTag(format, false)}
                          >
                            <span className={style['tagpop__check']} aria-hidden="true"></span>
                            <span className={style['tagpop__name']}>{format}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            </div>

            {/* Genres - FULL WIDTH */}
            <div className={style['form-full']}>
              <div className={style['form-group']}>
                <label className={style['form-label']}>Genres</label>
                <div className={style['direct-tags-box']}>
                  <ul className={style['direct-tags-grid']}>
                    {ALL_GENRES.map((genre) => {
                      const isSelected = !!selectedGenres[genre];
                      return (
                        <li key={genre}>
                          <button
                            type="button"
                            className={`${style['tagpop__item']} ${isSelected ? style['tag-on'] || 'tag-on' : style['tag-off'] || 'tag-off'}`}
                            onClick={() => toggleTag(genre, true)}
                          >
                            <span className={style['tagpop__check']} aria-hidden="true"></span>
                            <span className={style['tagpop__name']}>{genre}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className={style['form-actions-full']} style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
              <button type="submit" className={`${style['ubtn']} ${style['ubtn--primary']}`} disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save Comic'}
              </button>
              <button
                type="button"
                className={`${style['ubtn']} ${style['ubtn--ghost']}`}
                onClick={() => {
                  setShowForm(false);
                  resetForm();
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : filteredContributions.length > 0 ? (
        /* Giao diện danh sách gợi ý */
        <ul className={style['nlist']}>
          {filteredContributions.map((contrib) => (
            <ComicRow
              key={`${contrib.comicId}-${contrib.userId}`}
              contributor={contrib}
              onClick={() => undefined}
              onEdit={() => void populateFormFromComic(contrib)}
            />
          ))}
        </ul>
      ) : (
        /* Trạng thái danh sách rỗng */
        <div className={style['uempty']}>
          <div className={style['uempty__icon']}>
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
          </div>
          <div className={style['uempty__title']}>No suggestions found.</div>
          <div className={style['uempty__sub']}>
            {activeTab === 'accept'
              ? 'No accepted suggestions.'
              : activeTab === 'pending'
                ? 'No pending suggestions.'
                : activeTab === 'reject'
                  ? 'No rejected suggestions.'
                  : 'Start suggesting comics to expand the library.'}
          </div>
        </div>
      )}
    </div>
  );
}