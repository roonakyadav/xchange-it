import { useState, useEffect } from 'react'

export function useScrollHide(threshold = 50) {
    const [hidden, setHidden] = useState(false)
    const [lastScrollY, setLastScrollY] = useState(0)

    useEffect(() => {
        const handleScroll = () => {
            const currentScrollY = window.scrollY

            // Ignore small jitters
            if (Math.abs(currentScrollY - lastScrollY) < 10) return

            // Hide when scrolling down beyond threshold
            if (currentScrollY > lastScrollY && currentScrollY > threshold) {
                setHidden(true)
            } else {
                // Show when scrolling up
                setHidden(false)
            }

            setLastScrollY(currentScrollY)
        }

        window.addEventListener('scroll', handleScroll, { passive: true })
        return () => window.removeEventListener('scroll', handleScroll)
    }, [lastScrollY, threshold])

    return hidden
}
