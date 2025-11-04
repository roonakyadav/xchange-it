import { Suspense } from 'react'
import { SearchPage } from '@/components/search-page'

export default function Search() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <SearchPage />
        </Suspense>
    )
}
