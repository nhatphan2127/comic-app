import { useEffect, useState, useCallback, useRef } from 'react';
import { Upload, X } from 'lucide-react';
import type { ComicContributor } from '../../../types/types';
import { API_UPLOADS, comicApi, comicContributorApi } from '../../../services/api';
import { ComicRow } from '../../../components/UploadComicCard';
import { slugify } from '../../../helpers/utils';

import '../../../assets/styles/ComicForm.css';

const TYPE_OPTIONS = ['Manga', 'Manhwa', 'Manhua', 'Other'];
const DEMOGRAPHIC_OPTIONS = ['Josei', 'Seinen', 'Shoujo', 'Shounen'];
const STATUS_OPTIONS = ['Releasing', 'Finished', 'On hiatus', 'Discontinued'];
const CONTENT_FILTER = ['Safe', 'Suggestive', 'Erotica', 'Pornographic'];

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

const formatDisplayValue = (value?: string, options: string[] = []) => {
  if (!value) return '';
  const normalized = value.toString().trim();
  const matchedOption = options.find((option) => option.toLowerCase() === normalized.toLowerCase());
  if (matchedOption) {
    return matchedOption;
  }

  return normalized
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

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
      className={`form-group fdrop ${isOpen ? 'is-open' : ''}`}
      onClick={(e) => e.stopPropagation()}
    >
      <label className="form-label">{label}</label>

      <button
        type="button"
        className="fdrop__btn form-input"
        aria-haspopup="listbox"
        aria-expanded={isOpen ? 'true' : 'false'}
        onClick={onToggle}
      >
        <span className="fdrop__value">{value || placeholder}</span>
        <svg
          className="fdrop__caret"
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
        <ul className="fdrop__pop" role="listbox">
          {options.map((opt) => {
            const isActive = value === opt;
            return (
              <li
                key={opt}
                role="option"
                aria-selected={isActive ? 'true' : 'false'}
                className={`fdrop__item ${isActive ? 'is-active' : ''}`}
                onClick={() => onSelect(opt)}
              >
                <span className="fdrop__check fdrop__check--radio" aria-hidden="true" />
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
    } catch (err: any) {
      setStatusMessage(err?.message || 'Failed to load comic details.');
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
    } catch (err: any) {
      setError(err?.message || 'Failed to load contributions');
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

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };
      if (field === 'name') {
        updated.url = slugify(value);
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
    } catch (error: any) {
      setStatusMessage(error?.message || 'Failed to save comic.');
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    loadContributions();
  }, [loadContributions]);

  return (
    <div className="suggestions-container">
      {/* Header */}
      <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 'bold' }}>
            {showForm ? 'Suggest New Comic' : 'Suggested Comics'}
          </h2>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          {showForm ? (
            <button
              type="button"
              className="ubtn ubtn--back ubtn--sm"
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
              className="ubtn ubtn--primary ubtn--sm"
              onClick={openCreateForm}
            >
              + Suggest Comic
            </button>
          )}
        </div>
      </div>

      {/* Tabs & Filters */}
      {!showForm && (
        <div className="nfilters" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div className="useg">
            <button
              type="button"
              className={`useg__btn ${activeTab === 'pending' ? 'is-on' : ''}`}
              onClick={() => setActiveTab('pending')}
            >
              <span className='useg__count mono'>{contributions.filter(c => c.status === 'pending').length}</span>
              Pending
            </button>
            <button
              type="button"
              className={`useg__btn ${activeTab === 'accept' ? 'is-on' : ''}`}
              onClick={() => setActiveTab('accept')}
            >
              <span className='useg__count mono'>{contributions.filter(c => c.status === 'accept').length}</span>
              Accepted
            </button>
            <button
              type="button"
              className={`useg__btn ${activeTab === 'reject' ? 'is-on' : ''}`}
              onClick={() => setActiveTab('reject')}
            >
              <span className='useg__count mono'>{contributions.filter(c => c.status === 'reject').length}</span>
              Rejected
            </button>
            <button
              type="button"
              className={`useg__btn ${activeTab === 'all' ? 'is-on' : ''}`}
              onClick={() => setActiveTab('all')}
            >
              <span className='useg__count mono'>{contributions.length}</span>
              All
            </button>
          </div>
        </div>
      )}

      {/* Thông báo lỗi hoặc Trạng thái tải */}
      {statusMessage && (
        <div className="status-message" style={{ padding: '12px', marginBottom: '16px', borderRadius: '4px', background: '#25262c', color: '#fff' }}>
          {statusMessage}
        </div>
      )}

      {loading ? (
        <div className="uempty">Loading...</div>
      ) : error ? (
        <div className="uempty">{error}</div>
      ) : showForm ? (
        /* Giao diện Form Gợi ý Comic */
        <div className="comic-form-container">
          <div className="comic-form-header">
            <h3 className="comic-form-title">{editingComicId ? 'Edit Comic' : 'Add New Comic'}</h3>
            <button
              type="button"
              className="comic-form-close-btn"
              onClick={() => {
                setShowForm(false);
                resetForm();
              }}
              aria-label="Close form"
            >
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="comic-form">
            {/* LEFT COLUMN */}
            <div className="comic-form-left">
              <div className="form-group">
                <label className="form-label">Image *</label>
                <div className="image-upload-box">
                  {previewImage ? (
                    <div className="image-preview">
                      <img src={previewImage} alt="Comic preview" className="preview-img" />
                      <button
                        type="button"
                        className="remove-image-btn"
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
                      className="image-upload-btn"
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

              <div className="form-row-2col">
                <div className="form-group">
                  <label className="form-label">Releasing Year</label>
                  <input
                    type="number"
                    className="form-input"
                    value={formData.releasingYear}
                    onChange={(e) => handleInputChange('releasingYear', parseInt(e.target.value) || new Date().getFullYear())}
                    min="1990"
                    max={new Date().getFullYear() + 1}
                  />
                </div>

                {/* 1. Dropdown STATUS_OPTIONS */}
                <div className="form-group">
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

              <div className="form-group">
                <label className="form-label">Author</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.author}
                  onChange={(e) => handleInputChange('author', e.target.value)}
                  placeholder="Enter author name"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Artist</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.artist}
                  onChange={(e) => handleInputChange('artist', e.target.value)}
                  placeholder="Enter artist name"
                />
              </div>
            </div>

            {/* RIGHT COLUMN */}
            <div className="comic-form-right">
              <div className="form-group">
                <label className="form-label">Name *</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="Enter comic name"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Slug (Auto-generated)</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.url}
                  onChange={(e) => handleInputChange('url', slugify(e.target.value))}
                  placeholder="comic-url-slug"
                  required
                />
              </div>

              <div className="form-row-3col">
                {/* 2. Dropdown TYPE_OPTIONS */}
                <div className="form-group">
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
                <div className="form-group">
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
                <div className="form-group">
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

              <div className="form-group">
                <label className="form-label">Other Names & Countries (per line)</label>
                <textarea
                  className="form-textarea"
                  value={formData.otherNames}
                  onChange={(e) => handleInputChange('otherNames', e.target.value)}
                  placeholder={`Name1,Country1\nName2,Country2`}
                  rows={3}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea
                  style={{ minHeight: '132px' }}
                  className="form-textarea"
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="Enter comic description"
                  rows={4}
                />
              </div>
            </div>

            {/* Formats - FULL WIDTH */}
            <div className="form-full">
              <div className="form-group">
                <label className="form-label">Formats</label>
                <div className="direct-tags-box">
                  <ul className="direct-tags-grid">
                    {ALL_FORMATS.map((format) => {
                      const isSelected = !!selectedFormats[format];
                      return (
                        <li key={format}>
                          <button
                            type="button"
                            className={`tagpop__item ${isSelected ? 'tag-on' : 'tag-off'}`}
                            onClick={() => toggleTag(format, false)}
                          >
                            <span className="tagpop__check" aria-hidden="true"></span>
                            <span className="tagpop__name">{format}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            </div>

            {/* Genres - FULL WIDTH */}
            <div className="form-full">
              <div className="form-group">
                <label className="form-label">Genres</label>
                <div className="direct-tags-box">
                  <ul className="direct-tags-grid">
                    {ALL_GENRES.map((genre) => {
                      const isSelected = !!selectedGenres[genre];
                      return (
                        <li key={genre}>
                          <button
                            type="button"
                            className={`tagpop__item ${isSelected ? 'tag-on' : 'tag-off'}`}
                            onClick={() => toggleTag(genre, true)}
                          >
                            <span className="tagpop__check" aria-hidden="true"></span>
                            <span className="tagpop__name">{genre}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="form-actions-full" style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
              <button type="submit" className="ubtn ubtn--primary" disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save Comic'}
              </button>
              <button
                type="button"
                className="ubtn ubtn--ghost"
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
        <ul className="nlist">
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
        <div className="uempty">
          <div className="uempty__icon">
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
          <div className="uempty__title">No suggestions found.</div>
          <div className="uempty__sub">
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