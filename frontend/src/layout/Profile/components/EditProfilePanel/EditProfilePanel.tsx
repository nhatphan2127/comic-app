import React, { useState, useEffect, useRef } from 'react';
import { userApi, API_UPLOADS } from '../../../../services/api.ts';
import { PROFILE_TEXTS, PROFILE_MESSAGES } from '../../../../types/types.ts';
import getAvatarBg from '../../../../helpers/getAvatarBg.ts';
import style from './EditProfilePanel.module.css';

// Hàm lấy chữ cái viết tắt của tên
function getInitials(displayName?: string | null, username?: string | null) {
  const source = displayName || username || 'User';
  const parts = source.split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return 'U';
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function resolveAvatarUrl(avatar?: string | null) {
  if (!avatar) {
    return null;
  }

  if (/^https?:\/\//i.test(avatar) || avatar.startsWith('data:') || avatar.startsWith('blob:')) {
    return avatar;
  }

  return `${API_UPLOADS}${avatar.replace(/^\/+/, '')}`;
}

// 1. Định nghĩa kiểu dữ liệu rõ ràng để tránh dùng 'any'
interface ProfileFormData {
  avatar: string;
  displayName: string;
  username: string;
  bio: string;
  socialLinks: string;
  email: string;
  password?: string;
  confirmPassword?: string;
}

// ==========================================
// COMPONENT CON: IMAGE CROPPER MODAL
// ==========================================
interface ImageCropperModalProps {
  imageSrc: string;
  onClose: () => void;
  onSave: (croppedBase64: string) => void;
}

function ImageCropperModal({ imageSrc, onClose, onSave }: ImageCropperModalProps) {
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  const dragStart = useRef({ x: 0, y: 0 });
  const imageRef = useRef<HTMLImageElement>(null);
  const cropAreaRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragStart.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y
    });
  };

  const handleMouseUpOrLeave = () => {
    setIsDragging(false);
  };

  // --- Tương tác cảm ứng di động ---
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      dragStart.current = {
        x: e.touches[0].clientX - position.x,
        y: e.touches[0].clientY - position.y
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    if (e.touches.length === 1) {
      setPosition({
        x: e.touches[0].clientX - dragStart.current.x,
        y: e.touches[0].clientY - dragStart.current.y
      });
    }
  };

  // --- Xử lý cắt ảnh với Canvas ---
  const handleCropSave = () => {
    if (!imageRef.current || !cropAreaRef.current) return;

    const img = imageRef.current;
    const cropArea = cropAreaRef.current;

    const imgRect = img.getBoundingClientRect();
    const cropRect = cropArea.getBoundingClientRect();

    const scaleX = img.naturalWidth / imgRect.width;
    const scaleY = img.naturalHeight / imgRect.height;

    const sX = (cropRect.left - imgRect.left) * scaleX;
    const sY = (cropRect.top - imgRect.top) * scaleY;
    const sWidth = cropRect.width * scaleX;
    const sHeight = cropRect.height * scaleY;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 200;
    canvas.height = 200;

    ctx.drawImage(
      img,
      sX, sY, sWidth, sHeight,
      0, 0, 200, 200
    );

    const croppedBase64 = canvas.toDataURL('image/jpeg', 0.9);
    onSave(croppedBase64);
  };

  return (
    <div className={style['cropper-modal-overlay']}>
      <div className={style['cropper-modal-content']}>
        <div className={style['cropper-header']}>
          <h3>✓ Crop your avatar</h3>
          <button type="button" className={style['cropper-close-btn']} onClick={onClose}>
            ✕
          </button>
        </div>

        <div
          className={style['cropper-workspace']}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUpOrLeave}
          onMouseLeave={handleMouseUpOrLeave}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleMouseUpOrLeave}
        >
          <img
            ref={imageRef}
            src={imageSrc}
            alt="Source"
            className={style['cropper-image']}
            style={{
              transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
              userSelect: 'none'
            }}
          />
          <div ref={cropAreaRef} className={style['crop-target-area']} />
        </div>

        <div className={style['cropper-footer']}>
          <div className={style['zoom-control']}>
            <span className={style['zoom-label']}>ZOOM</span>
            <input
              type="range"
              min="1"
              max="4"
              step="0.05"
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className={style['zoom-slider']}
            />
          </div>
          <div className={style['cropper-buttons-row']}>
            <button type="button" className={style['btn-cropper-cancel']} onClick={onClose}>
              Cancel
            </button>
            <button type="button" className={style['btn-cropper-save']} onClick={handleCropSave}>
              Set Avatar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// COMPONENT CHÍNH: EDIT PROFILE PANEL
// ==========================================
export default function EditProfilePanel() {
  const [formData, setFormData] = useState<ProfileFormData>({
    avatar: '',
    displayName: '',
    username: '',
    bio: '',
    socialLinks: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const [tempImageSrc, setTempImageSrc] = useState<string | null>(null);
  const [showCropper, setShowCropper] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false); // Ngăn double submission

  const fileInputRef = useRef<HTMLInputElement>(null);

  const resolvedAvatarUrl = resolveAvatarUrl(formData.avatar);
  const initials = getInitials(formData.displayName, formData.username);
  const avatarBgColor = getAvatarBg(formData.displayName || formData.username || 'User');

  useEffect(() => {
    async function fetchProfile() {
      try {
        const data = await userApi.getProfile();
        setFormData({
          avatar: data.avatar || '',
          displayName: data.displayName || '',
          username: data.username || '',
          bio: data.bio || '',
          socialLinks: data.socialLinks || '',
          email: data.email || '',
          password: '',
          confirmPassword: '',
        });
      } catch (err) {
        console.error(PROFILE_MESSAGES.fetchError, err);
      }
    }
    fetchProfile();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    if (file.size > 1024 * 1024) {
      alert(PROFILE_MESSAGES.imageSizeError);
      return;
    }

    // Tối ưu: Dùng Object URL nhanh hơn và tốn ít RAM hơn FileReader
    const objectUrl = URL.createObjectURL(file);
    setTempImageSrc(objectUrl);
    setShowCropper(true);
  };

  // Reset các thông số và dọn dẹp bộ nhớ tạm
  const handleCloseCropper = () => {
    if (tempImageSrc) {
      URL.revokeObjectURL(tempImageSrc); // Giải phóng bộ nhớ của blob URL
    }
    setTempImageSrc(null);
    setShowCropper(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = ''; // Reset input để cho phép chọn lại cùng 1 ảnh
    }
  };

  const handleSaveCroppedImage = (croppedBase64: string) => {
    setFormData(prev => ({ ...prev, avatar: croppedBase64 }));
    handleCloseCropper();
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (formData.password && formData.password !== formData.confirmPassword) {
      alert(PROFILE_MESSAGES.passwordMismatch);
      return;
    }

    setIsSubmitting(true);

    // TypeScript tự động suy luận loại bỏ trường không cần thiết mà không cần ép kiểu "any"
    const { password, confirmPassword, email, ...profilePayload } = formData;

    try {
      await userApi.updateProfile(profilePayload);

      if (password) {
        if (password.length < 6) {
          alert(PROFILE_MESSAGES.passwordTooShort);
          setIsSubmitting(false);
          return;
        }
        await userApi.updatePassword(password, confirmPassword || '');
      }

      alert(PROFILE_MESSAGES.success);
      setFormData(prev => ({ ...prev, password: '', confirmPassword: '' }));
    } catch (err) {
      alert(PROFILE_MESSAGES.updateError);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={style['user-content']}>
      <div className={style['uview']}>
        <div className={style['uview__head']}>
          <h2 className={style['uview__title']}>{PROFILE_TEXTS.title}</h2>
          <p className={style['uview__sub']}>{PROFILE_TEXTS.subtitle}</p>
        </div>

        <form className={style['uform']} noValidate onSubmit={handleSubmit}>
          {/* AVATAR SECTION */}
          <section className={style['uform__section']}>
            <div className={style['uform__section-head']}>
              <div className={style['uform__section-title']}>{PROFILE_TEXTS.avatar.label}</div>
              <div className={style['uform__section-sub']}>{PROFILE_TEXTS.avatar.note}</div>
            </div>
            <div className={style['uform__section-body']}>
              <input 
                accept="image/jpeg,image/png,image/webp" 
                type="file" 
                ref={fileInputRef}
                onChange={handleFileChange}
                style={{ display: 'none' }} 
              />
              <div className={style['uavatar-edit-wrap']}>
                <button 
                  type="button" 
                  className={style['uavatar-edit']} 
                  aria-label="Change avatar"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isSubmitting}
                >
                  <span 
                    className={`${style['uavatar']} ${style['uavatar-edit__inner']}`} 
                    aria-hidden="true" 
                    style={{ 
                      width: '80px', 
                      height: '80px', 
                      fontSize: '34px', 
                      backgroundColor: resolvedAvatarUrl ? undefined : avatarBgColor,
                    }}
                  >
                    {resolvedAvatarUrl ? (
                      <img 
                        alt="" 
                        loading="lazy" 
                        decoding="async" 
                        src={resolvedAvatarUrl} 
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                      />
                    ) : (
                      initials
                    )}
                  </span>
                  <span className={style['uavatar-edit__overlay']} aria-hidden="true">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M5 8h3l2-3h4l2 3h3v11H5z"></path>
                      <circle cx="12" cy="13" r="3.5"></circle>
                    </svg>
                    <span className={style['uavatar-edit__hint']}>Edit</span>
                  </span>
                </button>
                {formData.avatar && (
                  <button 
                    type="button" 
                    className={style['uavatar-edit__remove']} 
                    aria-label="Remove avatar" 
                    title="Remove avatar"
                    onClick={() => setFormData(prev => ({ ...prev, avatar: '' }))}
                    disabled={isSubmitting}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M6 6l12 12M18 6l-12 12"></path>
                    </svg>
                  </button>
                )}
              </div>
            </div>
          </section>

          <div className={style['uform__divider']}></div>

          {/* IDENTITY SECTION */}
          <section className={style['uform__section']}>
            <div className={style['uform__section-head']}>
              <div className={style['uform__section-title']}>{PROFILE_TEXTS.identity.label}</div>
              <div className={style['uform__section-sub']}>{PROFILE_TEXTS.identity.subtext}</div>
            </div>
            <div className={`${style['uform__section-body']} ${style['uform__grid-2']}`}>
              <label className={style['ufield']}>
                <span className={`${style['ufield__label']} ${style['mono'] || 'mono'}`}>{PROFILE_TEXTS.identity.displayName}</span>
                <input 
                  type="text"
                  name="displayName"
                  className={style['ufield__input']} 
                  maxLength={16} 
                  value={formData.displayName}
                  onChange={handleChange}
                  disabled={isSubmitting}
                />
                <span className={style['ufield__hint']}>{formData.displayName.length} / 16</span>
              </label>
              <label className={style['ufield']}>
                <span className={`${style['ufield__label']} ${style['mono'] || 'mono'}`}>{PROFILE_TEXTS.identity.username}</span>
                <div className={style['ufield__wrap']}>
                  <span className={style['ufield__prefix']}>@</span>
                  <input 
                    type="text"
                    name="username"
                    className={`${style['ufield__input']} ${style['ufield__input--prefixed']}`} 
                    maxLength={32} 
                    value={formData.username}
                    onChange={handleChange}
                    disabled={isSubmitting}
                  />
                </div>
                <span className={style['ufield__hint']}>{PROFILE_TEXTS.identity.usernameHint}</span>
              </label>
            </div>
          </section>

          <div className={style['uform__divider']}></div>

          {/* BIO SECTION */}
          <section className={style['uform__section']}>
            <div className={style['uform__section-head']}>
              <div className={style['uform__section-title']}>{PROFILE_TEXTS.bio.label}</div>
              <div className={style['uform__section-sub']}>{PROFILE_TEXTS.bio.subtext}</div>
            </div>
            <div className={style['uform__section-body']}>
              <label className={`${style['ufield']} ${style['ufield--full']}`}>
                <span className={`${style['ufield__label']} ${style['mono'] || 'mono'}`}>About you</span>
                <textarea 
                  name="bio"
                  className={`${style['ufield__input']} ${style['ufield__input--area']}`} 
                  rows={4} 
                  maxLength={500} 
                  placeholder={PROFILE_TEXTS.bio.placeholder}
                  value={formData.bio}
                  onChange={handleChange}
                  disabled={isSubmitting}
                />
                <span className={style['ufield__hint']}>{formData.bio.length} / 500</span>
              </label>
            </div>
          </section>

          <div className={style['uform__divider']}></div>

          {/* SOCIAL LINKS SECTION */}
          <section className={style['uform__section']}>
            <div className={style['uform__section-head']}>
              <div className={style['uform__section-title']}>{PROFILE_TEXTS.social.label}</div>
              <div className={style['uform__section-sub']}>{PROFILE_TEXTS.social.subtext}</div>
            </div>
            <div className={style['uform__section-body']}>
              <label className={`${style['ufield']} ${style['ufield--full']}`}>
                <span className={`${style['ufield__label']} ${style['mono'] || 'mono'}`}>Links</span>
                <textarea 
                  name="socialLinks"
                  className={`${style['ufield__input']} ${style['ufield__input--area']}`} 
                  rows={5} 
                  placeholder={PROFILE_TEXTS.social.placeholder}
                  value={formData.socialLinks}
                  onChange={handleChange}
                  disabled={isSubmitting}
                />
              </label>
            </div>
          </section>

          <div className={style['uform__divider']}></div>

          {/* EMAIL SECTION */}
          <section className={style['uform__section']}>
            <div className={style['uform__section-head']}>
              <div className={style['uform__section-title']}>{PROFILE_TEXTS.email.label}</div>
              <div className={style['uform__section-sub']}>{PROFILE_TEXTS.email.subtext}</div>
            </div>
            <div className={style['uform__section-body']}>
              <label className={`${style['ufield']} ${style['ufield--full']}`}>
                <span className={`${style['ufield__label']} ${style['mono'] || 'mono'}`}>Email address</span>
                <div className={style['ufield__wrap']}>
                  <span className={`${style['ufield__prefix']} ${style['ufield__prefix--icon']}`}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect x="3" y="5" width="18" height="14" rx="2"></rect>
                      <path d="M3 7l9 7 9-7"></path>
                    </svg>
                  </span>
                  <input 
                    type="email" 
                    name="email"
                    className={`${style['ufield__input']} ${style['ufield__input--prefixed']}`} 
                    placeholder={PROFILE_TEXTS.email.placeholder}
                    value={formData.email}
                    readOnly
                    title="Email cannot be changed"
                    aria-readonly="true"
                  />
                </div>
              </label>
            </div>
          </section>

          <div className={style['uform__divider']}></div>

          {/* PASSWORD SECTION */}
          <section className={style['uform__section']}>
            <div className={style['uform__section-head']}>
              <div className={style['uform__section-title']}>{PROFILE_TEXTS.password.label}</div>
              <div className={style['uform__section-sub']}>{PROFILE_TEXTS.password.subtext}</div>
            </div>
            <div className={`${style['uform__section-body']} ${style['uform__grid-2']}`}>
              <label className={style['ufield']}>
                <span className={`${style['ufield__label']} ${style['mono'] || 'mono'}`}>{PROFILE_TEXTS.password.newPassword}</span>
                <div className={style['ufield__wrap']}>
                  <span className={`${style['ufield__prefix']} ${style['ufield__prefix--icon']}`}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect x="5" y="11" width="14" height="10" rx="2"></rect>
                      <path d="M8 11V8a4 4 0 0 1 8 0v3"></path>
                    </svg>
                  </span>
                  <input 
                    type="password" 
                    name="password"
                    className={`${style['ufield__input']} ${style['ufield__input--prefixed']}`} 
                    placeholder="••••••••" 
                    autoComplete="new-password" 
                    value={formData.password}
                    onChange={handleChange}
                    disabled={isSubmitting}
                  />
                </div>
              </label>
              <label className={style['ufield']}>
                <span className={`${style['ufield__label']} ${style['mono'] || 'mono'}`}>{PROFILE_TEXTS.password.confirmPassword}</span>
                <div className={style['ufield__wrap']}>
                  <span className={`${style['ufield__prefix']} ${style['ufield__prefix--icon']}`}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect x="5" y="11" width="14" height="10" rx="2"></rect>
                      <path d="M8 11V8a4 4 0 0 1 8 0v3"></path>
                    </svg>
                  </span>
                  <input 
                    type="password" 
                    name="confirmPassword"
                    className={`${style['ufield__input']} ${style['ufield__input--prefixed']}`} 
                    placeholder="••••••••" 
                    autoComplete="new-password" 
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    disabled={isSubmitting}
                  />
                </div>
              </label>
            </div>
          </section>

          <div className={style['uform__actions']}>
            <button 
              type="submit" 
              className={`${style['ubtn']} ${style['ubtn--primary']}`} 
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving...' : PROFILE_TEXTS.buttonSave}
            </button>
          </div>
        </form>
      </div>

      {/* CROPPER MODAL (Chỉ render khi cần thiết và giữ logic kéo thả độc lập) */}
      {showCropper && tempImageSrc && (
        <ImageCropperModal
          imageSrc={tempImageSrc}
          onClose={handleCloseCropper}
          onSave={handleSaveCroppedImage}
        />
      )}
    </div>
  );
}