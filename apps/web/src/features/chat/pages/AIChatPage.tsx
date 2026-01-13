import React, { useState, useRef, useCallback, useEffect } from 'react'
import { Plus, Image, ArrowUp } from 'lucide-react'
import { api } from '@/services/api'
import { SubscriptionOverlay } from '@/components/subscription/SubscriptionOverlay'

interface Message {
  id: string
  content: string
  isUser: boolean
  timestamp: Date
  imageUrl?: string
}

interface Conversation {
  id: string
  title: string
  preview: string
  timestamp: Date
}

// Suggestion pills
const SUGGESTIONS = [
  'How do I know if a watch is authentic?',
  'How often should I service my watch?',
  'What are the most popular luxury watch brands right now?',
]

interface FormattedTextPart {
  text: string
  bold?: boolean
  italic?: boolean
}

export function AIChatPage() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConversation, setActiveConversation] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [inputText, setInputText] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingConversations, setIsLoadingConversations] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Load conversations on mount
  useEffect(() => {
    loadConversations()
  }, [])

  // Load messages when active conversation changes
  useEffect(() => {
    if (activeConversation) {
      loadMessages(activeConversation)
    }
  }, [activeConversation])

  const loadConversations = async () => {
    setIsLoadingConversations(true)
    try {
      const response = await api.get('/ai-chats')
      const convs = response.data.map((conv: any) => ({
        id: conv.id,
        // Use first_user_message as the title (it's what the user first asked)
        title: conv.first_user_message || conv.title || 'New conversation',
        preview: conv.first_user_message || conv.title || 'No messages yet',
        timestamp: new Date(conv.created_at),
      }))
      setConversations(convs)
    } catch (error) {
      console.error('Failed to load conversations:', error)
    } finally {
      setIsLoadingConversations(false)
    }
  }

  const loadMessages = async (chatId: string) => {
    try {
      const response = await api.get(`/ai-chats/${chatId}/messages`)
      const msgs = response.data.map((msg: any) => ({
        id: msg.id,
        content: msg.content,
        isUser: msg.is_user,
        timestamp: new Date(msg.created_at),
      }))
      setMessages(msgs)
    } catch (error) {
      console.error('Failed to load messages:', error)
      setMessages([])
    }
  }

  const handleSend = useCallback(async () => {
    if (!inputText.trim() || isLoading) return

    const userMessageContent = inputText.trim()
    setInputText('')
    setIsLoading(true)

    try {
      let chatId = activeConversation

      // Create new conversation if none active
      if (!chatId) {
        const createResponse = await api.post('/ai-chats', {
          initial_message: userMessageContent,
        })
        chatId = createResponse.data.id
        setActiveConversation(chatId)

        // Add to conversations list
        const newConv: Conversation = {
          id: chatId!,
          title: userMessageContent.slice(0, 40) + '...',
          preview: userMessageContent,
          timestamp: new Date(),
        }
        setConversations((prev) => [newConv, ...prev])
      } else {
        // Add user message to existing conversation
        await api.post(`/ai-chats/${chatId}/messages`, {
          content: userMessageContent,
          is_ai: false,
        })
      }

      // Add user message to local state
      const userMessage: Message = {
        id: Date.now().toString(),
        content: userMessageContent,
        isUser: true,
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, userMessage])

      // Simulate AI response (in a real app, this would call an AI service)
      setTimeout(async () => {
        const aiResponseContent = generateMockResponse(userMessageContent)

        // Save AI response to backend
        try {
          await api.post(`/ai-chats/${chatId}/messages`, {
            content: aiResponseContent,
            is_ai: true,
          })
        } catch (error) {
          console.error('Failed to save AI response:', error)
        }

        const aiResponse: Message = {
          id: (Date.now() + 1).toString(),
          content: aiResponseContent,
          isUser: false,
          timestamp: new Date(),
        }
        setMessages((prev) => [...prev, aiResponse])
        setIsLoading(false)

        // Update conversation preview
        setConversations((prev) =>
          prev.map((c) =>
            c.id === chatId ? { ...c, preview: aiResponseContent.slice(0, 50) } : c
          )
        )
      }, 2000)
    } catch (error) {
      console.error('Failed to send message:', error)
      setIsLoading(false)
    }
  }, [inputText, isLoading, activeConversation])

  const handleSuggestionClick = (suggestion: string) => {
    setInputText(suggestion)
  }

  const handleNewChat = () => {
    setActiveConversation(null)
    setMessages([])
  }

  const handleSelectConversation = (convId: string) => {
    setActiveConversation(convId)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Parse and render formatted text
  const renderFormattedText = (text: string) => {
    const lines = text.split('\n')
    const elements: React.ReactNode[] = []

    lines.forEach((line, lineIndex) => {
      // Check for numbered list items
      const listMatch = line.match(/^(\d+)\.\s+\*\*(.+?)\*\*:?\s*(.*)$/)
      if (listMatch) {
        const [, number, boldText, rest] = listMatch
        elements.push(
          <div key={lineIndex} className="flex flex-wrap mb-2 ml-1">
            <span className="text-[#212121] text-[15px] leading-5">{number}. </span>
            <span className="text-[#212121] text-[15px] leading-5 font-bold">{boldText}</span>
            {rest && <span className="text-[#212121] text-[15px] leading-5">: {rest}</span>}
          </div>
        )
        return
      }

      // Check for bold headers
      const boldHeaderMatch = line.match(/^\*\*(.+?)\*\*$/)
      if (boldHeaderMatch) {
        elements.push(
          <p key={lineIndex} className="text-[#212121] text-[15px] leading-5 font-bold mb-1">
            {boldHeaderMatch[1]}
          </p>
        )
        return
      }

      // Process inline formatting
      const parts = parseInlineFormatting(line)
      if (parts.length > 0 || line === '') {
        elements.push(
          <p key={lineIndex} className="text-[#212121] text-[15px] leading-5">
            {parts.map((part, partIndex) => {
              if (part.bold) {
                return (
                  <span key={partIndex} className="font-bold">
                    {part.text}
                  </span>
                )
              }
              if (part.italic) {
                return (
                  <span key={partIndex} className="italic">
                    {part.text}
                  </span>
                )
              }
              return part.text
            })}
          </p>
        )
      }
    })

    return elements
  }

  const parseInlineFormatting = (text: string): FormattedTextPart[] => {
    const parts: FormattedTextPart[] = []
    let remaining = text

    while (remaining.length > 0) {
      const boldMatch = remaining.match(/\*\*(.+?)\*\*/)
      const italicMatch = remaining.match(/\*([^*]+)\*/)

      if (boldMatch && (!italicMatch || boldMatch.index! <= italicMatch.index!)) {
        if (boldMatch.index! > 0) {
          parts.push({ text: remaining.slice(0, boldMatch.index) })
        }
        parts.push({ text: boldMatch[1], bold: true })
        remaining = remaining.slice(boldMatch.index! + boldMatch[0].length)
      } else if (italicMatch) {
        if (italicMatch.index! > 0) {
          parts.push({ text: remaining.slice(0, italicMatch.index) })
        }
        parts.push({ text: italicMatch[1], italic: true })
        remaining = remaining.slice(italicMatch.index! + italicMatch[0].length)
      } else {
        parts.push({ text: remaining })
        break
      }
    }

    return parts
  }

  return (
    <SubscriptionOverlay feature="ai_chat">
    <div className="p-4 lg:p-6 bg-white min-h-screen">
      <div className="max-w-7xl mx-auto h-[calc(100vh-96px)]">
        <div className="flex h-full rounded-2xl border border-black/5 overflow-hidden">
          {/* Left Sidebar - Conversation History */}
          <div className="w-[335px] border-r border-black/5 flex flex-col">
            {/* Sidebar Header */}
            <div className="px-4 py-4">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-semibold text-[#1d1d1f] opacity-80">AI Assistant</h2>
                <button
                  onClick={handleNewChat}
                  className="w-10 h-10 rounded-full bg-[#f4f4f4] flex items-center justify-center hover:bg-gray-200 transition-colors"
                >
                  <Plus className="w-[18px] h-[18px] text-[#212121]" />
                </button>
              </div>
            </div>

            {/* Conversation List */}
            <div className="flex-1 overflow-y-auto px-4">
              {isLoadingConversations ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900" />
                </div>
              ) : conversations.length === 0 ? (
                <p className="text-center text-gray-500 py-8 text-sm">No conversations yet</p>
              ) : (
                conversations.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => handleSelectConversation(conv.id)}
                    className={`w-full text-left px-4 py-3 rounded-2xl mb-1 transition-colors ${
                      activeConversation === conv.id ? 'bg-gray-100' : 'hover:bg-gray-50'
                    }`}
                  >
                    <p className="text-[15px] text-[#212121] truncate tracking-[0.075px]">{conv.preview}</p>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Main Chat Area */}
          <div className="flex-1 flex flex-col">
            {/* Date Header */}
            <div className="py-8">
              <p className="text-[13px] text-[#1d1d1f] opacity-50 text-center font-medium">Today</p>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto px-16">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`mb-8 ${message.isUser ? 'flex justify-end' : 'flex justify-start'}`}
                >
                  {message.isUser ? (
                    <div className="bg-[#f6f6f6] px-4 py-2 rounded-xl max-w-[60%]">
                      <p className="text-[15px] text-[#212121] leading-5 tracking-[0.075px]">
                        {message.content}
                      </p>
                    </div>
                  ) : (
                    <div className="max-w-[80%]">{renderFormattedText(message.content)}</div>
                  )}
                </div>
              ))}

              {/* Loading State */}
              {isLoading && (
                <div className="mb-8 flex justify-start">
                  <p className="text-[15px] text-[#212121] opacity-60 leading-5">One sec please...</p>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Bottom Section - Suggestions & Input */}
            <div className="px-16 pb-16">
              {/* Suggestions - Only show when no messages */}
              {messages.length === 0 && !isLoading && (
                <div className="flex flex-wrap gap-4 mb-6">
                  {SUGGESTIONS.map((suggestion, index) => (
                    <button
                      key={index}
                      onClick={() => handleSuggestionClick(suggestion)}
                      className="px-5 py-3 rounded-full border border-[#c1c1c1] bg-gradient-to-b from-transparent to-black/[0.02] hover:border-gray-400 transition-colors"
                    >
                      <span className="text-[15px] text-[#212121] opacity-60 tracking-[0.075px]">
                        {suggestion}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Input Area */}
              <div className="flex items-center gap-4">
                <div className="flex-1 bg-[rgba(33,33,33,0.04)] rounded-full px-4 py-3">
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask anything"
                    className="w-full bg-transparent text-[15px] text-[#212121] placeholder:text-[#212121] placeholder:opacity-50 outline-none tracking-[0.075px]"
                    disabled={isLoading}
                  />
                </div>

                {/* Image Upload Button */}
                <button className="w-11 h-11 rounded-full bg-[#f1f1f1] flex items-center justify-center hover:bg-gray-200 transition-colors">
                  <Image className="w-[18px] h-[18px] text-[#212121]" />
                </button>

                {/* Send Button */}
                <button
                  onClick={handleSend}
                  disabled={!inputText.trim() || isLoading}
                  className="w-11 h-11 rounded-full bg-[#9747ff] flex items-center justify-center hover:bg-[#8033e6] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ArrowUp className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    </SubscriptionOverlay>
  )
}

// Mock response generator
function generateMockResponse(userMessage: string): string {
  const lowerMessage = userMessage.toLowerCase()

  if (lowerMessage.includes('authentic') || lowerMessage.includes('authenticity')) {
    return `Here are the key ways to verify watch authenticity:

**Visual Inspection:**

1. **Serial & Model Numbers:** Check for clean, precise engravings between the lugs and on the case back.
2. **Dial Quality:** Look for perfect alignment, crisp printing, and consistent font spacing.
3. **Movement:** Authentic movements have fine finishing, proper branding, and smooth operation.
4. **Weight & Materials:** Genuine luxury watches have substantial weight from quality materials.
5. **Documentation:** Original box, papers, and warranty cards with matching serial numbers.

*Pro tip:* When in doubt, have the watch authenticated by an authorized dealer or reputable watchmaker.`
  }

  if (lowerMessage.includes('service') || lowerMessage.includes('maintenance')) {
    return `Watch servicing recommendations vary by brand and usage:

**General Guidelines:**

1. **Mechanical watches:** Every 5-7 years for regular wear, or 3-5 years for daily wear.
2. **Quartz watches:** Battery replacement every 2-3 years, full service every 5 years.
3. **Dive watches:** Annual pressure testing if used underwater.
4. **Vintage pieces:** More frequent servicing due to older gaskets and lubricants.

**Signs you need service:**
- Losing or gaining more than 10 seconds per day
- Power reserve diminishing
- Crown feels stiff or loose
- Condensation under crystal

*Always use authorized service centers* for warranty coverage and genuine parts.`
  }

  if (lowerMessage.includes('popular') || lowerMessage.includes('brands')) {
    return `Here are the most sought-after luxury watch brands currently:

**Top Tier (Investment Grade):**

1. **Patek Philippe:** The gold standard for collectors, especially Nautilus and Aquanaut.
2. **Rolex:** Submariner, Daytona, and GMT-Master remain highly liquid assets.
3. **Audemars Piguet:** Royal Oak dominates the steel sports luxury segment.

**Rising Demand:**

4. **Vacheron Constantin:** Overseas gaining significant collector interest.
5. **A. Lange & Söhne:** German excellence in haute horlogerie.
6. **F.P. Journe:** Boutique brand with explosive secondary market growth.

*Market insight:* Steel sports watches from established brands continue to command premium prices despite market corrections.`
  }

  if (lowerMessage.includes('nautilus') || lowerMessage.includes('5711')) {
    return `Here's the short version:

**Why the Patek Philippe Nautilus 5711 spiked in price**

1. **Discontinuation:** Patek officially stopped producing the steel 5711 in 2021, making existing pieces instantly rarer.
2. **Extreme scarcity:** Even before that, demand far exceeded supply — long waitlists and limited production.
3. **Hype & status:** Celebrity ownership, social media buzz, and its reputation as the luxury steel sports watch fueled desire.
4. **Speculation:** Collectors and investors treated it like an asset, driving up resale values.
5. **Brand strategy:** Patek replaced it with the costlier gold 5811, reinforcing the 5711's exclusivity.

In short: *limited supply + massive hype + discontinuation* = price explosion.`
  }

  return `Thank you for your question about "${userMessage}".

I'd be happy to help you with information about luxury watches. Here's what I can assist with:

**My capabilities:**

1. **Market analysis:** Current pricing trends and market values
2. **Authentication tips:** How to verify authenticity
3. **Investment advice:** Which models hold value best
4. **Buying guidance:** Where and how to purchase safely

What specific aspect would you like me to elaborate on?`
}
