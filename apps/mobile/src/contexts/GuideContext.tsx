import React, { createContext, useContext, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Dimensions } from 'react-native';
import { wp, hp, sp, fp } from '@/utils/responsive';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface GuideStep {
  id: string;
  title: string;
  description: string;
  highlightArea?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

const guideSteps: GuideStep[] = [
  {
    id: 'profile',
    title: 'Your Profile & Settings',
    description: 'Access profile details, account settings, notifications, etc.',
  },
  {
    id: 'search',
    title: 'Search Watches',
    description: 'Search for watches by brand, model, or reference number to see market data and pricing.',
  },
  {
    id: 'market',
    title: 'Market Data',
    description: 'Browse trending watches, track prices, and discover market opportunities.',
  },
  {
    id: 'filters',
    title: 'Watch Filters',
    description: 'Apply filters to focus on specific watches and their market trends',
  },
];

interface GuideContextType {
  isGuideActive: boolean;
  currentStep: number;
  totalSteps: number;
  currentGuideStep: GuideStep | null;
  startGuide: () => void;
  endGuide: () => void;
  nextStep: () => void;
  previousStep: () => void;
  hasSeenGuide: boolean;
  setHasSeenGuide: (seen: boolean) => void;
  checkFirstLogin: () => Promise<boolean>;
}

const GuideContext = createContext<GuideContextType | undefined>(undefined);

const GUIDE_SEEN_KEY = 'watchsphere_guide_seen';

export function GuideProvider({ children }: { children: React.ReactNode }) {
  const [isGuideActive, setIsGuideActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [hasSeenGuide, setHasSeenGuideState] = useState(true);

  const startGuide = useCallback(() => {
    setCurrentStep(0);
    setIsGuideActive(true);
  }, []);

  const endGuide = useCallback(async () => {
    setIsGuideActive(false);
    setCurrentStep(0);
    setHasSeenGuideState(true);
    await AsyncStorage.setItem(GUIDE_SEEN_KEY, 'true');
  }, []);

  const nextStep = useCallback(() => {
    if (currentStep < guideSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      endGuide();
    }
  }, [currentStep, endGuide]);

  const previousStep = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  }, [currentStep]);

  const setHasSeenGuide = useCallback((seen: boolean) => {
    setHasSeenGuideState(seen);
  }, []);

  const checkFirstLogin = useCallback(async (): Promise<boolean> => {
    const seen = await AsyncStorage.getItem(GUIDE_SEEN_KEY);
    const isFirstLogin = seen !== 'true';
    setHasSeenGuideState(!isFirstLogin);
    return isFirstLogin;
  }, []);

  const currentGuideStep = isGuideActive ? guideSteps[currentStep] : null;

  return (
    <GuideContext.Provider
      value={{
        isGuideActive,
        currentStep,
        totalSteps: guideSteps.length,
        currentGuideStep,
        startGuide,
        endGuide,
        nextStep,
        previousStep,
        hasSeenGuide,
        setHasSeenGuide,
        checkFirstLogin,
      }}
    >
      {children}
      <GuideOverlay />
    </GuideContext.Provider>
  );
}

function GuideOverlay() {
  const context = useContext(GuideContext);

  if (!context || !context.isGuideActive || !context.currentGuideStep) {
    return null;
  }

  const { currentGuideStep, currentStep, totalSteps, nextStep, endGuide } = context;
  const isLastStep = currentStep === totalSteps - 1;

  return (
    <Modal
      visible={true}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        {/* Dark overlay */}
        <View style={styles.backdrop} />

        {/* Content card */}
        <View style={styles.contentCard}>
          <Text style={styles.title}>{currentGuideStep.title}</Text>
          <Text style={styles.description}>{currentGuideStep.description}</Text>

          <View style={styles.footer}>
            <Text style={styles.stepIndicator}>
              {currentStep + 1}/{totalSteps}
            </Text>
            <TouchableOpacity
              style={styles.nextButton}
              onPress={isLastStep ? endGuide : nextStep}
              activeOpacity={0.8}
            >
              <Text style={styles.nextButtonText}>
                {isLastStep ? 'Complete' : 'Next'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  contentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: sp(20),
    padding: wp(24),
    width: SCREEN_WIDTH - wp(48),
    maxWidth: 360,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  title: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: fp(20),
    fontWeight: '600',
    color: '#1D1D1F',
    marginBottom: hp(12),
  },
  description: {
    fontFamily: 'HankenGrotesk_400Regular',
    fontSize: fp(15),
    color: '#666666',
    lineHeight: fp(22),
    marginBottom: hp(24),
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stepIndicator: {
    fontFamily: 'HankenGrotesk_500Medium',
    fontSize: fp(14),
    color: '#999999',
  },
  nextButton: {
    backgroundColor: '#1D1D1F',
    borderRadius: sp(12),
    paddingVertical: hp(12),
    paddingHorizontal: wp(24),
  },
  nextButtonText: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: fp(15),
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export function useGuide() {
  const context = useContext(GuideContext);
  if (context === undefined) {
    throw new Error('useGuide must be used within a GuideProvider');
  }
  return context;
}
