import React, { useState } from 'react';
import type { UserProfile } from '../../../../types/types';
import { API_UPLOADS, userApi } from '../../../../services/api';
import getAvatarBg from '../../../../helpers/getAvatarBg';
import style from './ProfileHeader.module.css';

type ProfileHeaderProps = {
  user?: UserProfile | null;
  loading?: boolean;
  onProfileUpdated?: (user: UserProfile) => void;
};

function getInitials(displayName?: string | null, username?: string | null) {
  const source = displayName || username || 'User';
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function resolveAvatarUrl(avatar?: string | null) {
  if (!avatar) return null;
  if (/^https?:\/\//i.test(avatar) || avatar.startsWith('data:') || avatar.startsWith('blob:')) {
    return avatar;
  }
  return `${API_UPLOADS}${avatar.replace(/^\/+/, '')}`;
}

export default function ProfileHeader({ user, loading = false, onProfileUpdated }: ProfileHeaderProps) {
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingBackground, setUploadingBackground] = useState(false); // State upload background

  const displayName = user?.displayName || user?.username || 'User';
  const avatarUrl = resolveAvatarUrl(user?.avatar);
  const initials = getInitials(user?.displayName, user?.username);
  const avatarBgColor = getAvatarBg(displayName);

  const actions = [
    { label: 'Following', value: user?.stats?.following ?? 0 },
    { label: 'Collections', value: user?.stats?.collections ?? 0 },
    { label: 'Likes', value: user?.stats?.likes ?? user?.likesCount ?? 0 },
    { label: 'Comments', value: user?.stats?.comments ?? user?.commentsCount ?? 0 },
  ];

  const backgroundUrl = user?.background ? resolveAvatarUrl(user.background) : null;

  // Xử lý upload ảnh đại diện
  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert('Ảnh đại diện phải nhỏ hơn 2MB.');
      return;
    }

    try {
      setUploadingAvatar(true);
      const updatedUser = await userApi.uploadAvatar(file);
      onProfileUpdated?.(updatedUser);
    } catch (error) {
      console.error(error);
      alert('Không thể cập nhật ảnh đại diện.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  // Xử lý upload ảnh bìa (Bạn hãy thay thế endpoint API thực tế nếu cần)
  const handleBackgroundChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('Ảnh bìa phải nhỏ hơn 5MB.');
      return;
    }

    try {
      setUploadingBackground(true);
      // Giả định userApi có phương thức uploadBackground
      const updatedUser = await userApi.uploadBackground(file);
      onProfileUpdated?.(updatedUser);
    } catch (error) {
      console.error(error);
      alert('Không thể cập nhật ảnh bìa.');
    } finally {
      setUploadingBackground(false);
    }
  };

  return (
    <header className={style['uprofile']}>
      {/* Banner/Background click cập nhật */}
      <label className={style['uprofile__banner']} title="Thay đổi ảnh bìa">
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className={style['uprofile__hidden-input']}
          onChange={handleBackgroundChange}
          disabled={uploadingBackground}
        />
        {backgroundUrl ? (
          <div className={style['uprofile__banner-image']} style={{ backgroundImage: `url(${backgroundUrl})` }} />
        ) : null}
        
        {/* Lớp phủ hover cho banner */}
        <div className={style['uprofile__banner-overlay']}>
          <span className={style['uprofile__banner-edit-text']}>
            {uploadingBackground ? 'Đang tải...' : '📷 Thay đổi ảnh bìa'}
          </span>
        </div>
      </label>

      <div className={style['uprofile__profile-row']}>
        {/* Avatar click cập nhật */}
        <label className={style['uprofile__avatar-wrap']} title="Thay đổi ảnh đại diện">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className={style['uprofile__hidden-input']}
            onChange={handleAvatarChange}
            disabled={uploadingAvatar}
          />
          {loading ? (
            <span
              className={`${style['uavatar']} ${style['uprofile__avatar']}`}
              aria-hidden="true"
              style={{ fontSize: '35px', background: '#e2e8f0' }}
            >
              ...
            </span>
          ) : avatarUrl ? (
            <img
              className={`${style['uavatar']} ${style['uprofile__avatar']}`}
              src={avatarUrl}
              alt={displayName}
            />
          ) : (
            <span
              className={`${style['uavatar']} ${style['uprofile__avatar']}`}
              aria-hidden="true"
              style={{
                fontSize: '35px',
                backgroundColor: avatarBgColor,
              }}
            >
              {initials}
            </span>
          )}
          
          {/* Lớp phủ hover cho avatar */}
          <div className={style['uprofile__avatar-hover-overlay']}>
            <span>{uploadingAvatar ? '...' : '📷'}</span>
          </div>
        </label>

        <div className={style['uprofile__info-actions']}>
          <div className={style['uprofile__identity']}>
            <h1 className={style['uprofile__name']}>
              {loading ? 'Đang tải...' : displayName}
            </h1>
            {!loading && user?.username && (
              <div className={style['uprofile__username']}>@{user.username}</div>
            )}
          </div>

          <div className={style['uprofile__actions']}>
            {actions.map((action) => (
              <button key={action.label} type="button" className={style['uprofile__action-card']}>
                <span className={style['uprofile__action-value']}>{action.value}</span>
                <span className={style['uprofile__action-label']}>{action.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </header>
  );
}