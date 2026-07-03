import { useEffect, useState } from 'react';
import Header from '../layout/Header.tsx';
import UserProfilePage from '../layout/Profile/UserProfileLayout.tsx';
import { userApi } from '../services/api';
import type { UserProfile } from '../types/data';

export default function Home() {
    const [user, setUser] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;

        const loadProfile = async () => {
            try {
                setLoading(true);
                setError(null);
                const profile = await userApi.getProfile();

                if (isMounted) {
                    setUser(profile ?? null);
                }
            } catch (err) {
                if (isMounted) {
                    setError(err instanceof Error ? err.message : 'Không thể tải thông tin hồ sơ.');
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        loadProfile();

        return () => {
            isMounted = false;
        };
    }, []);

    return (
        <>
            <Header />
            <UserProfilePage user={user} loading={loading} error={error} />
        </>
    );
}