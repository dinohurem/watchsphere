import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChevronLeft, Calendar, User, Eye, Newspaper } from 'lucide-react'
import { api } from '@/services/api'

interface NewsArticle {
  id: string
  title: string
  slug: string
  content: string
  excerpt?: string
  cover_image?: string
  author_id: string
  author_name: string
  status: string
  published_at?: string
  tags: string[]
  views: number
  created_at: string
}

export function NewsDetailsPage() {
  const { newsId } = useParams<{ newsId: string }>()
  const navigate = useNavigate()

  const [article, setArticle] = useState<NewsArticle | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Scroll to top when component mounts
    window.scrollTo(0, 0)
    loadArticle()
  }, [newsId])

  const loadArticle = async () => {
    if (!newsId) {
      setError('Article not found')
      setLoading(false)
      return
    }

    try {
      const response = await api.get(`/news/${newsId}`)
      setArticle(response.data)
    } catch (err: any) {
      console.error('Failed to load article:', err)
      setError(err.response?.data?.detail || 'Failed to load article')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  if (loading) {
    return (
      <div className="p-6 lg:p-8 bg-gray-50 min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  if (error || !article) {
    return (
      <div className="p-6 lg:p-8 bg-gray-50 min-h-screen">
        <div className="max-w-7xl mx-auto">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
          >
            <ChevronLeft className="w-5 h-5" />
            Back
          </button>
          <div className="text-center py-12">
            <Newspaper className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500">{error || 'Article not found'}</p>
            <button
              onClick={loadArticle}
              className="mt-4 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 lg:p-8 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
        >
          <ChevronLeft className="w-5 h-5" />
          Back
        </button>

        {/* Cover Image */}
        {article.cover_image && (
          <div className="w-full h-[300px] lg:h-[400px] rounded-2xl overflow-hidden mb-8 bg-gray-100">
            <img
              src={article.cover_image}
              alt={article.title}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Article Header */}
        <div className="mb-8">
          {/* Tags */}
          {article.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {article.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-3 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded-full"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Title */}
          <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4 leading-tight">
            {article.title}
          </h1>

          {/* Meta Info */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4" />
              <span>{article.author_name}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <span>{formatDate(article.published_at || article.created_at)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4" />
              <span>{article.views} views</span>
            </div>
          </div>
        </div>

        {/* Excerpt */}
        {article.excerpt && (
          <p className="text-lg text-gray-600 mb-8 leading-relaxed font-medium">
            {article.excerpt}
          </p>
        )}

        {/* Content */}
        <div
          className="prose prose-lg max-w-none prose-headings:text-gray-900 prose-p:text-gray-700 prose-a:text-blue-600 prose-img:rounded-lg"
          dangerouslySetInnerHTML={{ __html: article.content }}
        />
      </div>
    </div>
  )
}
