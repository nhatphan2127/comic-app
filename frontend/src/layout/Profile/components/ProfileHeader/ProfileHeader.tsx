import { useState, type ChangeEvent } from 'react';
import { Camera, ImagePlus } from 'lucide-react';
import type { UserProfile } from '../../../../types/types';
import { userApi } from '../../../../services/api';
import { useToast } from '../../../../context/ToastContext';
import { resolveUploadUrl } from '../../../../helpers/getImage';
import { formatCount } from '../../../../helpers/utils';
import Avatar from '../../../../components/Avatar/Avatar';
import cx from '../../../../helpers/cx';
import style from './ProfileHeader.module.css';

type ProfileHeaderProps = {
  user?: UserProfile | null;
  loading?: boolean;
  onProfileUpdated?: (user: UserProfile) => void;
};

const MB = 1024 * 1024;
const IMAGE_TYPES = 'image/jpeg,image/png,image/webp';

export default function ProfileHeader({ user, loading = false, onProfileUpdated }: ProfileHeaderProps) {
  const [uploading, setUploading] = useState<'avatar' | 'background' | null>(null);
  const toast = useToast();

  const displayName = user?.displayName || user?.username || 'User';
  const avatarUrl = resolveUploadUrl(user?.avatar);
  const backgroundUrl = resolveUploadUrl(user?.background);

  const stats = [
    { label: 'Following', value: user?.stats?.following ?? 0 },
    { label: 'Collections', value: user?.stats?.collections ?? 0 },
    { label: 'Likes', value: user?.stats?.likes ?? user?.likesCount ?? 0 },
    { label: 'Comments', value: user?.stats?.comments ?? user?.commentsCount ?? 0 },
  ];

  const handleUpload = (kind: 'avatar' | 'background', maxMb: number) => async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > maxMb * MB) {
      toast.error(`${kind === 'avatar' ? 'Ảnh đại diện' : 'Ảnh bìa'} phải nhỏ hơn ${maxMb}MB.`);
      return;
    }

    setUploading(kind);
    try {
      const updated = kind === 'avatar' ? await userApi.uploadAvatar(file) : await userApi.uploadBackground(file);
      onProfileUpdated?.(updated);
    } catch (err) {
      toast.error(err, kind === 'avatar' ? 'Không thể cập nhật ảnh đại diện.' : 'Không thể cập nhật ảnh bìa.');
    } finally {
      setUploading(null);
    }
  };

  return (
    <header className={style.profile}>
      <label className={style.banner} title="Change cover image">
        <input type="file" accept={IMAGE_TYPES} className="sr-only" onChange={handleUpload('background', 5)} disabled={uploading !== null} />
        {backgroundUrl ? <span className={style.bannerImage} style={{ backgroundImage: `url("${backgroundUrl}")` }} /> : null}
        <span className={style.bannerEdit}>
          <ImagePlus size={15} />
          {uploading === 'background' ? 'Uploading…' : 'Change cover'}
        </span>
      </label>

      <div className={style.row}>
        <label className={style.avatarWrap} title="Change avatar">
          <input type="file" accept={IMAGE_TYPES} className="sr-only" onChange={handleUpload('avatar', 2)} disabled={uploading !== null} />
          <Avatar name={loading ? '…' : displayName} src={avatarUrl} size={112} className={style.avatar} />
          <span className={cx(style.avatarEdit, uploading === 'avatar' && style.avatarEditBusy)}>
            <Camera size={20} />
          </span>
        </label>

        <div className={style.identity}>
          <h1 className={style.name}>{loading ? 'Loading…' : displayName}</h1>
          {!loading && user?.username ? <p className={cx(style.handle, 'mono')}>@{user.username}</p> : null}
        </div>

        <dl className={style.stats}>
          {stats.map((s) => (
            <div key={s.label} className={style.stat}>
              <dd>{formatCount(s.value)}</dd>
              <dt>{s.label}</dt>
            </div>
          ))}
        </dl>
      </div>
    </header>
  );
}
