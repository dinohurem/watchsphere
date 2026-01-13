import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { MoreVertical } from 'lucide-react'

interface ActionMenuProps {
  children: React.ReactNode
  isOpen: boolean
  onToggle: () => void
  onClose: () => void
}

export function ActionMenu({ children, isOpen, onToggle, onClose }: ActionMenuProps) {
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ top: 0, left: 0 })

  // Calculate position when menu opens
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      const menuWidth = 192 // w-48 = 12rem = 192px

      // Position the menu below the button, aligned to the right
      setPosition({
        top: rect.bottom + 8,
        left: rect.right - menuWidth,
      })
    }
  }, [isOpen])

  // Close menu when clicking outside
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        onClose()
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    // Add a small delay to prevent immediate close
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleEscape)
    }, 0)

    return () => {
      clearTimeout(timeoutId)
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, onClose])

  // Close menu on scroll
  useEffect(() => {
    if (!isOpen) return

    const handleScroll = () => {
      onClose()
    }

    window.addEventListener('scroll', handleScroll, true)
    return () => window.removeEventListener('scroll', handleScroll, true)
  }, [isOpen, onClose])

  return (
    <>
      <button
        ref={buttonRef}
        onClick={onToggle}
        className="p-1 hover:bg-gray-100 rounded"
      >
        <MoreVertical className="w-5 h-5 text-gray-400" />
      </button>

      {isOpen &&
        createPortal(
          <div
            ref={menuRef}
            className="fixed w-48 bg-white rounded-lg shadow-lg border z-[9999] py-1"
            style={{
              top: position.top,
              left: position.left,
            }}
          >
            {children}
          </div>,
          document.body
        )}
    </>
  )
}

interface ActionMenuItemProps {
  children: React.ReactNode
  onClick: () => void
  variant?: 'default' | 'danger' | 'success'
  icon?: React.ReactNode
  disabled?: boolean
}

export function ActionMenuItem({ children, onClick, variant = 'default', icon, disabled }: ActionMenuItemProps) {
  const variantClasses = {
    default: 'text-gray-700 hover:bg-gray-50',
    danger: 'text-red-600 hover:bg-red-50',
    success: 'text-green-600 hover:bg-green-50',
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center w-full px-4 py-2 text-sm ${variantClasses[variant]} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      {icon && <span className="mr-2">{icon}</span>}
      {children}
    </button>
  )
}
