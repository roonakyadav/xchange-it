'use client'

import { useState } from 'react'
import { useAuthStore, useUIStore } from '@/lib/store'
import { signInWithGoogle, signInAnonymously } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { Chrome, User, Loader2 } from 'lucide-react'

export function AuthModal() {
    const { isAuthModalOpen, authModalMode, setAuthModalOpen } = useUIStore()
    const { setUser, setLoading } = useAuthStore()
    const [isSigningIn, setIsSigningIn] = useState(false)

    const handleGoogleSignIn = async () => {
        try {
            setIsSigningIn(true)
            const { error } = await signInWithGoogle()
            if (error) {
                toast.error('Failed to sign in with Google')
                console.error('Google sign in error:', error)
            }
            // Don't close modal here - OAuth will redirect
        } catch (error) {
            toast.error('An error occurred during sign in')
            console.error('Sign in error:', error)
        } finally {
            setIsSigningIn(false)
        }
    }

    const handleGuestSignIn = async () => {
        try {
            setIsSigningIn(true)
            setLoading(true)
            const { error } = await signInAnonymously()
            if (error) {
                toast.error('Failed to continue as guest')
                console.error('Guest sign in error:', error)
            } else {
                toast.success('Welcome! You can now browse and create posts.')
                setAuthModalOpen(false)
            }
        } catch (error) {
            toast.error('An error occurred')
            console.error('Guest sign in error:', error)
        } finally {
            setIsSigningIn(false)
            setLoading(false)
        }
    }

    return (
        <Dialog open={isAuthModalOpen} onOpenChange={setAuthModalOpen}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Welcome to Xchange</DialogTitle>
                </DialogHeader>

                <Tabs value={authModalMode} onValueChange={(value) => useUIStore.getState().setAuthModalMode(value as 'login' | 'signup')}>
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="login">Sign In</TabsTrigger>
                        <TabsTrigger value="signup">Sign Up</TabsTrigger>
                    </TabsList>

                    <TabsContent value="login" className="space-y-4">
                        <Card>
                            <CardHeader className="text-center">
                                <CardTitle>Sign In</CardTitle>
                                <CardDescription>
                                    Choose how you'd like to sign in
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <Button
                                    onClick={handleGoogleSignIn}
                                    disabled={isSigningIn}
                                    className="w-full"
                                    variant="outline"
                                >
                                    {isSigningIn ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                        <Chrome className="mr-2 h-4 w-4" />
                                    )}
                                    Continue with Google
                                </Button>

                                <div className="relative">
                                    <div className="absolute inset-0 flex items-center">
                                        <span className="w-full border-t" />
                                    </div>
                                    <div className="relative flex justify-center text-xs uppercase">
                                        <span className="bg-background px-2 text-muted-foreground">
                                            Or
                                        </span>
                                    </div>
                                </div>

                                <Button
                                    onClick={handleGuestSignIn}
                                    disabled={isSigningIn}
                                    className="w-full"
                                    variant="secondary"
                                >
                                    {isSigningIn ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                        <User className="mr-2 h-4 w-4" />
                                    )}
                                    Continue as Guest
                                </Button>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="signup" className="space-y-4">
                        <Card>
                            <CardHeader className="text-center">
                                <CardTitle>Create Account</CardTitle>
                                <CardDescription>
                                    Join Xchange to start trading digital assets
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <Button
                                    onClick={handleGoogleSignIn}
                                    disabled={isSigningIn}
                                    className="w-full"
                                    variant="outline"
                                >
                                    {isSigningIn ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                        <Chrome className="mr-2 h-4 w-4" />
                                    )}
                                    Sign up with Google
                                </Button>

                                <div className="relative">
                                    <div className="absolute inset-0 flex items-center">
                                        <span className="w-full border-t" />
                                    </div>
                                    <div className="relative flex justify-center text-xs uppercase">
                                        <span className="bg-background px-2 text-muted-foreground">
                                            Or
                                        </span>
                                    </div>
                                </div>

                                <Button
                                    onClick={handleGuestSignIn}
                                    disabled={isSigningIn}
                                    className="w-full"
                                    variant="secondary"
                                >
                                    {isSigningIn ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                        <User className="mr-2 h-4 w-4" />
                                    )}
                                    Continue as Guest
                                </Button>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    )
}
