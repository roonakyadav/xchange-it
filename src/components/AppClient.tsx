"use client";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getUser } from '@/lib/db';
import type { User } from '@/types';
import { useState } from 'react';
import NavDesktop from './NavDesktop';
import NavMobile from './NavMobile';

export default function AppClient({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const router = useRouter();

    useEffect(() => {
        const initializeUser = async () => {
            const username = localStorage.getItem('x_user');

            if (!username) {
                return;
            }

            try {
                // Verify user exists in database
                const userData = await getUser(username);
                if (!userData) {
                    // User doesn't exist, clear localStorage and redirect
                    localStorage.removeItem('x_user');
                    localStorage.removeItem('x_seen_welcome');
                    router.push('/auth');
                    return;
                }

                setUser(userData);
            } catch (error) {
                console.error('Error verifying user:', error);
                // On error, clear localStorage to be safe
                localStorage.removeItem('x_user');
                localStorage.removeItem('x_seen_welcome');
                router.push('/auth');
            }
        };

        initializeUser();
    }, [router]);

    return (
        <>
            <NavMobile />
            <NavDesktop />
            {children}
        </>
    );
}
