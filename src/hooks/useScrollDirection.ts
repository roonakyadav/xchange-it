import { useState, useEffect } from 'react'

export function useScrollHide() {
    const [hidden, setHidden] = useState(false)
    const [lastScrollY, setLastScrollY] = useState(0)

    useEffect(() => {
        const handleScroll = () => {
            const currentScrollY = window.scrollY

            // Scroll threshold to prevent flickering
            if (Math.abs(currentScrollY - lastScrollY) < 5) return

            if (currentScrollY > lastScrollY && currentScrollY > 80) {
                // Scrolling down → hide navbar
                setHidden(true)
            } else {
                // Scrolling up → show navbar
                setHidden(false)
            }

            setLastScrollY(currentScrollY)
        }

        window.addEventListener('scroll', handleScroll)
        return () => window.removeEventListener('scroll', handleScroll)
    }, [lastScrollY])

    return hidden
}
