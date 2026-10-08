import { useEffect, useState } from 'react';
import HeaderLayout from '../layout/HeaderLayout/HeaderLayout';
import UserProfileLayout from '../layout/Profile/UserProfileLayout';
import { userApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import type { UserProfile as UserProfileData } from '../types/types';

export default function UserProfile() {
  const [user, setUser] = useState<UserProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { updateUser } = useAuth();

  // Keep the stored role in step with the server, so a newly promoted contributor sees their tools.
  useEffect(() => {
    if (user?.role) updateUser({ role: user.role });
  }, [user?.role, updateUser]);

  useEffect(() => {
    let cancelled = false;

    userApi
      .getProfile()
      .then((profile) => !cancelled && setUser(profile ?? null))
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : 'Không thể tải thông tin hồ sơ.'))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <HeaderLayout />
      <UserProfileLayout user={user} loading={loading} error={error} onUserUpdated={setUser} />
    </>
  );
}
