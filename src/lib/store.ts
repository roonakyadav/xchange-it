import { create } from 'zustand'
import type { User, Session } from '@supabase/supabase-js'

interface AuthState {
    user: User | null
    session: Session | null
    isLoading: boolean
    isGuest: boolean
    setUser: (user: User | null) => void
    setSession: (session: Session | null) => void
    setLoading: (loading: boolean) => void
    setGuest: (guest: boolean) => void
}

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    session: null,
    isLoading: true,
    isGuest: false,
    setUser: (user) => set({ user }),
    setSession: (session) => set({ session }),
    setLoading: (isLoading) => set({ isLoading }),
    setGuest: (isGuest) => set({ isGuest }),
}))

interface UIState {
    isAuthModalOpen: boolean
    authModalMode: 'login' | 'signup'
    setAuthModalOpen: (open: boolean) => void
    setAuthModalMode: (mode: 'login' | 'signup') => void
}

export const useUIStore = create<UIState>((set) => ({
    isAuthModalOpen: false,
    authModalMode: 'login',
    setAuthModalOpen: (open) => set({ isAuthModalOpen: open }),
    setAuthModalMode: (mode) => set({ authModalMode: mode }),
}))
