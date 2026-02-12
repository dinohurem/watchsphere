import { createContext, useState, useMemo, ReactNode } from 'react';

interface AIButtonContextType {
  showAIButton: boolean;
  setShowAIButton: (show: boolean) => void;
}

export const AIButtonContext = createContext<AIButtonContextType>({
  showAIButton: true,
  setShowAIButton: () => {},
});

interface AIButtonProviderProps {
  children: ReactNode;
}

export function AIButtonProvider({ children }: AIButtonProviderProps) {
  const [showAIButton, setShowAIButton] = useState(true);

  const value = useMemo(() => ({ showAIButton, setShowAIButton }), [showAIButton]);

  return (
    <AIButtonContext.Provider value={value}>
      {children}
    </AIButtonContext.Provider>
  );
}
