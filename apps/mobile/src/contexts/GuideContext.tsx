import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Dimensions, Platform, StatusBar } from 'react-native';
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
  title: string;
  description: string;
  route?: string;
  routeParams?: Record<string, string>;
  getHighlightArea: () => HighlightArea;
}

// Step 1: Profile icon (top left on home)
const profileHighlight = (): HighlightArea => ({
  x: wp(16),
  y: STATUS_BAR_HEIGHT + hp(10),
  width: wp(44),
  height: wp(44),
  borderRadius: wp(22),
});

// Step 2: Search input (on home page)
const searchHighlight = (): HighlightArea => ({
  x: wp(16),
  y: STATUS_BAR_HEIGHT + hp(70),
  width: SCREEN_WIDTH - wp(32),
  height: hp(48),
  borderRadius: wp(24),
});

// Step 3: Market tab in bottom navigation
const marketTabHighlight = (): HighlightArea => ({
  x: SCREEN_WIDTH / 2 - wp(40),
  y: SCREEN_HEIGHT - hp(85),
  width: wp(80),
  height: hp(60),
  borderRadius: wp(12),
});

// Step 4: Filter icon on market page (top right)
const filtersHighlight = (): HighlightArea => ({
  x: SCREEN_WIDTH - wp(60),
  y: STATUS_BAR_HEIGHT + hp(10),
  width: wp(44),
  height: wp(44),
  borderRadius: wp(22),
});

// Step 5: First watch row on market page
const watchRowHighlight = (): HighlightArea => ({
  x: wp(16),
  y: STATUS_BAR_HEIGHT + hp(180),
  width: SCREEN_WIDTH - wp(32),
  height: hp(80),
  borderRadius: wp(16),
});

// Step 6: Order book icon on watch details (should be visible in header)
const orderBookHighlight = (): HighlightArea => ({
  x: SCREEN_WIDTH - wp(60),
  y: STATUS_BAR_HEIGHT + hp(10),
  width: wp(44),
  height: wp(44),
  borderRadius: wp(22),
});

// Step 7: AI chat icon in tab bar (or floating button)
const aiChatHighlight = (): HighlightArea => ({
  x: SCREEN_WIDTH - wp(70),
  y: SCREEN_HEIGHT - hp(160),
  width: wp(56),
  height: wp(56),
  borderRadius: wp(28),
});

// Step 8: Buy/Sell buttons on watch details
const orderButtonsHighlight = (): HighlightArea => ({
  x: wp(16),
  y: SCREEN_HEIGHT - hp(130),
  width: SCREEN_WIDTH - wp(32),
  height: hp(56),
  borderRadius: wp(28),
});

const guideSteps: GuideStep[] = [
  {
    id: 'profile',
    title: 'Your Profile & Settings',
    description: 'Tap here to access your profile, settings, notifications, and account preferences.',
    route: '/(tabs)',
    getHighlightArea: profileHighlight,
  },
  {
    id: 'search',
    title: 'Search Watches',
    description: 'Search for watches by brand, model, or reference number to see market data and pricing.',
    route: '/(tabs)',
    getHighlightArea: searchHighlight,
  },
  {
    id: 'market',
    title: 'Market Tab',
    description: 'Browse trending watches, track prices, and discover market opportunities from the Market tab.',
    route: '/(tabs)',
    getHighlightArea: marketTabHighlight,
  },
  {
    id: 'filters',
    title: 'Watch Filters',
    description: 'Use filters to narrow down watches by brand, price, condition, and more.',
    route: '/(tabs)/market',
    getHighlightArea: filtersHighlight,
  },
  {
    id: 'watch-details',
    title: 'Watch Details',
    description: 'Tap on any watch to see detailed market data, price history, and order book information.',
    route: '/(tabs)/market',
    getHighlightArea: watchRowHighlight,
  },
  {
    id: 'order-book',
    title: 'Order Book',
    description: 'View buy and sell orders for this watch. See current market prices, best bids, and asks from traders worldwide.',
    route: '/market/126610LN',
    routeParams: { id: '126610LN', reference: '126610LN' },
    getHighlightArea: orderBookHighlight,
  },
  {
    id: 'ai-assistant',
    title: 'AI Watch Expert',
    description: 'Chat with our AI assistant to get expert advice on watches, pricing, and market trends.',
    route: '/market/126610LN',
    routeParams: { id: '126610LN', reference: '126610LN' },
    getHighlightArea: aiChatHighlight,
  },
  {
    id: 'place-orders',
    title: 'Place Orders',
    description: 'Ready to buy or sell? Use these buttons to place buy or sell orders for this watch.',
    route: '/market/126610LN',
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

  const { currentGuideStep, currentStep, totalSteps, nextStep, previousStep, endGuide } = context;
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
            <Text style={styles.skipButtonText}>Skip</Text>
          </TouchableOpacity>

          <Text style={styles.title}>{currentGuideStep.title}</Text>
          <Text style={styles.description}>{currentGuideStep.description}</Text>

          <View style={styles.footer}>
            {/* Step indicators */}
            <View style={styles.dotsContainer}>
              {Array.from({ length: totalSteps }).map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.dot,
                    index === currentStep && styles.dotActive,
                  ]}
                />
              ))}
            </View>

            <View style={styles.buttonsRow}>
              {!isFirstStep && (
                <TouchableOpacity
                  style={styles.backButton}
                  onPress={previousStep}
                  activeOpacity={0.8}
                >
                  <Text style={styles.backButtonText}>Back</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.nextButton}
                onPress={isLastStep ? endGuide : nextStep}
                activeOpacity={0.8}
              >
                <Text style={styles.nextButtonText}>
                  {isLastStep ? 'Done' : 'Next'}
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
