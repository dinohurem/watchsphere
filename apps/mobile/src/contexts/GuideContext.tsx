import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Dimensions, Platform, StatusBar } from 'react-native';
import { useTranslation } from 'react-i18next';
import { wp, hp, sp, fp } from '@/utils/responsive';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import Svg, { Defs, Rect, Mask, Circle, Path, G, ClipPath } from 'react-native-svg';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Get status bar height
const STATUS_BAR_HEIGHT = Platform.OS === 'ios' ? 47 : StatusBar.currentHeight || 0;

interface HighlightArea {
  x: number;
  y: number;
  width: number;
  height: number;
  borderRadius?: number;
}

interface GuideStep {
  id: string;
  titleKey: string;
  descriptionKey: string;
  route?: string;
  routeParams?: Record<string, string>;
  getHighlightArea: () => HighlightArea;
}

// ── Measurement registry ──────────────────────────────────────
// Screens call `registerGuideMeasurement(stepId, layout)` via onLayout
// so the highlight positions come from the actual rendered elements.
const measurements = new Map<string, HighlightArea>();

export function registerGuideMeasurement(stepId: string, area: HighlightArea) {
  measurements.set(stepId, area);
}

export function clearGuideMeasurements() {
  measurements.clear();
}

/** Return the measured area if available, otherwise the fallback. */
function measured(stepId: string, fallback: HighlightArea): HighlightArea {
  return measurements.get(stepId) ?? fallback;
}

// ── Fallback (hardcoded) highlight positions ──────────────────

// Step 1: Profile icon (top right on home)
const profileHighlight = (): HighlightArea => measured('profile', {
  x: SCREEN_WIDTH - wp(16) - sp(44),
  y: STATUS_BAR_HEIGHT + hp(24),
  width: sp(44),
  height: sp(44),
  borderRadius: sp(22),
});

// Step 2: Search input (on home page)
const searchHighlight = (): HighlightArea => measured('search', {
  x: wp(16) + sp(33) + wp(16),
  y: STATUS_BAR_HEIGHT + hp(24),
  width: SCREEN_WIDTH - wp(16) - sp(33) - wp(16) - wp(16) - sp(44) - wp(16),
  height: sp(44),
  borderRadius: sp(22),
});

// Step 3: Market tab in bottom navigation
const marketTabHighlight = (): HighlightArea => {
  const stored = measurements.get('market');
  if (stored) return stored;
  const tabBarPadding = wp(25);
  const aiButtonWidth = sp(54) + wp(16);
  const pillWidth = SCREEN_WIDTH - tabBarPadding * 2 - aiButtonWidth;
  const tabWidth = pillWidth / 4;
  const marketTabX = tabBarPadding + tabWidth;
  return {
    x: marketTabX,
    y: SCREEN_HEIGHT - hp(85),
    width: tabWidth,
    height: hp(55),
    borderRadius: sp(12),
  };
};

// Step 4: Filters button on market page
const filtersHighlight = (): HighlightArea => measured('filters', {
  x: SCREEN_WIDTH - wp(16) - wp(120),
  y: STATUS_BAR_HEIGHT + hp(260),
  width: wp(120),
  height: hp(40),
  borderRadius: sp(20),
});

// Step 5: First watch row on market page
const watchRowHighlight = (): HighlightArea => measured('watch-details', {
  x: wp(16),
  y: STATUS_BAR_HEIGHT + hp(400),
  width: SCREEN_WIDTH - wp(32),
  height: hp(50),
  borderRadius: wp(8),
});

// Step 6: Order book icon on watch details
const orderBookHighlight = (): HighlightArea => {
  const stored = measurements.get('order-book');
  if (stored) return stored;
  const buttonWidth = wp(70);
  const spacing = (SCREEN_WIDTH - wp(16) - buttonWidth * 4) / 5;
  return {
    x: spacing,
    y: STATUS_BAR_HEIGHT + hp(490),
    width: buttonWidth,
    height: hp(60),
    borderRadius: sp(12),
  };
};

// Step 7: AI chat button on watch details
const aiChatHighlight = (): HighlightArea => measured('ai-assistant', {
  x: SCREEN_WIDTH - wp(16) - sp(42),
  y: SCREEN_HEIGHT - hp(70),
  width: sp(42),
  height: sp(42),
  borderRadius: sp(21),
});

// Step 8: Buy/Sell buttons on watch details
const orderButtonsHighlight = (): HighlightArea => measured('place-orders', {
  x: wp(16),
  y: SCREEN_HEIGHT - hp(78),
  width: SCREEN_WIDTH - wp(16) - wp(12) - sp(42) - wp(16),
  height: sp(48),
  borderRadius: sp(24),
});

const guideSteps: GuideStep[] = [
  {
    id: 'profile',
    titleKey: 'guide.profileTitle',
    descriptionKey: 'guide.profileDescription',
    route: '/(tabs)',
    getHighlightArea: profileHighlight,
  },
  {
    id: 'search',
    titleKey: 'guide.searchTitle',
    descriptionKey: 'guide.searchDescription',
    route: '/(tabs)',
    getHighlightArea: searchHighlight,
  },
  {
    id: 'market',
    titleKey: 'guide.marketTitle',
    descriptionKey: 'guide.marketDescription',
    route: '/(tabs)',
    getHighlightArea: marketTabHighlight,
  },
  {
    id: 'filters',
    titleKey: 'guide.filtersTitle',
    descriptionKey: 'guide.filtersDescription',
    route: '/(tabs)/market',
    getHighlightArea: filtersHighlight,
  },
  {
    id: 'watch-details',
    titleKey: 'guide.watchDetailsTitle',
    descriptionKey: 'guide.watchDetailsDescription',
    route: '/(tabs)/market',
    getHighlightArea: watchRowHighlight,
  },
  {
    id: 'order-book',
    titleKey: 'guide.orderBookTitle',
    descriptionKey: 'guide.orderBookDescription',
    route: '/market/[id]',
    routeParams: { id: '126610LN', reference: '126610LN' },
    getHighlightArea: orderBookHighlight,
  },
  {
    id: 'ai-assistant',
    titleKey: 'guide.aiAssistantTitle',
    descriptionKey: 'guide.aiAssistantDescription',
    route: '/market/[id]',
    routeParams: { id: '126610LN', reference: '126610LN' },
    getHighlightArea: aiChatHighlight,
  },
  {
    id: 'place-orders',
    titleKey: 'guide.placeOrdersTitle',
    descriptionKey: 'guide.placeOrdersDescription',
    route: '/market/[id]',
    routeParams: { id: '126610LN', reference: '126610LN' },
    getHighlightArea: orderButtonsHighlight,
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
  goToStep: (stepIndex: number) => void;
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
  const isNavigating = useRef(false);

  const navigateToStep = useCallback((step: GuideStep) => {
    if (step.route && !isNavigating.current) {
      isNavigating.current = true;
      try {
        if (step.routeParams) {
          router.push({ pathname: step.route as any, params: step.routeParams });
        } else {
          router.push(step.route as any);
        }
      } catch (e) {
        console.log('Navigation error:', e);
      }
      setTimeout(() => {
        isNavigating.current = false;
      }, 500);
    }
  }, []);

  const startGuide = useCallback(() => {
    setCurrentStep(0);
    setIsGuideActive(true);
    // Navigate to first step's route
    const firstStep = guideSteps[0];
    if (firstStep.route) {
      router.push(firstStep.route as any);
    }
  }, []);

  const endGuide = useCallback(async () => {
    setIsGuideActive(false);
    setCurrentStep(0);
    setHasSeenGuideState(true);
    await AsyncStorage.setItem(GUIDE_SEEN_KEY, 'true');
    // Navigate back to home tab after ending the guide
    router.replace('/(tabs)');
  }, []);

  const nextStep = useCallback(() => {
    if (currentStep < guideSteps.length - 1) {
      const nextStepData = guideSteps[currentStep + 1];
      setCurrentStep(currentStep + 1);
      navigateToStep(nextStepData);
    } else {
      endGuide();
    }
  }, [currentStep, endGuide, navigateToStep]);

  const previousStep = useCallback(() => {
    if (currentStep > 0) {
      const prevStepData = guideSteps[currentStep - 1];
      setCurrentStep(currentStep - 1);
      navigateToStep(prevStepData);
    }
  }, [currentStep, navigateToStep]);

  const goToStep = useCallback((stepIndex: number) => {
    if (stepIndex >= 0 && stepIndex < guideSteps.length && stepIndex !== currentStep) {
      const targetStep = guideSteps[stepIndex];
      setCurrentStep(stepIndex);
      navigateToStep(targetStep);
    }
  }, [currentStep, navigateToStep]);

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
        goToStep,
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
  const { t } = useTranslation();
  const context = useContext(GuideContext);
  // Force re-render after step navigation so measurements are available
  const [, forceUpdate] = useState(0);
  const prevStep = useRef(-1);

  const currentStep = context?.currentStep ?? -1;
  useEffect(() => {
    if (currentStep !== prevStep.current) {
      prevStep.current = currentStep;
      // Wait for the target screen to mount & measure before reading positions
      const timer = setTimeout(() => forceUpdate(n => n + 1), 600);
      return () => clearTimeout(timer);
    }
  }, [currentStep]);

  if (!context || !context.isGuideActive || !context.currentGuideStep) {
    return null;
  }

  const { currentGuideStep, totalSteps, nextStep, previousStep, goToStep, endGuide } = context;
  const isLastStep = currentStep === totalSteps - 1;
  const isFirstStep = currentStep === 0;

  const highlightArea = currentGuideStep.getHighlightArea();
  const padding = wp(8); // Padding around highlight

  // Calculate card position (below or above highlight)
  const highlightBottom = highlightArea.y + highlightArea.height;
  const cardHeight = hp(180);
  const spaceBelow = SCREEN_HEIGHT - highlightBottom;
  const showCardBelow = spaceBelow > cardHeight + hp(40);

  const cardTop = showCardBelow
    ? highlightBottom + hp(20)
    : highlightArea.y - cardHeight - hp(20);

  return (
    <Modal
      visible={true}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        {/* SVG Overlay with cutout */}
        <Svg width={SCREEN_WIDTH} height={SCREEN_HEIGHT} style={StyleSheet.absoluteFill}>
          <Defs>
            <Mask id="mask">
              {/* Full white background */}
              <Rect x="0" y="0" width={SCREEN_WIDTH} height={SCREEN_HEIGHT} fill="white" />
              {/* Black cutout for highlight area */}
              <Rect
                x={highlightArea.x - padding}
                y={highlightArea.y - padding}
                width={highlightArea.width + padding * 2}
                height={highlightArea.height + padding * 2}
                rx={highlightArea.borderRadius || wp(8)}
                ry={highlightArea.borderRadius || wp(8)}
                fill="black"
              />
            </Mask>
          </Defs>
          {/* Dark overlay with mask */}
          <Rect
            x="0"
            y="0"
            width={SCREEN_WIDTH}
            height={SCREEN_HEIGHT}
            fill="rgba(0, 0, 0, 0.75)"
            mask="url(#mask)"
          />
          {/* White border around highlight */}
          <Rect
            x={highlightArea.x - padding}
            y={highlightArea.y - padding}
            width={highlightArea.width + padding * 2}
            height={highlightArea.height + padding * 2}
            rx={highlightArea.borderRadius || wp(8)}
            ry={highlightArea.borderRadius || wp(8)}
            fill="none"
            stroke="white"
            strokeWidth={2}
          />
        </Svg>

        {/* Content card */}
        <View style={[styles.contentCard, { top: cardTop }]}>
          {/* Skip button */}
          <TouchableOpacity
            style={styles.skipButton}
            onPress={endGuide}
            activeOpacity={0.7}
          >
            <Text style={styles.skipButtonText}>{t('guide.skip')}</Text>
          </TouchableOpacity>

          <Text style={styles.title}>{t(currentGuideStep.titleKey)}</Text>
          <Text style={styles.description}>{t(currentGuideStep.descriptionKey)}</Text>

          <View style={styles.footer}>
            {/* Step indicators - tappable */}
            <View style={styles.dotsContainer}>
              {Array.from({ length: totalSteps }).map((_, index) => (
                <TouchableOpacity
                  key={index}
                  onPress={() => goToStep(index)}
                  activeOpacity={0.7}
                  hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                >
                  <View
                    style={[
                      styles.dot,
                      index === currentStep && styles.dotActive,
                    ]}
                  />
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.buttonsRow}>
              {!isFirstStep && (
                <TouchableOpacity
                  style={styles.backButton}
                  onPress={previousStep}
                  activeOpacity={0.8}
                >
                  <Text style={styles.backButtonText}>{t('guide.back')}</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.nextButton}
                onPress={isLastStep ? endGuide : nextStep}
                activeOpacity={0.8}
              >
                <Text style={styles.nextButtonText}>
                  {isLastStep ? t('guide.done') : t('guide.next')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
  },
  contentCard: {
    position: 'absolute',
    left: wp(24),
    right: wp(24),
    backgroundColor: '#FFFFFF',
    borderRadius: sp(20),
    padding: wp(20),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 10,
  },
  skipButton: {
    position: 'absolute',
    top: wp(16),
    right: wp(16),
    padding: wp(8),
  },
  skipButtonText: {
    fontFamily: 'HankenGrotesk_500Medium',
    fontSize: fp(14),
    color: '#999999',
  },
  title: {
    fontFamily: 'HankenGrotesk_700Bold',
    fontSize: fp(18),
    color: '#1D1D1F',
    marginBottom: hp(8),
    marginTop: hp(8),
  },
  description: {
    fontFamily: 'HankenGrotesk_400Regular',
    fontSize: fp(14),
    color: '#666666',
    lineHeight: fp(20),
    marginBottom: hp(20),
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dotsContainer: {
    flexDirection: 'row',
    gap: wp(6),
  },
  dot: {
    width: wp(8),
    height: wp(8),
    borderRadius: wp(4),
    backgroundColor: '#E0E0E0',
  },
  dotActive: {
    backgroundColor: '#1D1D1F',
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: wp(12),
  },
  backButton: {
    paddingVertical: hp(10),
    paddingHorizontal: wp(20),
    borderRadius: sp(12),
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  backButtonText: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: fp(14),
    color: '#666666',
  },
  nextButton: {
    backgroundColor: '#1D1D1F',
    borderRadius: sp(12),
    paddingVertical: hp(10),
    paddingHorizontal: wp(24),
  },
  nextButtonText: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: fp(14),
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
