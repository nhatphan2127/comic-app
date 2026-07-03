// // import { useEffect, useState, useCallback, useRef } from 'react';
// // import { Upload, X } from 'lucide-react';
// // import type { Comic, ComicContributor } from '../../../types/data';
// // import { comicApi, comicContributorApi, API_UPLOADS } from '../../../services/api';
// // import { formatTimeAgo } from '../../../helpers/formatDate';
// // import '../../../assets/styles/ComicForm.css';

// // const TYPE_OPTIONS = ['Manga', 'Manhwa', 'Manhua', 'Other'];
// // const DEMOGRAPHIC_OPTIONS = ['Josei', 'Seinen', 'Shoujo', 'Shounen'];
// // const STATUS_OPTIONS = ['Releasing', 'Finished', 'On hiatus', 'Discontinued'];

// // const ALL_GENRES = [
// //   'Action', 'Adult', 'Adventure', 'Boys Love', 'Comedy', 'Crime', 'Drama', 'Ecchi', 
// //   'Fantasy', 'Girls Love', 'Harem', 'Hentai', 'Historical', 'Horror', 'Isekai', 
// //   'Magical Girls', 'Mature', 'Mecha', 'Medical', 'Mystery', 'Philosophical', 
// //   'Psychological', 'Romance', 'Sci-Fi', 'Slice of Life', 'Smut', 'Sports', 
// //   'Superhero', 'Thriller', 'Tragedy', 'Wuxia'
// // ];

// // const ALL_FORMATS = [
// //   '4-Koma', 'Adaptation', 'Anthology', 'Award Winning', 'Doujinshi', 
// //   'Full Color', 'Long Strip', 'Oneshot', 'Web Comic'
// // ];

// // const isUnread = (contrib: ComicContributor): boolean => contrib.unread === 1;

// // export default function ComicSuggestionPanel() {
// //   // Tab lọc trạng thái (status) & Lọc All/Unread
// //   const [activeTab, setActiveTab] = useState<'all' | 'accept' | 'pending' | 'reject'>('all');
// //   const [activeFilter, setActiveFilter] = useState<'all' | 'unread'>('all');

// //   // Danh sách dữ liệu gợi ý từ contributor
// //   const [contributions, setContributions] = useState<Array<ComicContributor & { comic?: Comic }>>([]);
// //   const [loading, setLoading] = useState(false);
// //   const [error, setError] = useState<string | null>(null);

// //   // Form State
// //   const [showForm, setShowForm] = useState(false);
// //   const [formData, setFormData] = useState({
// //     name: '',
// //     source: '',
// //     url: '',
// //     description: '',
// //     image: null as File | null,
// //     type: '',
// //     releasingYear: new Date().getFullYear(),
// //     author: '',
// //     artist: '',
// //     otherNames: '',
// //     correspondingCountries: '',
// //   });
// //   const [statusMessage, setStatusMessage] = useState<string | null>(null);
// //   const [isSaving, setIsSaving] = useState(false);

// //   const [selectedGenres, setSelectedGenres] = useState<Record<string, boolean>>({});
// //   const [selectedFormats, setSelectedFormats] = useState<Record<string, boolean>>({});
// //   const [selectedDemographic, setSelectedDemographic] = useState('');
// //   const [selectedStatus, setSelectedStatus] = useState('');

// //   const imageInputRef = useRef<HTMLInputElement>(null);
// //   const [previewImage, setPreviewImage] = useState<string | null>(null);

// //   // Đếm số thông báo chưa đọc theo từng Tab
// //   const acceptUnreadCount = contributions.filter(c => isUnread(c) && c.status === 'accept').length;
// //   const pendingUnreadCount = contributions.filter(c => isUnread(c) && c.status === 'pending').length;
// //   const rejectUnreadCount = contributions.filter(c => isUnread(c) && c.status === 'reject').length;
// //   const totalUnreadCount = acceptUnreadCount + pendingUnreadCount + rejectUnreadCount;

// //   // Slug generator helper
// //   const slugify = (text: string) => text
// //     .toString()
// //     .normalize('NFD')
// //     .replace(/\p{Diacritic}/gu, '')
// //     .toLowerCase()
// //     .trim()
// //     .replace(/\s+/g, '-')
// //     .replace(/[^\w-]/g, '')
// //     .replace(/-+/g, '-');

// //   // Lọc danh sách hiển thị kết hợp cả Tab lẫn Bộ lọc Chưa đọc (Unread)
// //   const filteredContributions = contributions.filter(contrib => {
// //     const matchesTab = activeTab === 'all' || contrib.status === activeTab;
// //     const matchesFilter = activeFilter === 'all' || (activeFilter === 'unread' && isUnread(contrib));
// //     return matchesTab && matchesFilter;
// //   });

// //   // Tải danh sách đóng góp từ API
// //   const loadContributions = useCallback(async () => {
// //     setLoading(true);
// //     setError(null);
// //     try {
// //       const items = await comicContributorApi.listMyContributions();
// //       setContributions(items || []);
// //     } catch (err: any) {
// //       setError(err?.message || 'Failed to load contributions');
// //     } finally {
// //       setLoading(false);
// //     }
// //   }, []);

// //   // Đánh dấu đã đọc toàn bộ của tab hiện tại
// //   const handleMarkAllRead = async () => {
// //     const unreadInCurrentTab = contributions.filter(
// //       c => isUnread(c) && (activeTab === 'all' || c.status === activeTab)
// //     );
// //     if (unreadInCurrentTab.length === 0) return;

// //     // Cập nhật cục bộ trước (Optimistic UI)
// //     setContributions(prev =>
// //       prev.map(c => {
// //         if (isUnread(c) && (activeTab === 'all' || c.status === activeTab)) {
// //           return { ...c, unread: 0 };
// //         }
// //         return c;
// //       })
// //     );

// //     try {
// //       await Promise.all(unreadInCurrentTab.map(c => comicContributorApi.markRead(c.comicId, c.userId)));
// //     } catch (err) {
// //       console.error('Error marking as read:', err);
// //     } finally {
// //       await loadContributions();
// //     }
// //   };

// //   const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
// //     const file = e.target.files?.[0];
// //     if (file) {
// //       setFormData((prev) => ({ ...prev, image: file }));
// //       const reader = new FileReader();
// //       reader.onload = (event) => {
// //         setPreviewImage(event.target?.result as string);
// //       };
// //       reader.readAsDataURL(file);
// //     }
// //   };

// //   const handleInputChange = (field: string, value: any) => {
// //     setFormData((prev) => {
// //       const updated = { ...prev, [field]: value };
// //       // Nếu đổi Name và trường URL (Slug) trống hoặc khớp với slug cũ, tự động sinh slug mới
// //       if (field === 'name') {
// //         updated.url = slugify(value);
// //       }
// //       return updated;
// //     });
// //   };

// //   const toggleTag = (tag: string, isGenre: boolean) => {
// //     const setState = isGenre ? setSelectedGenres : setSelectedFormats;
// //     setState((prev) => {
// //       const updated = { ...prev };
// //       if (updated[tag]) {
// //         delete updated[tag];
// //       } else {
// //         updated[tag] = true;
// //       }
// //       return updated;
// //     });
// //   };

// //   const handleSubmit = async (e: React.FormEvent) => {
// //     e.preventDefault();
// //     setStatusMessage(null);

// //     if (!formData.name.trim()) {
// //       setStatusMessage('Comic name is required.');
// //       return;
// //     }
// //     if (!formData.type) {
// //       setStatusMessage('Comic type is required.');
// //       return;
// //     }
// //     if (!selectedDemographic) {
// //       setStatusMessage('Demographic is required.');
// //       return;
// //     }
// //     if (!formData.image) {
// //       setStatusMessage('Cover image is required.');
// //       return;
// //     }
// //     if (!formData.url.trim()) {
// //       setStatusMessage('Comic URL/Slug is required.');
// //       return;
// //     }

// //     const form = new FormData();
// //     form.append('name', formData.name.trim());
// //     form.append('source', formData.source.trim());
// //     form.append('url', slugify(formData.url.trim()));
// //     form.append('description', formData.description.trim());
// //     form.append('types', formData.type);
// //     form.append('contentRating', 'safe');
// //     form.append('demographic', selectedDemographic);
// //     form.append('releaseStatus', selectedStatus || 'releasing');
// //     form.append('releasingYear', String(formData.releasingYear));
    
// //     if (formData.author.trim()) form.append('author', formData.author.trim());
// //     if (formData.artist.trim()) form.append('artist', formData.artist.trim());
// //     if (formData.image) form.append('coverImage', formData.image);

// //     Object.keys(selectedGenres).forEach((genre) => form.append('genres', genre));
// //     Object.keys(selectedFormats).forEach((format) => form.append('formats', format));

// //     try {
// //       setIsSaving(true);
// //       await comicApi.create(form);
// //       setStatusMessage('Comic created successfully.');
// //       setShowForm(false);
// //       setFormData({
// //         name: '',
// //         source: '',
// //         url: '',
// //         description: '',
// //         image: null,
// //         type: '',
// //         releasingYear: new Date().getFullYear(),
// //         author: '',
// //         artist: '',
// //         otherNames: '',
// //         correspondingCountries: '',
// //       });
// //       setSelectedGenres({});
// //       setSelectedFormats({});
// //       setSelectedDemographic('');
// //       setSelectedStatus('');
// //       setPreviewImage(null);
// //       await loadContributions();
// //     } catch (error: any) {
// //       setStatusMessage(error?.message || 'Failed to save comic.');
// //     } finally {
// //       setIsSaving(false);
// //     }
// //   };

// //   useEffect(() => {
// //     loadContributions();
// //   }, [loadContributions]);

// //   return (
// //     <div className="suggestions-container">
// //       {/* Header */}
// //       <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
// //         <div>
// //           <h2 style={{ fontSize: '20px', fontWeight: 'bold' }}>Suggested Comics</h2>
// //           <span style={{ fontSize: '13px', color: '#8a8b92' }}>
// //             {totalUnreadCount} unread total.
// //           </span>
// //         </div>

// //         <div style={{ display: 'flex', gap: '8px' }}>
// //           {totalUnreadCount > 0 && (
// //             <button
// //               type="button"
// //               className="ubtn ubtn--ghost ubtn--sm"
// //               onClick={handleMarkAllRead}
// //             >
// //               Mark all as read
// //             </button>
// //           )}
// //           <button
// //             type="button"
// //             className="ubtn ubtn--primary ubtn--sm"
// //             onClick={() => setShowForm(true)}
// //           >
// //             + Suggest Comic
// //           </button>
// //         </div>
// //       </div>

// //       {/* Tabs & Filters */}
// //       {!showForm && (
// //         <div className="nfilters" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
// //           {/* Trạng thái duyệt */}
// //           <div className="useg">
// //             <button
// //               type="button"
// //               className={`useg__btn ${activeTab === 'all' ? 'is-on' : ''}`}
// //               onClick={() => setActiveTab('all')}
// //             >
// //               <span>All</span>
// //               {totalUnreadCount > 0 && <span className="useg__count mono">{totalUnreadCount}</span>}
// //             </button>
// //             <button
// //               type="button"
// //               className={`useg__btn ${activeTab === 'accept' ? 'is-on' : ''}`}
// //               onClick={() => setActiveTab('accept')}
// //             >
// //               <span>Accepted</span>
// //               {acceptUnreadCount > 0 && <span className="useg__count mono">{acceptUnreadCount}</span>}
// //             </button>
// //             <button
// //               type="button"
// //               className={`useg__btn ${activeTab === 'pending' ? 'is-on' : ''}`}
// //               onClick={() => setActiveTab('pending')}
// //             >
// //               <span>Pending</span>
// //               {pendingUnreadCount > 0 && <span className="useg__count mono">{pendingUnreadCount}</span>}
// //             </button>
// //             <button
// //               type="button"
// //               className={`useg__btn ${activeTab === 'reject' ? 'is-on' : ''}`}
// //               onClick={() => setActiveTab('reject')}
// //             >
// //               <span>Rejected</span>
// //               {rejectUnreadCount > 0 && <span className="useg__count mono">{rejectUnreadCount}</span>}
// //             </button>
// //           </div>

// //           {/* Chưa đọc / Đã đọc */}
// //           <div className="useg">
// //             <button
// //               type="button"
// //               className={`useg__btn ${activeFilter === 'all' ? 'is-on' : ''}`}
// //               onClick={() => setActiveFilter('all')}
// //             >
// //               All
// //             </button>
// //             <button
// //               type="button"
// //               className={`useg__btn ${activeFilter === 'unread' ? 'is-on' : ''}`}
// //               onClick={() => setActiveFilter('unread')}
// //             >
// //               Unread
// //             </button>
// //           </div>
// //         </div>
// //       )}

// //       {/* Thông báo lỗi hoặc Trạng thái tải */}
// //       {statusMessage && (
// //         <div className="status-message" style={{ padding: '12px', marginBottom: '16px', borderRadius: '4px', background: '#25262c', color: '#fff' }}>
// //           {statusMessage}
// //         </div>
// //       )}

// //       {loading ? (
// //         <div className="uempty">Loading...</div>
// //       ) : error ? (
// //         <div className="uempty">{error}</div>
// //       ) : showForm ? (
// //         /* Giao diện Form Gợi ý Comic mới */
// //         <div className="comic-form-container">
// //           <div className="comic-form-header">
// //             <h3 className="comic-form-title">Add New Comic</h3>
// //             <button
// //               type="button"
// //               className="comic-form-close-btn"
// //               onClick={() => setShowForm(false)}
// //               aria-label="Close form"
// //             >
// //               <X size={20} />
// //             </button>
// //           </div>

// //           <form onSubmit={handleSubmit} className="comic-form">
// //             {/* LEFT COLUMN */}
// //             <div className="comic-form-left">
// //               <div className="form-group">
// //                 <label className="form-label">Image *</label>
// //                 <div className="image-upload-box">
// //                   {previewImage ? (
// //                     <div className="image-preview">
// //                       <img src={previewImage} alt="Comic preview" className="preview-img" />
// //                       <button
// //                         type="button"
// //                         className="remove-image-btn"
// //                         onClick={() => {
// //                           setPreviewImage(null);
// //                           setFormData((prev) => ({ ...prev, image: null }));
// //                           if (imageInputRef.current) imageInputRef.current.value = '';
// //                         }}
// //                       >
// //                         <X size={16} />
// //                       </button>
// //                     </div>
// //                   ) : (
// //                     <button
// //                       type="button"
// //                       className="image-upload-btn"
// //                       onClick={() => imageInputRef.current?.click()}
// //                     >
// //                       <Upload size={24} strokeWidth={1.5} />
// //                       <span>Click to upload image</span>
// //                     </button>
// //                   )}
// //                   <input
// //                     ref={imageInputRef}
// //                     type="file"
// //                     accept="image/*"
// //                     onChange={handleImageUpload}
// //                     style={{ display: 'none' }}
// //                   />
// //                 </div>
// //               </div>

// //               <div className="form-row-2col">
// //                 <div className="form-group">
// //                   <label className="form-label">Releasing Year</label>
// //                   <input
// //                     type="number"
// //                     className="form-input"
// //                     value={formData.releasingYear}
// //                     onChange={(e) => handleInputChange('releasingYear', parseInt(e.target.value) || new Date().getFullYear())}
// //                     min="1990"
// //                     max={new Date().getFullYear() + 1}
// //                   />
// //                 </div>

// //                 <div className="form-group">
// //                   <label className="form-label">Releasing Status</label>
// //                   <select
// //                     className="form-select"
// //                     value={selectedStatus}
// //                     onChange={(e) => setSelectedStatus(e.target.value)}
// //                   >
// //                     <option value="">Choose status</option>
// //                     {STATUS_OPTIONS.map((status) => (
// //                       <option key={status} value={status}>{status}</option>
// //                     ))}
// //                   </select>
// //                 </div>
// //               </div>

// //               <div className="form-row-2col">
// //                 <div className="form-group">
// //                   <label className="form-label">Author</label>
// //                   <input
// //                     type="text"
// //                     className="form-input"
// //                     value={formData.author}
// //                     onChange={(e) => handleInputChange('author', e.target.value)}
// //                     placeholder="Enter author name"
// //                   />
// //                 </div>

// //                 <div className="form-group">
// //                   <label className="form-label">Artist</label>
// //                   <input
// //                     type="text"
// //                     className="form-input"
// //                     value={formData.artist}
// //                     onChange={(e) => handleInputChange('artist', e.target.value)}
// //                     placeholder="Enter artist name"
// //                   />
// //                 </div>
// //               </div>

// //               <div className="form-row-2col">
// //                 <div className="form-group">
// //                   <label className="form-label">Type *</label>
// //                   <select
// //                     className="form-select"
// //                     value={formData.type}
// //                     onChange={(e) => handleInputChange('type', e.target.value)}
// //                     required
// //                   >
// //                     <option value="">Choose type</option>
// //                     {TYPE_OPTIONS.map((type) => (
// //                       <option key={type} value={type}>{type}</option>
// //                     ))}
// //                   </select>
// //                 </div>

// //                 <div className="form-group">
// //                   <label className="form-label">Demographic *</label>
// //                   <select
// //                     className="form-select"
// //                     value={selectedDemographic}
// //                     onChange={(e) => setSelectedDemographic(e.target.value)}
// //                     required
// //                   >
// //                     <option value="">Choose Demographic</option>
// //                     {DEMOGRAPHIC_OPTIONS.map((demo) => (
// //                       <option key={demo} value={demo}>{demo}</option>
// //                     ))}
// //                   </select>
// //                 </div>
// //               </div>
// //             </div>

// //             {/* RIGHT COLUMN */}
// //             <div className="comic-form-right">
// //               <div className="form-group">
// //                 <label className="form-label">Name *</label>
// //                 <input
// //                   type="text"
// //                   className="form-input"
// //                   value={formData.name}
// //                   onChange={(e) => handleInputChange('name', e.target.value)}
// //                   placeholder="Enter comic name"
// //                   required
// //                 />
// //               </div>

// //               <div className="form-group">
// //                 <label className="form-label">Slug (Auto-generated)</label>
// //                 <input
// //                   type="text"
// //                   className="form-input"
// //                   value={formData.url}
// //                   onChange={(e) => handleInputChange('url', slugify(e.target.value))}
// //                   placeholder="comic-url-slug"
// //                   required
// //                 />
// //               </div>

// //               <div className="form-group">
// //                 <label className="form-label">Other Names & Countries (per line)</label>
// //                 <textarea
// //                   className="form-textarea"
// //                   value={formData.otherNames}
// //                   onChange={(e) => handleInputChange('otherNames', e.target.value)}
// //                   placeholder={`Name1,Country1\nName2,Country2`}
// //                   rows={3}
// //                 />
// //               </div>

// //               <div className="form-group">
// //                 <label className="form-label">Description</label>
// //                 <textarea
// //                   style={{ minHeight: '140px' }}
// //                   className="form-textarea"
// //                   value={formData.description}
// //                   onChange={(e) => handleInputChange('description', e.target.value)}
// //                   placeholder="Enter comic description"
// //                   rows={4}
// //                 />
// //               </div>
// //             </div>

// //             {/* Formats - FULL WIDTH */}
// //             <div className="form-full">
// //               <div className="form-group">
// //                 <label className="form-label">Formats</label>
// //                 <div className="direct-tags-box">
// //                   <ul className="direct-tags-grid">
// //                     {ALL_FORMATS.map((format) => {
// //                       const isSelected = !!selectedFormats[format];
// //                       return (
// //                         <li key={format}>
// //                           <button
// //                             type="button"
// //                             className={`tagpop__item ${isSelected ? 'tag-on' : 'tag-off'}`}
// //                             onClick={() => toggleTag(format, false)}
// //                           >
// //                             <span className="tagpop__check" aria-hidden="true"></span>
// //                             <span className="tagpop__name">{format}</span>
// //                           </button>
// //                         </li>
// //                       );
// //                     })}
// //                   </ul>
// //                 </div>
// //               </div>
// //             </div>

// //             {/* Genres - FULL WIDTH */}
// //             <div className="form-full">
// //               <div className="form-group">
// //                 <label className="form-label">Genres</label>
// //                 <div className="direct-tags-box">
// //                   <ul className="direct-tags-grid">
// //                     {ALL_GENRES.map((genre) => {
// //                       const isSelected = !!selectedGenres[genre];
// //                       return (
// //                         <li key={genre}>
// //                           <button
// //                             type="button"
// //                             className={`tagpop__item ${isSelected ? 'tag-on' : 'tag-off'}`}
// //                             onClick={() => toggleTag(genre, true)}
// //                           >
// //                             <span className="tagpop__check" aria-hidden="true"></span>
// //                             <span className="tagpop__name">{genre}</span>
// //                           </button>
// //                         </li>
// //                       );
// //                     })}
// //                   </ul>
// //                 </div>
// //               </div>
// //             </div>

// //             {/* Actions */}
// //             <div className="form-actions-full" style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
// //               <button type="submit" className="ubtn ubtn--primary" disabled={isSaving}>
// //                 {isSaving ? 'Saving...' : 'Save Comic'}
// //               </button>
// //               <button
// //                 type="button"
// //                 className="ubtn ubtn--ghost"
// //                 onClick={() => setShowForm(false)}
// //               >
// //                 Cancel
// //               </button>
// //             </div>
// //           </form>
// //         </div>
// //       ) : filteredContributions.length > 0 ? (
// //         /* Giao diện danh sách gợi ý */
// //         <ul className="nlist">
// //           {filteredContributions.map((contrib) => {
// //             const isUnreadItem = isUnread(contrib);
// //             const comic = contrib.comic || {};

// //             return (
// //               <li
// //                 key={`${contrib.comicId}-${contrib.userId}`}
// //                 className={`nrow ${isUnreadItem ? 'is-unread' : ''} is-clickable`}
// //                 onClick={async () => {
// //                   if (isUnreadItem) {
// //                     try {
// //                       // Đánh dấu đã đọc cục bộ
// //                       setContributions(prev =>
// //                         prev.map(c =>
// //                           c.comicId === contrib.comicId && c.userId === contrib.userId
// //                             ? { ...c, unread: 0 }
// //                             : c
// //                         )
// //                       );
// //                       await comicContributorApi.markRead(contrib.comicId, contrib.userId);
// //                     } catch (_) {}
// //                   }
// //                 }}
// //               >
// //                 {/* Trạng thái duyệt */}
// //                 <div className="nrow__icon">
// //                   <span style={{
// //                     display: 'inline-block',
// //                     padding: '4px 8px',
// //                     borderRadius: '4px',
// //                     fontSize: '11px',
// //                     fontWeight: 'bold',
// //                     textTransform: 'uppercase',
// //                     backgroundColor:
// //                       contrib.status === 'accept' ? '#28a745' :
// //                         contrib.status === 'reject' ? '#dc3545' :
// //                           '#ffc107',
// //                     color: contrib.status === 'accept' || contrib.status === 'reject' ? '#fff' : '#000'
// //                   }}>
// //                     {contrib.status}
// //                   </span>
// //                 </div>

// //                 {/* Nội dung đóng góp */}
// //                 <div className="nrow__body">
// //                   <div className="nrow__text">
// //                     <b>{comic.name || 'Unknown Comic'}</b>
// //                   </div>
// //                   <div className="nrow__meta">
// //                     <span>{formatTimeAgo(contrib.updatedAt || contrib.createdAt)}</span>
// //                   </div>
// //                 </div>

// //                 {/* Poster đại diện */}
// //                 <div className="nrow__poster">
// //                   <div className="poster poster--xs">
// //                     <img
// //                       alt=""
// //                       loading="lazy"
// //                       src={comic.coverUrl ? (comic.coverUrl.startsWith('http') ? comic.coverUrl : API_UPLOADS + comic.coverUrl) : API_UPLOADS + 'comic/default-cover.jpg'}
// //                     />
// //                   </div>
// //                 </div>
// //               </li>
// //             );
// //           })}
// //         </ul>
// //       ) : (
// //         /* Trạng thái danh sách rỗng */
// //         <div className="uempty">
// //           <div className="uempty__icon">
// //             <svg
// //               width="24"
// //               height="24"
// //               viewBox="0 0 24 24"
// //               fill="none"
// //               stroke="currentColor"
// //               strokeWidth="1.8"
// //               strokeLinecap="round"
// //               strokeLinejoin="round"
// //               aria-hidden="true"
// //             >
// //               <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
// //               <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
// //             </svg>
// //           </div>
// //           <div className="uempty__title">No suggestions found.</div>
// //           <div className="uempty__sub">
// //             {activeTab === 'accept'
// //               ? 'No accepted suggestions.'
// //               : activeTab === 'pending'
// //                 ? 'No pending suggestions.'
// //                 : activeTab === 'reject'
// //                   ? 'No rejected suggestions.'
// //                   : 'Start suggesting comics to expand the library.'}
// //           </div>
// //         </div>
// //       )}
// //     </div>
// //   );
// // }

// import { useEffect, useState, useCallback, useRef } from 'react';
// import { Link } from 'react-router-dom';
// import { Upload, X } from 'lucide-react';
// import type { ComicContributor } from '../../../types/data';
// import { comicApi, comicContributorApi, API_UPLOADS } from '../../../services/api';
// import { formatTimeAgo } from '../../../helpers/formatDate';
// import '../../../assets/styles/ComicForm.css';

// const TYPE_OPTIONS = ['Manga', 'Manhwa', 'Manhua', 'Other'];
// const DEMOGRAPHIC_OPTIONS = ['Josei', 'Seinen', 'Shoujo', 'Shounen'];
// const STATUS_OPTIONS = ['Releasing', 'Finished', 'On hiatus', 'Discontinued'];

// const ALL_GENRES = [
//   'Action', 'Adult', 'Adventure', 'Boys Love', 'Comedy', 'Crime', 'Drama', 'Ecchi', 
//   'Fantasy', 'Girls Love', 'Harem', 'Hentai', 'Historical', 'Horror', 'Isekai', 
//   'Magical Girls', 'Mature', 'Mecha', 'Medical', 'Mystery', 'Philosophical', 
//   'Psychological', 'Romance', 'Sci-Fi', 'Slice of Life', 'Smut', 'Sports', 
//   'Superhero', 'Thriller', 'Tragedy', 'Wuxia'
// ];

// const ALL_FORMATS = [
//   '4-Koma', 'Adaptation', 'Anthology', 'Award Winning', 'Doujinshi', 
//   'Full Color', 'Long Strip', 'Oneshot', 'Web Comic'
// ];

// // Helper xử lý đường dẫn ảnh bìa
// const getImageUrl = (coverUrl?: string) => {
//   if (!coverUrl) return 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?q=80&w=200';
//   if (coverUrl.startsWith('http://') || coverUrl.startsWith('https://')) {
//     return coverUrl;
//   }
//   return `${API_UPLOADS}${coverUrl}`;
// };

// // Helper tạo badge hiển thị trạng thái duyệt đóng góp
// const getStatusBadge = (status: 'pending' | 'accept' | 'reject') => {
//   const styles: React.CSSProperties = {
//     padding: '3px 8px',
//     borderRadius: '4px',
//     fontSize: '11px',
//     fontWeight: 'bold',
//     color: '#fff',
//     display: 'inline-block'
//   };

//   switch (status) {
//     case 'pending':
//       return <span style={{ ...styles, backgroundColor: '#d97706' }}>Pending</span>;
//     case 'accept':
//       return <span style={{ ...styles, backgroundColor: '#16a34a' }}>Accepted</span>;
//     case 'reject':
//       return <span style={{ ...styles, backgroundColor: '#dc2626' }}>Rejected</span>;
//     default:
//       return null;
//   }
// };

// const isUnread = (contrib: ComicContributor): boolean => contrib.unread > 0;

// interface ComicCardProps {
//   contributor: ComicContributor;
//   onClick?: () => void;
// }

// export function ComicCard({ contributor, onClick }: ComicCardProps) {
//   const comicData = contributor.comic;
//   const title = comicData?.name || 'Unknown Comic';
//   const image = getImageUrl(comicData?.coverUrl);
//   const url = comicData?.url || contributor.comicId;

//   return (
//     <Link to={`/comics/${url}`} className="card card--compact" onClick={onClick}>
//       <div className="card__poster-wrap" style={{ position: 'relative' }}>
//         <div className="poster poster--md">
//           <img alt={title} loading="lazy" src={image} />
//         </div>
        
//         {/* Nhãn trạng thái duyệt đóng góp ở góc ảnh */}
//         <div style={{ position: 'absolute', top: '6px', left: '6px', zIndex: 5 }}>
//           {getStatusBadge(contributor.status)}
//         </div>

//         {/* Thông báo tin chưa đọc (nếu có) */}
//         {contributor.unread > 0 && (
//           <span style={{
//             position: 'absolute',
//             top: '6px',
//             right: '6px',
//             background: '#ef4444',
//             color: '#fff',
//             borderRadius: '10px',
//             padding: '2px 6px',
//             fontSize: '10px',
//             fontWeight: 'bold',
//             zIndex: 5
//           }}>
//             {contributor.unread} unread
//           </span>
//         )}
//       </div>
//       <div className="card__body">
//         <div className="card__meta">
//           {comicData?.demographic && (
//             <span style={{ opacity: 0.8, fontSize: '11px', textTransform: 'capitalize' }}>
//               {comicData.demographic}
//             </span>
//           )}
//           <span className="card__time">
//             {formatTimeAgo(contributor.createdAt)}
//           </span>
//         </div>
//         <div className="card__title" title={title}>
//           {title}
//         </div>
//         {comicData?.types && (
//           <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>
//             Types: {comicData.types}
//           </div>
//         )}
//       </div>
//     </Link>
//   );
// }

// interface ComicRowProps {
//   contributor: ComicContributor;
//   onClick?: () => void;
// }

// export function ComicRow({ contributor, onClick }: ComicRowProps) {
//   const comicData = contributor.comic;
//   const title = comicData?.name || 'Unknown Comic';
//   const image = getImageUrl(comicData?.coverUrl);
//   const url = comicData?.url || contributor.comicId;

//   return (
//     <li className="ulrow" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0' }} onClick={onClick}>
//       <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
//         <Link className="ulrow__poster" to={`/comics/${url}`} aria-label={title}>
//           <div className="poster poster--sm">
//             <img alt={title} loading="lazy" src={image} />
//           </div>
//         </Link>
//         <div className="ulrow__body">
//           <Link className="ulrow__title" to={`/comics/${url}`} style={{ fontWeight: '600' }}>
//             {title}
//           </Link>
//           <div className="ulrow__meta" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
//             {/* Trạng thái duyệt đóng góp */}
//             {getStatusBadge(contributor.status)}
            
//             <span className="ulrow__dot"></span>
            
//             {comicData?.demographic && (
//               <>
//                 <span style={{ fontSize: '11px', color: '#9ca3af', textTransform: 'capitalize' }}>
//                   {comicData.demographic}
//                 </span>
//                 <span className="ulrow__dot"></span>
//               </>
//             )}
            
//             <span className="card__time" style={{ fontSize: '11px', color: '#9ca3af' }}>
//               Submitted {formatTimeAgo(contributor.createdAt)}
//             </span>
//           </div>
//         </div>
//       </div>
      
//       <div className="ulrow__actions" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
//         {/* Thể loại truyện */}
//         {comicData?.types && (
//           <span style={{ fontSize: '11px', color: '#9ca3af', background: 'rgba(255,255,255,0.08)', padding: '2px 8px', borderRadius: '4px' }}>
//             {comicData.types}
//           </span>
//         )}

//         {/* Thông báo tin chưa đọc */}
//         {contributor.unread > 0 && (
//           <span style={{
//             background: '#ef4444',
//             color: '#fff',
//             borderRadius: '10px',
//             padding: '2px 8px',
//             fontSize: '11px',
//             fontWeight: 'bold'
//           }}>
//             {contributor.unread} unread
//           </span>
//         )}
//       </div>
//     </li>
//   );
// }

// export default function ComicSuggestionPanel() {
//   // Tab lọc trạng thái (status) & Lọc All/Unread
//   const [activeTab, setActiveTab] = useState<'all' | 'accept' | 'pending' | 'reject'>('all');
//   const [activeFilter, setActiveFilter] = useState<'all' | 'unread'>('all');

//   // Danh sách dữ liệu gợi ý từ contributor
//   const [contributions, setContributions] = useState<ComicContributor[]>([]);
//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState<string | null>(null);

//   // Form State
//   const [showForm, setShowForm] = useState(false);
//   const [formData, setFormData] = useState({
//     name: '',
//     source: '',
//     url: '',
//     description: '',
//     image: null as File | null,
//     type: '',
//     releasingYear: new Date().getFullYear(),
//     author: '',
//     artist: '',
//     otherNames: '',
//     correspondingCountries: '',
//   });
//   const [statusMessage, setStatusMessage] = useState<string | null>(null);
//   const [isSaving, setIsSaving] = useState(false);

//   const [selectedGenres, setSelectedGenres] = useState<Record<string, boolean>>({});
//   const [selectedFormats, setSelectedFormats] = useState<Record<string, boolean>>({});
//   const [selectedDemographic, setSelectedDemographic] = useState('');
//   const [selectedStatus, setSelectedStatus] = useState('');

//   const imageInputRef = useRef<HTMLInputElement>(null);
//   const [previewImage, setPreviewImage] = useState<string | null>(null);

//   // Đếm số thông báo chưa đọc theo từng Tab
//   const acceptUnreadCount = contributions.filter(c => isUnread(c) && c.status === 'accept').length;
//   const pendingUnreadCount = contributions.filter(c => isUnread(c) && c.status === 'pending').length;
//   const rejectUnreadCount = contributions.filter(c => isUnread(c) && c.status === 'reject').length;
//   const totalUnreadCount = acceptUnreadCount + pendingUnreadCount + rejectUnreadCount;

//   // Slug generator helper
//   const slugify = (text: string) => text
//     .toString()
//     .normalize('NFD')
//     .replace(/\p{Diacritic}/gu, '')
//     .toLowerCase()
//     .trim()
//     .replace(/\s+/g, '-')
//     .replace(/[^\w-]/g, '')
//     .replace(/-+/g, '-');

//   // Lọc danh sách hiển thị kết hợp cả Tab lẫn Bộ lọc Chưa đọc (Unread)
//   const filteredContributions = contributions.filter(contrib => {
//     const matchesTab = activeTab === 'all' || contrib.status === activeTab;
//     const matchesFilter = activeFilter === 'all' || (activeFilter === 'unread' && isUnread(contrib));
//     return matchesTab && matchesFilter;
//   });

//   // Tải danh sách đóng góp từ API
//   const loadContributions = useCallback(async () => {
//     setLoading(true);
//     setError(null);
//     try {
//       const items = await comicContributorApi.listMyContributions();
//       setContributions(items || []);
//     } catch (err: any) {
//       setError(err?.message || 'Failed to load contributions');
//     } finally {
//       setLoading(false);
//     }
//   }, []);

//   // Đánh dấu đã đọc toàn bộ của tab hiện tại
//   const handleMarkAllRead = async () => {
//     const unreadInCurrentTab = contributions.filter(
//       c => isUnread(c) && (activeTab === 'all' || c.status === activeTab)
//     );
//     if (unreadInCurrentTab.length === 0) return;

//     // Cập nhật cục bộ trước (Optimistic UI)
//     setContributions(prev =>
//       prev.map(c => {
//         if (isUnread(c) && (activeTab === 'all' || c.status === activeTab)) {
//           return { ...c, unread: 0 };
//         }
//         return c;
//       })
//     );

//     try {
//       await Promise.all(unreadInCurrentTab.map(c => comicContributorApi.markRead(c.comicId, c.userId)));
//     } catch (err) {
//       console.error('Error marking as read:', err);
//     } finally {
//       await loadContributions();
//     }
//   };

//   const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
//     const file = e.target.files?.[0];
//     if (file) {
//       setFormData((prev) => ({ ...prev, image: file }));
//       const reader = new FileReader();
//       reader.onload = (event) => {
//         setPreviewImage(event.target?.result as string);
//       };
//       reader.readAsDataURL(file);
//     }
//   };

//   const handleInputChange = (field: string, value: any) => {
//     setFormData((prev) => {
//       const updated = { ...prev, [field]: value };
//       if (field === 'name') {
//         updated.url = slugify(value);
//       }
//       return updated;
//     });
//   };

//   const toggleTag = (tag: string, isGenre: boolean) => {
//     const setState = isGenre ? setSelectedGenres : setSelectedFormats;
//     setState((prev) => {
//       const updated = { ...prev };
//       if (updated[tag]) {
//         delete updated[tag];
//       } else {
//         updated[tag] = true;
//       }
//       return updated;
//     });
//   };

//   const handleSubmit = async (e: React.FormEvent) => {
//     e.preventDefault();
//     setStatusMessage(null);

//     if (!formData.name.trim()) {
//       setStatusMessage('Comic name is required.');
//       return;
//     }
//     if (!formData.type) {
//       setStatusMessage('Comic type is required.');
//       return;
//     }
//     if (!selectedDemographic) {
//       setStatusMessage('Demographic is required.');
//       return;
//     }
//     if (!formData.image) {
//       setStatusMessage('Cover image is required.');
//       return;
//     }
//     if (!formData.url.trim()) {
//       setStatusMessage('Comic URL/Slug is required.');
//       return;
//     }

//     const form = new FormData();
//     form.append('name', formData.name.trim());
//     form.append('source', formData.source.trim());
//     form.append('url', slugify(formData.url.trim()));
//     form.append('description', formData.description.trim());
//     form.append('types', formData.type);
//     form.append('contentRating', 'safe');
//     form.append('demographic', selectedDemographic);
//     form.append('releaseStatus', selectedStatus || 'releasing');
//     form.append('releasingYear', String(formData.releasingYear));
    
//     if (formData.author.trim()) form.append('author', formData.author.trim());
//     if (formData.artist.trim()) form.append('artist', formData.artist.trim());
//     if (formData.image) form.append('coverImage', formData.image);

//     Object.keys(selectedGenres).forEach((genre) => form.append('genres', genre));
//     Object.keys(selectedFormats).forEach((format) => form.append('formats', format));

//     try {
//       setIsSaving(true);
//       await comicApi.create(form);
//       setStatusMessage('Comic created successfully.');
//       setShowForm(false);
//       setFormData({
//         name: '',
//         source: '',
//         url: '',
//         description: '',
//         image: null,
//         type: '',
//         releasingYear: new Date().getFullYear(),
//         author: '',
//         artist: '',
//         otherNames: '',
//         correspondingCountries: '',
//       });
//       setSelectedGenres({});
//       setSelectedFormats({});
//       setSelectedDemographic('');
//       setSelectedStatus('');
//       setPreviewImage(null);
//       await loadContributions();
//     } catch (error: any) {
//       setStatusMessage(error?.message || 'Failed to save comic.');
//     } finally {
//       setIsSaving(false);
//     }
//   };

//   useEffect(() => {
//     loadContributions();
//   }, [loadContributions]);

//   return (
//     <div className="suggestions-container">
//       {/* Header */}
//       <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
//         <div>
//           <h2 style={{ fontSize: '20px', fontWeight: 'bold' }}>Suggested Comics</h2>
//           <span style={{ fontSize: '13px', color: '#8a8b92' }}>
//             {totalUnreadCount} unread total.
//           </span>
//         </div>

//         <div style={{ display: 'flex', gap: '8px' }}>
//           {totalUnreadCount > 0 && (
//             <button
//               type="button"
//               className="ubtn ubtn--ghost ubtn--sm"
//               onClick={handleMarkAllRead}
//             >
//               Mark all as read
//             </button>
//           )}
//           <button
//             type="button"
//             className="ubtn ubtn--primary ubtn--sm"
//             onClick={() => setShowForm(true)}
//           >
//             + Suggest Comic
//           </button>
//         </div>
//       </div>

//       {/* Tabs & Filters */}
//       {!showForm && (
//         <div className="nfilters" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
//           <div className="useg">
//             <button
//               type="button"
//               className={`useg__btn ${activeTab === 'all' ? 'is-on' : ''}`}
//               onClick={() => setActiveTab('all')}
//             >
//               <span>All</span>
//               {totalUnreadCount > 0 && <span className="useg__count mono">{totalUnreadCount}</span>}
//             </button>
//             <button
//               type="button"
//               className={`useg__btn ${activeTab === 'accept' ? 'is-on' : ''}`}
//               onClick={() => setActiveTab('accept')}
//             >
//               <span>Accepted</span>
//               {acceptUnreadCount > 0 && <span className="useg__count mono">{acceptUnreadCount}</span>}
//             </button>
//             <button
//               type="button"
//               className={`useg__btn ${activeTab === 'pending' ? 'is-on' : ''}`}
//               onClick={() => setActiveTab('pending')}
//             >
//               <span>Pending</span>
//               {pendingUnreadCount > 0 && <span className="useg__count mono">{pendingUnreadCount}</span>}
//             </button>
//             <button
//               type="button"
//               className={`useg__btn ${activeTab === 'reject' ? 'is-on' : ''}`}
//               onClick={() => setActiveTab('reject')}
//             >
//               <span>Rejected</span>
//               {rejectUnreadCount > 0 && <span className="useg__count mono">{rejectUnreadCount}</span>}
//             </button>
//           </div>

//           <div className="useg">
//             <button
//               type="button"
//               className={`useg__btn ${activeFilter === 'all' ? 'is-on' : ''}`}
//               onClick={() => setActiveFilter('all')}
//             >
//               All
//             </button>
//             <button
//               type="button"
//               className={`useg__btn ${activeFilter === 'unread' ? 'is-on' : ''}`}
//               onClick={() => setActiveFilter('unread')}
//             >
//               Unread
//             </button>
//           </div>
//         </div>
//       )}

//       {/* Thông báo lỗi hoặc Trạng thái tải */}
//       {statusMessage && (
//         <div className="status-message" style={{ padding: '12px', marginBottom: '16px', borderRadius: '4px', background: '#25262c', color: '#fff' }}>
//           {statusMessage}
//         </div>
//       )}

//       {loading ? (
//         <div className="uempty">Loading...</div>
//       ) : error ? (
//         <div className="uempty">{error}</div>
//       ) : showForm ? (
//         /* Giao diện Form Gợi ý Comic mới */
//         <div className="comic-form-container">
//           <div className="comic-form-header">
//             <h3 className="comic-form-title">Add New Comic</h3>
//             <button
//               type="button"
//               className="comic-form-close-btn"
//               onClick={() => setShowForm(false)}
//               aria-label="Close form"
//             >
//               <X size={20} />
//             </button>
//           </div>

//           <form onSubmit={handleSubmit} className="comic-form">
//             {/* LEFT COLUMN */}
//             <div className="comic-form-left">
//               <div className="form-group">
//                 <label className="form-label">Image *</label>
//                 <div className="image-upload-box">
//                   {previewImage ? (
//                     <div className="image-preview">
//                       <img src={previewImage} alt="Comic preview" className="preview-img" />
//                       <button
//                         type="button"
//                         className="remove-image-btn"
//                         onClick={() => {
//                           setPreviewImage(null);
//                           setFormData((prev) => ({ ...prev, image: null }));
//                           if (imageInputRef.current) imageInputRef.current.value = '';
//                         }}
//                       >
//                         <X size={16} />
//                       </button>
//                     </div>
//                   ) : (
//                     <button
//                       type="button"
//                       className="image-upload-btn"
//                       onClick={() => imageInputRef.current?.click()}
//                     >
//                       <Upload size={24} strokeWidth={1.5} />
//                       <span>Click to upload image</span>
//                     </button>
//                   )}
//                   <input
//                     ref={imageInputRef}
//                     type="file"
//                     accept="image/*"
//                     onChange={handleImageUpload}
//                     style={{ display: 'none' }}
//                   />
//                 </div>
//               </div>

//               <div className="form-row-2col">
//                 <div className="form-group">
//                   <label className="form-label">Releasing Year</label>
//                   <input
//                     type="number"
//                     className="form-input"
//                     value={formData.releasingYear}
//                     onChange={(e) => handleInputChange('releasingYear', parseInt(e.target.value) || new Date().getFullYear())}
//                     min="1990"
//                     max={new Date().getFullYear() + 1}
//                   />
//                 </div>

//                 <div className="form-group">
//                   <label className="form-label">Releasing Status</label>
//                   <select
//                     className="form-select"
//                     value={selectedStatus}
//                     onChange={(e) => setSelectedStatus(e.target.value)}
//                   >
//                     <option value="">Choose status</option>
//                     {STATUS_OPTIONS.map((status) => (
//                       <option key={status} value={status}>{status}</option>
//                     ))}
//                   </select>
//                 </div>
//               </div>

//               <div className="form-row-2col">
//                 <div className="form-group">
//                   <label className="form-label">Author</label>
//                   <input
//                     type="text"
//                     className="form-input"
//                     value={formData.author}
//                     onChange={(e) => handleInputChange('author', e.target.value)}
//                     placeholder="Enter author name"
//                   />
//                 </div>

//                 <div className="form-group">
//                   <label className="form-label">Artist</label>
//                   <input
//                     type="text"
//                     className="form-input"
//                     value={formData.artist}
//                     onChange={(e) => handleInputChange('artist', e.target.value)}
//                     placeholder="Enter artist name"
//                   />
//                 </div>
//               </div>

//               <div className="form-row-2col">
//                 <div className="form-group">
//                   <label className="form-label">Type *</label>
//                   <select
//                     className="form-select"
//                     value={formData.type}
//                     onChange={(e) => handleInputChange('type', e.target.value)}
//                     required
//                   >
//                     <option value="">Choose type</option>
//                     {TYPE_OPTIONS.map((type) => (
//                       <option key={type} value={type}>{type}</option>
//                     ))}
//                   </select>
//                 </div>

//                 <div className="form-group">
//                   <label className="form-label">Demographic *</label>
//                   <select
//                     className="form-select"
//                     value={selectedDemographic}
//                     onChange={(e) => setSelectedDemographic(e.target.value)}
//                     required
//                   >
//                     <option value="">Choose Demographic</option>
//                     {DEMOGRAPHIC_OPTIONS.map((demo) => (
//                       <option key={demo} value={demo}>{demo}</option>
//                     ))}
//                   </select>
//                 </div>
//               </div>
//             </div>

//             {/* RIGHT COLUMN */}
//             <div className="comic-form-right">
//               <div className="form-group">
//                 <label className="form-label">Name *</label>
//                 <input
//                   type="text"
//                   className="form-input"
//                   value={formData.name}
//                   onChange={(e) => handleInputChange('name', e.target.value)}
//                   placeholder="Enter comic name"
//                   required
//                 />
//               </div>

//               <div className="form-group">
//                 <label className="form-label">Slug (Auto-generated)</label>
//                 <input
//                   type="text"
//                   className="form-input"
//                   value={formData.url}
//                   onChange={(e) => handleInputChange('url', slugify(e.target.value))}
//                   placeholder="comic-url-slug"
//                   required
//                 />
//               </div>

//               <div className="form-group">
//                 <label className="form-label">Other Names & Countries (per line)</label>
//                 <textarea
//                   className="form-textarea"
//                   value={formData.otherNames}
//                   onChange={(e) => handleInputChange('otherNames', e.target.value)}
//                   placeholder={`Name1,Country1\nName2,Country2`}
//                   rows={3}
//                 />
//               </div>

//               <div className="form-group">
//                 <label className="form-label">Description</label>
//                 <textarea
//                   style={{ minHeight: '140px' }}
//                   className="form-textarea"
//                   value={formData.description}
//                   onChange={(e) => handleInputChange('description', e.target.value)}
//                   placeholder="Enter comic description"
//                   rows={4}
//                 />
//               </div>
//             </div>

//             {/* Formats - FULL WIDTH */}
//             <div className="form-full">
//               <div className="form-group">
//                 <label className="form-label">Formats</label>
//                 <div className="direct-tags-box">
//                   <ul className="direct-tags-grid">
//                     {ALL_FORMATS.map((format) => {
//                       const isSelected = !!selectedFormats[format];
//                       return (
//                         <li key={format}>
//                           <button
//                             type="button"
//                             className={`tagpop__item ${isSelected ? 'tag-on' : 'tag-off'}`}
//                             onClick={() => toggleTag(format, false)}
//                           >
//                             <span className="tagpop__check" aria-hidden="true"></span>
//                             <span className="tagpop__name">{format}</span>
//                           </button>
//                         </li>
//                       );
//                     })}
//                   </ul>
//                 </div>
//               </div>
//             </div>

//             {/* Genres - FULL WIDTH */}
//             <div className="form-full">
//               <div className="form-group">
//                 <label className="form-label">Genres</label>
//                 <div className="direct-tags-box">
//                   <ul className="direct-tags-grid">
//                     {ALL_GENRES.map((genre) => {
//                       const isSelected = !!selectedGenres[genre];
//                       return (
//                         <li key={genre}>
//                           <button
//                             type="button"
//                             className={`tagpop__item ${isSelected ? 'tag-on' : 'tag-off'}`}
//                             onClick={() => toggleTag(genre, true)}
//                           >
//                             <span className="tagpop__check" aria-hidden="true"></span>
//                             <span className="tagpop__name">{genre}</span>
//                           </button>
//                         </li>
//                       );
//                     })}
//                   </ul>
//                 </div>
//               </div>
//             </div>

//             {/* Actions */}
//             <div className="form-actions-full" style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
//               <button type="submit" className="ubtn ubtn--primary" disabled={isSaving}>
//                 {isSaving ? 'Saving...' : 'Save Comic'}
//               </button>
//               <button
//                 type="button"
//                 className="ubtn ubtn--ghost"
//                 onClick={() => setShowForm(false)}
//               >
//                 Cancel
//               </button>
//             </div>
//           </form>
//         </div>
//       ) : filteredContributions.length > 0 ? (
//         /* Giao diện danh sách gợi ý sử dụng ComicRow mới tích hợp */
//         <ul className="nlist">
//           {filteredContributions.map((contrib) => {
//             const isUnreadItem = isUnread(contrib);

//             return (
//               <ComicRow
//                 key={`${contrib.comicId}-${contrib.userId}`}
//                 contributor={contrib}
//                 onClick={async () => {
//                   if (isUnreadItem) {
//                     try {
//                       // Đánh dấu đã đọc cục bộ (Optimistic UI)
//                       setContributions((prev) =>
//                         prev.map((c) =>
//                           c.comicId === contrib.comicId && c.userId === contrib.userId
//                             ? { ...c, unread: 0 }
//                             : c
//                         )
//                       );
//                       await comicContributorApi.markRead(contrib.comicId, contrib.userId);
//                     } catch (error) {
//                       console.error('Failed to mark read:', error);
//                     }
//                   }
//                 }}
//               />
//             );
//           })}
//         </ul>
//       ) : (
//         /* Trạng thái danh sách rỗng */
//         <div className="uempty">
//           <div className="uempty__icon">
//             <svg
//               width="24"
//               height="24"
//               viewBox="0 0 24 24"
//               fill="none"
//               stroke="currentColor"
//               strokeWidth="1.8"
//               strokeLinecap="round"
//               strokeLinejoin="round"
//               aria-hidden="true"
//             >
//               <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
//               <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
//             </svg>
//           </div>
//           <div className="uempty__title">No suggestions found.</div>
//           <div className="uempty__sub">
//             {activeTab === 'accept'
//               ? 'No accepted suggestions.'
//               : activeTab === 'pending'
//                 ? 'No pending suggestions.'
//                 : activeTab === 'reject'
//                   ? 'No rejected suggestions.'
//                   : 'Start suggesting comics to expand the library.'}
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }


import { useEffect, useState, useCallback, useRef } from 'react';
import React from 'react';
import { Link } from 'react-router-dom';
import { Upload, X } from 'lucide-react';
import type { ComicContributor } from '../../../types/data';
import { comicApi, comicContributorApi, API_UPLOADS } from '../../../services/api';
import { formatTimeAgo } from '../../../helpers/formatDate';
import '../../../assets/styles/ComicForm.css';

const TYPE_OPTIONS = ['Manga', 'Manhwa', 'Manhua', 'Other'];
const DEMOGRAPHIC_OPTIONS = ['Josei', 'Seinen', 'Shoujo', 'Shounen'];
const STATUS_OPTIONS = ['Releasing', 'Finished', 'On hiatus', 'Discontinued'];

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

// Helper xử lý đường dẫn ảnh bìa
const getImageUrl = (coverUrl?: string) => {
  if (!coverUrl) return 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?q=80&w=200';
  if (coverUrl.startsWith('http://') || coverUrl.startsWith('https://')) {
    return coverUrl;
  }
  return `${API_UPLOADS}${coverUrl}`;
};

// Helper tạo badge hiển thị trạng thái duyệt đóng góp (dùng cho ComicCard overlay)
const getStatusBadge = (status: 'pending' | 'accept' | 'reject') => {
  if (!status) return null;
  const map = {
    pending: 'status-badge status-pending',
    accept: 'status-badge status-accept',
    reject: 'status-badge status-reject',
  } as Record<string, string>;
  const cls = map[status] || 'status-badge';
  const label = status === 'pending' ? 'Pending' : status === 'accept' ? 'Accepted' : 'Rejected';
  return <span className={cls}>{label}</span>;
};

const isUnread = (contrib: ComicContributor): boolean => contrib.unread > 0;

interface ComicCardProps {
  contributor: ComicContributor;
  onClick?: () => void;
}

export function ComicCard({ contributor, onClick }: ComicCardProps) {
  const comicData = contributor.comic;
  const title = comicData?.name || 'Unknown Comic';
  const image = getImageUrl(comicData?.coverUrl);
  const url = comicData?.url || contributor.comicId;

  return (
    <Link to={`/comics/${url}`} className="card card--compact" onClick={onClick}>
      <div className="card__poster-wrap" style={{ position: 'relative' }}>
        <div className="poster poster--md">
          <img alt={title} loading="lazy" src={image} />
        </div>
        <div className="card__poster-overlay">
          {getStatusBadge(contributor.status)}
          {contributor.unread > 0 && <span className="unread-pill">{contributor.unread} unread</span>}
        </div>
      </div>
      <div className="card__body">
        <div className="card__meta">
          {comicData?.demographic && (
            <span className="card__demographic">
              {comicData.demographic}
            </span>
          )}
          <span className="card__time">
            {formatTimeAgo(contributor.updatedAt)}
          </span>
        </div>
        <div className="card__title" title={title}>
          {title}
        </div>
        {comicData?.types && (
          <div className="card__types">
            Types: {comicData.types}
          </div>
        )}
      </div>
    </Link>
  );
}

interface ComicRowProps {
  contributor: ComicContributor;
  onClick?: () => void;
}

export function ComicRow({ contributor, onClick }: ComicRowProps) {
  const comicData = contributor.comic;
  const title = comicData?.name || 'Unknown Comic';
  const image = getImageUrl(comicData?.coverUrl);
  const url = comicData?.url || contributor.comicId;

  // Lọc và chuẩn bị danh sách meta hiển thị kèm dấu chấm tròn xen kẽ
  const metaItems: React.ReactNode[] = [];
  
  if (comicData?.releasingStatus) {
    metaItems.push(
      <span key="status" className="ulrow__status ulrow__status--releasing">
        {comicData.releasingStatus}
      </span>
    );
  }
  
  if (comicData?.types) {
    metaItems.push(
      <span key="types" className="ulrow__text-meta">
        {comicData.types}
      </span>
    );
  }
  
  if (comicData?.demographic) {
    metaItems.push(
      <span key="demographic" className="ulrow__text-meta text-capitalize">
        {comicData.demographic}
      </span>
    );
  }
  
  metaItems.push(
    <span key="time" className="card__time">
      {formatTimeAgo(contributor.updatedAt)}
    </span>
  );

  // Tạo class động theo thể loại giới hạn độ tuổi
  const contentRatingClass = comicData?.contentRating 
    ? `rating-${comicData.contentRating.toLowerCase()}` 
    : '';

  return (
    <li className="ulrow" onClick={onClick}>
      <Link className="ulrow__poster" to={`/comics/${url}`} aria-label={title}>
        <div className="poster poster--sm">
          <img alt={title} loading="lazy" src={image} />
        </div>
      </Link>
      
      <div className="ulrow__body">
        <Link className="ulrow__title" to={`/comics/${url}`} style={{ fontWeight: '600' }}>
          {title}
        </Link>
        <div className="ulrow__meta">
          {metaItems.map((item, index) => (
            <React.Fragment key={index}>
              {index > 0 && <span className="ulrow__dot"></span>}
              {item}
            </React.Fragment>
          ))}
        </div>
      </div>
      
      <div className="ulrow__actions">
        {/* 1. Trạng thái duyệt đóng góp đặt tại vị trí ulrow__folder */}
        <span className={`ulrow__folder status-${contributor.status}`}>
          {contributor.status === 'pending' ? 'Pending' : contributor.status === 'accept' ? 'Accepted' : 'Rejected'}
        </span>

        {/* 3. Phân loại độ tuổi (contentRating) thay thế cho Rating */}
        {comicData?.contentRating && (
          <div className="ulrow__rating">
            <span className={`ulrow__rating-btn is-rated ${contentRatingClass}`}>
              {comicData.contentRating}
            </span>
          </div>
        )}

        {/* Thông báo tin chưa đọc */}
        {contributor.unread > 0 && (
          <span className="unread-pill">{contributor.unread} unread</span>
        )}
      </div>
    </li>
  );
}

export default function ComicSuggestionPanel() {
  // Tab lọc trạng thái (status) & Lọc All/Unread
  const [activeTab, setActiveTab] = useState<'all' | 'accept' | 'pending' | 'reject'>('all');
  const [activeFilter, setActiveFilter] = useState<'all' | 'unread'>('all');

  // Danh sách dữ liệu gợi ý từ contributor
  const [contributions, setContributions] = useState<ComicContributor[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
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
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [selectedGenres, setSelectedGenres] = useState<Record<string, boolean>>({});
  const [selectedFormats, setSelectedFormats] = useState<Record<string, boolean>>({});
  const [selectedDemographic, setSelectedDemographic] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');

  const imageInputRef = useRef<HTMLInputElement>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Đếm số thông báo chưa đọc theo từng Tab
  const acceptUnreadCount = contributions.filter(c => isUnread(c) && c.status === 'accept').length;
  const pendingUnreadCount = contributions.filter(c => isUnread(c) && c.status === 'pending').length;
  const rejectUnreadCount = contributions.filter(c => isUnread(c) && c.status === 'reject').length;
  const totalUnreadCount = acceptUnreadCount + pendingUnreadCount + rejectUnreadCount;

  // Slug generator helper
  const slugify = (text: string) => text
    .toString()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]/g, '')
    .replace(/-+/g, '-');

  // Lọc danh sách hiển thị kết hợp cả Tab lẫn Bộ lọc Chưa đọc (Unread)
  const filteredContributions = contributions.filter(contrib => {
    const matchesTab = activeTab === 'all' || contrib.status === activeTab;
    const matchesFilter = activeFilter === 'all' || (activeFilter === 'unread' && isUnread(contrib));
    return matchesTab && matchesFilter;
  });

  // Tải danh sách đóng góp từ API
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

  // Đánh dấu đã đọc toàn bộ của tab hiện tại
  const handleMarkAllRead = async () => {
    const unreadInCurrentTab = contributions.filter(
      c => isUnread(c) && (activeTab === 'all' || c.status === activeTab)
    );
    if (unreadInCurrentTab.length === 0) return;

    // Cập nhật cục bộ trước (Optimistic UI)
    setContributions(prev =>
      prev.map(c => {
        if (isUnread(c) && (activeTab === 'all' || c.status === activeTab)) {
          return { ...c, unread: 0 };
        }
        return c;
      })
    );

    try {
      await Promise.all(unreadInCurrentTab.map(c => comicContributorApi.markRead(c.comicId, c.userId)));
    } catch (err) {
      console.error('Error marking as read:', err);
    } finally {
      await loadContributions();
    }
  };

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
    if (!formData.image) {
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
    form.append('contentRating', 'safe');
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
      await comicApi.create(form);
      setStatusMessage('Comic created successfully.');
      setShowForm(false);
      setFormData({
        name: '',
        source: '',
        url: '',
        description: '',
        image: null,
        type: '',
        releasingYear: new Date().getFullYear(),
        author: '',
        artist: '',
        otherNames: '',
        correspondingCountries: '',
      });
      setSelectedGenres({});
      setSelectedFormats({});
      setSelectedDemographic('');
      setSelectedStatus('');
      setPreviewImage(null);
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
          <h2 style={{ fontSize: '20px', fontWeight: 'bold' }}>Suggested Comics</h2>
          <span style={{ fontSize: '13px', color: '#8a8b92' }}>
            {totalUnreadCount} unread total.
          </span>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          {totalUnreadCount > 0 && (
            <button
              type="button"
              className="ubtn ubtn--ghost ubtn--sm"
              onClick={handleMarkAllRead}
            >
              Mark all as read
            </button>
          )}
          <button
            type="button"
            className="ubtn ubtn--primary ubtn--sm"
            onClick={() => setShowForm(true)}
          >
            + Suggest Comic
          </button>
        </div>
      </div>

      {/* Tabs & Filters */}
      {!showForm && (
        <div className="nfilters" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div className="useg">
            <button
              type="button"
              className={`useg__btn ${activeTab === 'all' ? 'is-on' : ''}`}
              onClick={() => setActiveTab('all')}
            >
              <span>All</span>
              {totalUnreadCount > 0 && <span className="useg__count mono">{totalUnreadCount}</span>}
            </button>
            <button
              type="button"
              className={`useg__btn ${activeTab === 'accept' ? 'is-on' : ''}`}
              onClick={() => setActiveTab('accept')}
            >
              <span>Accepted</span>
              {acceptUnreadCount > 0 && <span className="useg__count mono">{acceptUnreadCount}</span>}
            </button>
            <button
              type="button"
              className={`useg__btn ${activeTab === 'pending' ? 'is-on' : ''}`}
              onClick={() => setActiveTab('pending')}
            >
              <span>Pending</span>
              {pendingUnreadCount > 0 && <span className="useg__count mono">{pendingUnreadCount}</span>}
            </button>
            <button
              type="button"
              className={`useg__btn ${activeTab === 'reject' ? 'is-on' : ''}`}
              onClick={() => setActiveTab('reject')}
            >
              <span>Rejected</span>
              {rejectUnreadCount > 0 && <span className="useg__count mono">{rejectUnreadCount}</span>}
            </button>
          </div>

          <div className="useg">
            <button
              type="button"
              className={`useg__btn ${activeFilter === 'all' ? 'is-on' : ''}`}
              onClick={() => setActiveFilter('all')}
            >
              All
            </button>
            <button
              type="button"
              className={`useg__btn ${activeFilter === 'unread' ? 'is-on' : ''}`}
              onClick={() => setActiveFilter('unread')}
            >
              Unread
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
        /* Giao diện Form Gợi ý Comic mới */
        <div className="comic-form-container">
          <div className="comic-form-header">
            <h3 className="comic-form-title">Add New Comic</h3>
            <button
              type="button"
              className="comic-form-close-btn"
              onClick={() => setShowForm(false)}
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

                <div className="form-group">
                  <label className="form-label">Releasing Status</label>
                  <select
                    className="form-select"
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                  >
                    <option value="">Choose status</option>
                    {STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-row-2col">
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

              <div className="form-row-2col">
                <div className="form-group">
                  <label className="form-label">Type *</label>
                  <select
                    className="form-select"
                    value={formData.type}
                    onChange={(e) => handleInputChange('type', e.target.value)}
                    required
                  >
                    <option value="">Choose type</option>
                    {TYPE_OPTIONS.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Demographic *</label>
                  <select
                    className="form-select"
                    value={selectedDemographic}
                    onChange={(e) => setSelectedDemographic(e.target.value)}
                    required
                  >
                    <option value="">Choose Demographic</option>
                    {DEMOGRAPHIC_OPTIONS.map((demo) => (
                      <option key={demo} value={demo}>{demo}</option>
                    ))}
                  </select>
                </div>
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
                  style={{ minHeight: '140px' }}
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
                onClick={() => setShowForm(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : filteredContributions.length > 0 ? (
        /* Giao diện danh sách gợi ý sử dụng ComicRow mới tích hợp */
        <ul className="nlist">
          {filteredContributions.map((contrib) => {
            const isUnreadItem = isUnread(contrib);

            return (
              <ComicRow
                key={`${contrib.comicId}-${contrib.userId}`}
                contributor={contrib}
                onClick={async () => {
                  if (isUnreadItem) {
                    try {
                      // Đánh dấu đã đọc cục bộ (Optimistic UI)
                      setContributions((prev) =>
                        prev.map((c) =>
                          c.comicId === contrib.comicId && c.userId === contrib.userId
                            ? { ...c, unread: 0 }
                            : c
                        )
                      );
                      await comicContributorApi.markRead(contrib.comicId, contrib.userId);
                    } catch (error) {
                      console.error('Failed to mark read:', error);
                    }
                  }
                }}
              />
            );
          })}
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