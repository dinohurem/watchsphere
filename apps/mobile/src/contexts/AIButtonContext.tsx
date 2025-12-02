import { createContext, useState, ReactNode } from 'react';

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

  return (
    <AIButtonContext.Provider value={{ showAIButton, setShowAIButton }}>
      {children}
    </AIButtonContext.Provider>
  );
}
