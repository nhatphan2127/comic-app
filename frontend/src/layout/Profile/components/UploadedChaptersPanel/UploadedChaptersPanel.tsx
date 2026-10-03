import { useState, useRef, useEffect, useCallback } from 'react';
import { X, GripVertical } from 'lucide-react';
import type { ChapterContributor, Chapter } from '../../../../types/types';
import { comicApi, chapterContributorApi } from '../../../../services/api';
import { ChapterRow } from '../../../../components/UploadChapterCard/UploadChapterCard'; 
import { slugify, parsePageNumber } from '../../../../helpers/utils';
import style from './UploadedChaptersPanel.module.css';

interface ChapterPage {
  id: string;
  file: File;
  previewUrl: string;
}

export default function UploadedChaptersPanel() {
  const [activeTab, setActiveTab] = useState<'all' | 'accept' | 'pending' | 'reject'>('all');

  // Danh sách dữ liệu chapter contributions
  const [contributions, setContributions] = useState<Array<ChapterContributor & { chapter?: Chapter }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [chapterNumber, setChapterNumber] = useState('');
  const [title, setTitle] = useState('');
  const [comicUrl, setComicUrl] = useState('');
  const [comicTitle, setComicTitle] = useState<string | null>(null);
  const [comicId, setComicId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [pages, setPages] = useState<ChapterPage[]>([]);
  const [isZip, setIsZip] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [editMode, setEditMode] = useState(false);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalUrl, setModalUrl] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);

  const filteredContributions = contributions.filter(contrib => activeTab === 'all' || contrib.status === activeTab);

  // Hàm tải danh sách chapter contributions từ server
  const loadContributions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await chapterContributorApi.listMyContributions();
      setContributions(items || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load contributions');
    } finally {
      setLoading(false);
    }
  }, []);

  // Thu hồi Object URLs khi unmount
  useEffect(() => {
    return () => {
      pages.forEach((page) => URL.revokeObjectURL(page.previewUrl));
    };
  }, [pages]);

  const validateAndSetImages = (inputFiles: File[]) => {
    const imageFiles = inputFiles.filter((f) => f.type.startsWith('image/'));
    if (imageFiles.length === 0) {
      setFormError('Please select image files or a single .zip file.');
      pages.forEach((page) => URL.revokeObjectURL(page.previewUrl));
      setPages([]);
      return;
    }

    const mapped = imageFiles.map((f) => ({ f, n: parsePageNumber(f.name) }));
    const hasNaN = mapped.some((m) => Number.isNaN(m.n));
    if (hasNaN) {
      setFormError('All image filenames must include a page number (e.g. "01", "1").');
      pages.forEach((page) => URL.revokeObjectURL(page.previewUrl));
      setPages([]);
      return;
    }

    const sorted = mapped.sort((a, b) => a.n - b.n).map((m) => m.f);
    const nums = mapped.map((m) => m.n).sort((a, b) => a - b);
    const start = nums[0];
    for (let i = 0; i < nums.length; i += 1) {
      if (nums[i] !== start + i) {
        setFormError('Page numbers must form a continuous sequence starting from the simplest number (e.g. 1,2,3...).');
        pages.forEach((page) => URL.revokeObjectURL(page.previewUrl));
        const newPages = sorted.map((file) => ({
          id: `${file.name}-${Date.now()}-${Math.random()}`,
          file,
          previewUrl: URL.createObjectURL(file)
        }));
        setPages(newPages);
        return;
      }
    }

    setFormError(null);
    pages.forEach((page) => URL.revokeObjectURL(page.previewUrl));
    const newPages = sorted.map((file) => ({
      id: `${file.name}-${Date.now()}-${Math.random()}`,
      file,
      previewUrl: URL.createObjectURL(file)
    }));
    setPages(newPages);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    if (selected.length === 0) return;

    if (selected.length === 1 && selected[0].name.toLowerCase().endsWith('.zip')) {
      setIsZip(true);
      pages.forEach((page) => URL.revokeObjectURL(page.previewUrl));
      setPages([{
        id: `zip-${Date.now()}`,
        file: selected[0],
        previewUrl: ''
      }]);
      setFormError('ZIP uploads are not supported by the current chapter upload API. Please upload image files.');
      return;
    }

    setIsZip(false);
    validateAndSetImages(selected);
  };

  const removeFileAt = (index: number) => {
    setPages((prev) => {
      const target = prev[index];
      if (target && target.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  const onDragStart = (e: React.DragEvent, index: number) => {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const onDragOverItem = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex !== index && dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const onDragLeaveItem = () => {
    setDragOverIndex(null);
  };

  const onDropItem = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex == null || dragIndex === index) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }

    setPages((prev) => {
      const copy = [...prev];
      const [moved] = copy.splice(dragIndex, 1);
      copy.splice(index, 0, moved);
      return copy;
    });

    setDragIndex(null);
    setDragOverIndex(null);
  };

  const onDragEnd = () => {
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const openModal = (page: ChapterPage) => {
    if (!page.previewUrl) return;
    setModalUrl(page.previewUrl);
    setModalOpen(true);
    setZoom(1);
  };

  const closeModal = () => {
    setModalUrl(null);
    setModalOpen(false);
    setZoom(1);
  };

  const zoomIn = () => setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)));
  const zoomOut = () => setZoom((z) => Math.max(0.25, +(z - 0.25).toFixed(2)));
  const resetZoom = () => setZoom(1);

  const fetchComicByUrl = async (url: string) => {
    if (!url.trim()) {
      setComicId(null);
      setComicTitle(null);
      return;
    }
    try {
      const comic = await comicApi.getByUrl(url.trim());
      setComicId(comic.id);
      setComicTitle(comic.name || 'Unknown title');
      setFormError(null);
    } catch (err) {
      setComicId(null);
      setComicTitle(null);
      setFormError('Comic not found. Please enter a valid comic URL.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comicUrl.trim()) {
      setFormError('Comic URL is required.');
      return;
    }
    if (!comicId) {
      setFormError('Please verify the comic URL before uploading the chapter.');
      return;
    }
    if (!chapterNumber) {
      setFormError('Chapter number is required.');
      return;
    }
    if (!title) {
      setFormError('Chapter title is required.');
      return;
    }
    if (pages.length === 0) {
      setFormError('Please upload chapter pages as images.');
      return;
    }
    if (isZip) {
      setFormError('ZIP uploads are not supported by the current chapter upload API. Please upload image files.');
      return;
    }

    const nums = pages.map((p) => parsePageNumber(p.file.name));
    if (nums.some((n) => Number.isNaN(n))) {
      setFormError('All image filenames must include numeric page indices.');
      return;
    }
    const min = Math.min(...nums);
    for (let i = 0; i < nums.length; i += 1) {
      if (nums[i] !== min + i) {
        setFormError('Pages must be ordered from simplest to largest (1..n). Reorder or rename files.');
        return;
      }
    }

    const formData = new FormData();
    formData.append('title', title.trim());
    formData.append('chapterNumber', chapterNumber.trim());
    formData.append('url', slugify(`${comicUrl.trim()}-${chapterNumber.trim()}`));

    pages.forEach((page) => {
      formData.append('images', page.file);
    });

    try {
      setIsSaving(true);
      await comicApi.createChapter(comicId, formData);
      setFormError(null);
      setComicUrl('');
      setComicId(null);
      setComicTitle(null);
      setChapterNumber('');
      setTitle('');
      pages.forEach((p) => URL.revokeObjectURL(p.previewUrl));
      setPages([]);
      setIsZip(false);
      setShowForm(false);
      await loadContributions();
    } catch (submitError: unknown) {
      setFormError(submitError instanceof Error ? submitError.message : 'Chapter upload failed.');
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    loadContributions();
  }, [loadContributions]);

  return (
    <div className={style['user-content']}>
      <div className={style['uview']}>
        {/* Phần đầu Tiêu đề & Công cụ */}
        <div className={`${style['uview__head']} ${style['uview__head--row']}`}>
          <div>
            <h2 className={style['uview__title']}>
              {showForm ? 'Upload Chapter' : 'Uploaded Chapters'}
            </h2>
            <p className={style['uview__sub']}>
              {showForm 
                ? 'Fill in the form below to upload a new chapter.' 
                : 'Review your recent uploads and their current status.'}
            </p>
          </div>
          <div className={style['uview__head-tools']}>
            {showForm ? (
              <button
                type="button"
                className={`${style['ubtn']} ${style['ubtn--secondary']} ${style['ubtn--sm']}`}
                onClick={() => setShowForm(false)}
              >
                Back
              </button>
            ) : (
              <button
                type="button"
                className={`${style['ubtn']} ${style['ubtn--primary']} ${style['ubtn--sm']}`}
                onClick={() => setShowForm(true)}
              >
                + Upload Chapter
              </button>
            )}
          </div>
        </div>

        {/* Thanh Bộ lọc (Filters) - Chỉ hiển thị khi showForm là false */}
        {!showForm && (
          <div className={style['nfilters']}>
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

        {/* Kiểm tra điều kiện hiển thị danh sách hoặc form */}
        {loading ? (
          <div className={style['uempty']}>Loading...</div>
        ) : error ? (
          <div className={style['uempty']}>{error}</div>
        ) : showForm ? (
          <div className={style['comic-form-container']}>
            <div className={style['comic-form-header']}>
              <h3 className={style['comic-form-title']}>Upload Chapter</h3>
            </div>

            <form onSubmit={handleSubmit} className={style['comic-form']}>
              <div className={style['form-row-2col']}>
                <div className={style['form-group']}>
                  <label className={style['form-label']}>Comic URL *</label>
                  <div className={style['form-row-inline']}>
                    <input
                      type="text"
                      className={style['form-input']}
                      value={comicUrl}
                      onChange={(e) => setComicUrl(e.target.value)}
                      onBlur={() => fetchComicByUrl(comicUrl)}
                      placeholder="comic-url-slug"
                      required
                    />
                  </div>
                </div>

                <div className={style['form-group']}>
                  <label className={style['form-label']}>Chapter Number *</label>
                  <input
                    type="number"
                    min="1"
                    className={style['form-input']}
                    value={chapterNumber}
                    onChange={(e) => setChapterNumber(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className={style['form-group']}>
                <label className={style['form-label']}>Title *</label>
                <input
                  type="text"
                  className={style['form-input']}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Chapter title"
                  required
                />
              </div>

              <div className={style['form-full']}>
                {comicTitle && <p className={style['form-note']}>Comic found: {comicTitle}</p>}
                {formError && <div className={style['form-error']}>{formError}</div>}
              </div>

              <div className={style['form-group']}>
                <label className={style['form-label']}>Chapter Pages *</label>
                <p className={style['form-note']}>Select multiple image files with page numbers in filenames (e.g. 1, 2, 3...).</p>
                <div className={style['file-input-wrapper']}>
                  <button
                    type="button"
                    className={style['comic-form-toggle-btn']}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Choose Files
                  </button>
                  <span className={style['file-count']}>{pages.length > 0 ? `${pages.length} files` : ''}</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                  />
                </div>
              </div>

              {pages.length > 0 && (
                <div className={style['form-full']}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <label className={style['form-label']} style={{ margin: 0 }}>Preview & Order</label>
                    {!isZip && (
                      <label className={style['switch-container']}>
                        <input
                          type="checkbox"
                          className={style['switch-input']}
                          checked={editMode}
                          onChange={() => setEditMode((s) => !s)}
                        />
                        <span className={style['switch-slider']} />
                        <span>Edit order (Drag & Drop)</span>
                      </label>
                    )}
                  </div>

                  <ul className={`${style['preview-list']} ${dragIndex !== null ? style['drag-active'] || 'drag-active' : ''}`}>
                    {pages.map((p, i) => {
                      let shiftStyle: React.CSSProperties = {};
                      if (dragIndex !== null && dragOverIndex !== null && dragIndex !== dragOverIndex) {
                        if (dragIndex < dragOverIndex) {
                          if (i > dragIndex && i <= dragOverIndex) {
                            shiftStyle = { transform: 'translateX(-20px)' };
                          }
                        } else {
                          if (i >= dragOverIndex && i < dragIndex) {
                            shiftStyle = { transform: 'translateX(20px)' };
                          }
                        }
                      }

                      return (
                        <li
                          key={p.id}
                          className={`${style['preview-item']} ${dragIndex === i ? style['dragging'] || 'dragging' : ''} ${editMode && !isZip ? style['draggable-enabled'] || 'draggable-enabled' : ''} ${dragOverIndex === i ? style['drag-over'] || 'drag-over' : ''}`}
                          style={shiftStyle}
                          draggable={editMode && !isZip}
                          onDragStart={(e) => editMode && !isZip && onDragStart(e, i)}
                          onDragOver={(e) => editMode && !isZip && onDragOverItem(e, i)}
                          onDragLeave={() => editMode && !isZip && onDragLeaveItem()}
                          onDrop={(e) => editMode && !isZip && onDropItem(e, i)}
                          onDragEnd={onDragEnd}
                        >
                          <div style={{ position: 'relative' }}>
                            {p.file.type.startsWith('image/') ? (
                              <>
                                {editMode && (
                                  <div className={style['drag-grip-indicator']} title="Drag to reorder">
                                    <GripVertical size={14} />
                                  </div>
                                )}
                                <img
                                  src={p.previewUrl}
                                  alt={p.file.name}
                                  className={style['preview-thumb']}
                                  onClick={() => !editMode && openModal(p)}
                                  style={{ cursor: editMode ? 'grab' : 'zoom-in' }}
                                />
                                <div className={style['page-badge']}>Pg. {i + 1}</div>
                              </>
                            ) : (
                              <div className={`${style['preview-thumb']} ${style['placeholder'] || 'placeholder'}`}>{p.file.name}</div>
                            )}
                            <button
                              type="button"
                              className={`${style['remove-image-btn']} ${style['small'] || 'small'}`}
                              onClick={() => removeFileAt(i)}
                              aria-label="Remove"
                              style={{ zIndex: 3 }}
                            >
                              <X size={12} />
                            </button>
                          </div>
                          <div className={style['preview-meta']}>
                            <div className={style['preview-name']} title={p.file.name}>{p.file.name}</div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              <div className={style['form-actions-full']}>
                <button type="submit" className={`${style['ubtn']} ${style['ubtn--primary']}`} disabled={isSaving}>
                  {isSaving ? 'Uploading...' : 'Upload Chapter'}
                </button>
                <button type="button" className={`${style['ubtn']} ${style['ubtn--ghost']}`} onClick={() => setShowForm(false)}>Cancel</button>
              </div>
            </form>

            {modalOpen && modalUrl && (
              <div className={style['preview-modal']} onClick={closeModal}>
                <div className={style['modal-content']} onClick={(e) => e.stopPropagation()}>
                  <div className={style['modal-toolbar']}>
                    <button type="button" onClick={zoomOut} aria-label="Zoom out">-</button>
                    <button type="button" onClick={resetZoom} aria-label="Reset zoom">Reset</button>
                    <button type="button" onClick={zoomIn} aria-label="Zoom in">+</button>
                    <button type="button" onClick={closeModal} className={style['modal-close']} aria-label="Close">Close</button>
                  </div>
                  <div className={style['modal-body']}>
                    <img src={modalUrl} alt="preview" className={style['modal-img']} style={{ transform: `scale(${zoom})` }} />
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : filteredContributions.length > 0 ? (
          <ul className={style['nlist']} style={{ listStyle: 'none', padding: 0 }}>
            {filteredContributions.map((contrib) => (
              <ChapterRow
                key={`${contrib.chapterId}-${contrib.userId}`}
                contributor={contrib as ChapterContributor}
                onClick={() => undefined}
              />
            ))}
          </ul>
        ) : (
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
                <path d="M9 12h6m-6 4h6M5 8h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2z"></path>
              </svg>
            </div>
            <div className={style['uempty__title']}>No uploads yet.</div>
            <div className={style['uempty__sub']}>
              {activeTab === 'accept' 
                ? 'No accepted uploads yet.' 
                : activeTab === 'pending'
                ? 'No pending uploads yet.'
                : activeTab === 'reject'
                ? 'No rejected uploads yet.'
                : 'Start uploading chapters to help expand the library.'
              }
            </div>
          </div>
        )}
      </div>
    </div>
  );
}