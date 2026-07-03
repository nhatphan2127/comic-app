import React, { useState, useEffect, useRef } from 'react';
import { userApi } from '../../../services/api';
import { PROFILE_TEXTS, PROFILE_MESSAGES } from '../../../types/data.ts';

export default function EditProfilePanel() {
  const [formData, setFormData] = useState({
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
  
  // State phục vụ việc kéo thả & zoom
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  
  const dragStart = useRef({ x: 0, y: 0 });
  const imageRef = useRef<HTMLImageElement>(null);
  const cropAreaRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setTempImageSrc(reader.result);
        setZoom(1);
        setPosition({ x: 0, y: 0 });
        setShowCropper(true);
      }
    };
    reader.readAsDataURL(file);
  };

  //--- Logic kéo thả tương tác chuột ---
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

  //--- Tương thích với các thiết bị cảm ứng điện thoại ---
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

  //--- Cắt ảnh thực tế bằng HTML5 Canvas ---
  const handleCropSave = () => {
    if (!imageRef.current || !cropAreaRef.current) return;

    const img = imageRef.current;
    const cropArea = cropAreaRef.current;

    // Lấy tọa độ thực tế trên khung màn hình hiển thị
    const imgRect = img.getBoundingClientRect();
    const cropRect = cropArea.getBoundingClientRect();

    // Tính toán tỉ lệ thực tế của ảnh gốc so với kích thước render hiện tại
    const scaleX = img.naturalWidth / imgRect.width;
    const scaleY = img.naturalHeight / imgRect.height;

    // Xác định toạ độ và kích thước cần cắt dựa trên vùng khoanh tròn
    const sX = (cropRect.left - imgRect.left) * scaleX;
    const sY = (cropRect.top - imgRect.top) * scaleY;
    const sWidth = cropRect.width * scaleX;
    const sHeight = cropRect.height * scaleY;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Đặt kích thước ảnh avatar xuất ra cố định (vd: 200x200px)
    canvas.width = 200;
    canvas.height = 200;

    ctx.drawImage(
      img,
      sX, sY, sWidth, sHeight,  // Vùng cắt nguồn
      0, 0, 200, 200           // Vùng vẽ đích
    );

    const croppedBase64 = canvas.toDataURL('image/jpeg', 0.9);
    setFormData(prev => ({ ...prev, avatar: croppedBase64 }));
    setShowCropper(false);
    setTempImageSrc(null);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Password confirmation check
    if (formData.password && formData.password !== formData.confirmPassword) {
      alert(PROFILE_MESSAGES.passwordMismatch);
      return;
    }

    // Build profile payload excluding password and email (email is immutable)
    const { password, confirmPassword, email, ...profilePayload } = formData as any;

    try {
      // Update profile info first
      await userApi.updateProfile(profilePayload);

      // If user provided a new password, call the password API separately
      if (password) {
        if (password.length < 6) {
          alert(PROFILE_MESSAGES.passwordTooShort);
          return;
        }
        await userApi.updatePassword(password, confirmPassword);
      }

      alert(PROFILE_MESSAGES.success);
      setFormData(prev => ({ ...prev, password: '', confirmPassword: '' }));
    } catch (err) {
      alert(PROFILE_MESSAGES.updateError);
    }
  };

  return (
    <div className="user-content">
      <div className="uview">
        <div className="uview__head">
          <h2 className="uview__title">{PROFILE_TEXTS.title}</h2>
          <p className="uview__sub">{PROFILE_TEXTS.subtitle}</p>
        </div>

        <form className="uform" noValidate onSubmit={handleSubmit}>
          {/* AVATAR SECTION */}
          <section className="uform__section">
            <div className="uform__section-head">
              <div className="uform__section-title">{PROFILE_TEXTS.avatar.label}</div>
              <div className="uform__section-sub">{PROFILE_TEXTS.avatar.note}</div>
            </div>
            <div className="uform__section-body">
              <input 
                accept="image/jpeg,image/png,image/webp" 
                type="file" 
                ref={fileInputRef}
                onChange={handleFileChange}
                style={{ display: 'none' }} 
              />
              <div className="uavatar-edit-wrap">
                <button 
                  type="button" 
                  className="uavatar-edit" 
                  aria-label="Change avatar"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <span 
                    className="uavatar uavatar-edit__inner" 
                    aria-hidden="true" 
                    style={{ 
                      width: '80px', 
                      height: '80px', 
                      fontSize: '34px', 
                      background: 'rgb(122, 82, 56)',
                      backgroundImage: formData.avatar ? `url(${formData.avatar})` : 'none',
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                    }}
                  >
                    {!formData.avatar && (formData.displayName ? formData.displayName[0].toUpperCase() : 'N')}
                  </span>
                  <span className="uavatar-edit__overlay" aria-hidden="true">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M5 8h3l2-3h4l2 3h3v11H5z"></path>
                      <circle cx="12" cy="13" r="3.5"></circle>
                    </svg>
                    <span className="uavatar-edit__hint">Edit</span>
                  </span>
                </button>
              </div>
            </div>
          </section>

          <div className="uform__divider"></div>

          {/* IDENTITY SECTION */}
          <section className="uform__section">
            <div className="uform__section-head">
              <div className="uform__section-title">{PROFILE_TEXTS.identity.label}</div>
              <div className="uform__section-sub">{PROFILE_TEXTS.identity.subtext}</div>
            </div>
            <div className="uform__section-body uform__grid-2">
              <label className="ufield ">
                <span className="ufield__label mono">{PROFILE_TEXTS.identity.displayName}</span>
                <input 
                  type="text"
                  name="displayName"
                  className="ufield__input" 
                  maxLength={16} 
                  value={formData.displayName}
                  onChange={handleChange}
                />
                <span className="ufield__hint">{formData.displayName.length} / 16</span>
              </label>
              <label className="ufield ">
                <span className="ufield__label mono">{PROFILE_TEXTS.identity.username}</span>
                <div className="ufield__wrap">
                  <span className="ufield__prefix">@</span>
                  <input 
                    type="text"
                    name="username"
                    className="ufield__input ufield__input--prefixed" 
                    maxLength={32} 
                    value={formData.username}
                    onChange={handleChange}
                  />
                </div>
                <span className="ufield__hint">{PROFILE_TEXTS.identity.usernameHint}</span>
              </label>
            </div>
          </section>

          <div className="uform__divider"></div>

          {/* BIO SECTION */}
          <section className="uform__section">
            <div className="uform__section-head">
              <div className="uform__section-title">{PROFILE_TEXTS.bio.label}</div>
              <div className="uform__section-sub">{PROFILE_TEXTS.bio.subtext}</div>
            </div>
            <div className="uform__section-body">
              <label className="ufield ufield--full ">
                <span className="ufield__label mono">About you</span>
                <textarea 
                  name="bio"
                  className="ufield__input ufield__input--area" 
                  rows={4} 
                  maxLength={500} 
                  placeholder={PROFILE_TEXTS.bio.placeholder}
                  value={formData.bio}
                  onChange={handleChange}
                />
                <span className="ufield__hint">{formData.bio.length} / 500</span>
              </label>
            </div>
          </section>

          <div className="uform__divider"></div>

          {/* SOCIAL LINKS SECTION */}
          <section className="uform__section">
            <div className="uform__section-head">
              <div className="uform__section-title">{PROFILE_TEXTS.social.label}</div>
              <div className="uform__section-sub">{PROFILE_TEXTS.social.subtext}</div>
            </div>
            <div className="uform__section-body">
              <label className="ufield ufield--full ">
                <span className="ufield__label mono">Links</span>
                <textarea 
                  name="socialLinks"
                  className="ufield__input ufield__input--area" 
                  rows={5} 
                  placeholder={PROFILE_TEXTS.social.placeholder}
                  value={formData.socialLinks}
                  onChange={handleChange}
                />
              </label>
            </div>
          </section>

          <div className="uform__divider"></div>

          {/* EMAIL SECTION */}
          <section className="uform__section">
            <div className="uform__section-head">
              <div className="uform__section-title">{PROFILE_TEXTS.email.label}</div>
              <div className="uform__section-sub">{PROFILE_TEXTS.email.subtext}</div>
            </div>
            <div className="uform__section-body">
              <label className="ufield ufield--full ">
                <span className="ufield__label mono">Email address</span>
                <div className="ufield__wrap">
                  <span className="ufield__prefix ufield__prefix--icon">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect x="3" y="5" width="18" height="14" rx="2"></rect>
                      <path d="M3 7l9 7 9-7"></path>
                    </svg>
                  </span>
                  <input 
                    type="email" 
                    name="email"
                    className="ufield__input ufield__input--prefixed" 
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

          <div className="uform__divider"></div>

          {/* PASSWORD SECTION */}
          <section className="uform__section">
            <div className="uform__section-head">
              <div className="uform__section-title">{PROFILE_TEXTS.password.label}</div>
              <div className="uform__section-sub">{PROFILE_TEXTS.password.subtext}</div>
            </div>
            <div className="uform__section-body uform__grid-2">
              <label className="ufield ">
                <span className="ufield__label mono">{PROFILE_TEXTS.password.newPassword}</span>
                <div className="ufield__wrap">
                  <span className="ufield__prefix ufield__prefix--icon">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect x="5" y="11" width="14" height="10" rx="2"></rect>
                      <path d="M8 11V8a4 4 0 0 1 8 0v3"></path>
                    </svg>
                  </span>
                  <input 
                    type="password" 
                    name="password"
                    className="ufield__input ufield__input--prefixed" 
                    placeholder="••••••••" 
                    autoComplete="new-password" 
                    value={formData.password}
                    onChange={handleChange}
                  />
                </div>
              </label>
              <label className="ufield ">
                <span className="ufield__label mono">{PROFILE_TEXTS.password.confirmPassword}</span>
                <div className="ufield__wrap">
                  <span className="ufield__prefix ufield__prefix--icon">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect x="5" y="11" width="14" height="10" rx="2"></rect>
                      <path d="M8 11V8a4 4 0 0 1 8 0v3"></path>
                    </svg>
                  </span>
                  <input 
                    type="password" 
                    name="confirmPassword"
                    className="ufield__input ufield__input--prefixed" 
                    placeholder="••••••••" 
                    autoComplete="new-password" 
                    value={formData.confirmPassword}
                    onChange={handleChange}
                  />
                </div>
              </label>
            </div>
          </section>

          <div className="uform__actions">
            <button type="submit" className="ubtn ubtn--primary">{PROFILE_TEXTS.buttonSave}</button>
          </div>
        </form>
      </div>

      {/* CROPPER MODAL */}
      {showCropper && (
        <div className="cropper-modal-overlay">
          <div className="cropper-modal-content">
            <div className="cropper-header">
              <h3>✓ Crop your avatar</h3>
              <button 
                type="button" 
                className="cropper-close-btn"
                onClick={() => setShowCropper(false)}
              >
                ✕
              </button>
            </div>

            {/* Vùng workspace cho phép kéo thả ảnh */}
            <div 
              className="cropper-workspace"
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
                src={tempImageSrc ?? undefined}
                alt="Source"
                className="cropper-image"
                style={{
                  transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`
                }}
              />
              {/* Vòng tròn mặt nạ cắt ảnh */}
              <div ref={cropAreaRef} className="crop-target-area" />
            </div>

            {/* Phần điều khiển slider Zoom và các nút lệnh */}
            <div className="cropper-footer">
              <div className="zoom-control">
                <span className="zoom-label">ZOOM</span>
                <input
                  type="range"
                  min="1"
                  max="4"
                  step="0.05"
                  value={zoom}
                  onChange={(e) => setZoom(parseFloat(e.target.value))}
                  className="zoom-slider"
                />
              </div>
              <div className="cropper-buttons-row">
                <button 
                  type="button" 
                  className="btn-cropper-cancel" 
                  onClick={() => setShowCropper(false)}
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  className="btn-cropper-save" 
                  onClick={handleCropSave}
                >
                  Set Avatar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}