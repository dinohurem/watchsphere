import React, { useEffect } from 'react';
import { router } from 'expo-router';

interface AIChatModalProps {
  visible: boolean;
  onClose: () => void;
}

/**
 * AIChatModal - Now redirects to the dedicated AI chat screen
 * This component is kept for backwards compatibility
 */
export function AIChatModal({ visible, onClose }: AIChatModalProps) {
  useEffect(() => {
    if (visible) {
      // Close this "modal" and navigate to the AI chat screen
      onClose();
      router.push('/chat/ai');
    }
  }, [visible, onClose]);

  // This component no longer renders anything
  // It just handles navigation when triggered
  return null;
}
