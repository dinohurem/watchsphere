import React, { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Dimensions,
  Platform,
  StatusBar,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { wp, hp, sp, fp } from '@/utils/responsive';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useV2 } from '@/contexts/V2Context';
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

// ── Measurement registry ──────────────────────────────────────
// Screens mark the element each step points at with `useGuideTarget(stepId)`; the element is
// measured in window coordinates, so the cutout always sits on the real, rendered element.
// There are no hardcoded fallback positions: until a target is measured the card is shown
// centred over a plain dim, instead of a cutout in the wrong place.
interface Measurement {
  area: HighlightArea;
  at: number;
}
const measurements = new Map<string, Measurement>();
const listeners = new Set<() => void>();

export function registerGuideMeasurement(stepId: string, area: HighlightArea) {
  measurements.set(stepId, { area, at: Date.now() });
  listeners.forEach((l) => l());
}

export function clearGuideMeasurements() {
  measurements.clear();
}

/**
 * Attach to the element a guide step highlights: `<View {...useGuideTarget('search')}>`.
 * Measures on layout and again while its step is showing (after navigation and entrance
 * animations settle).
 */
export function useGuideTarget(stepId: string, borderRadius?: number) {
  const ref = useRef<View>(null);
  const context = useContext(GuideContext);
  const active = context?.currentGuideStep?.id === stepId;

  const measure = useCallback(() => {
    const node = ref.current as unknown as {
      measureInWindow?: (cb: (x: number, y: number, w: number, h: number) => void) => void;
    } | null;
    node?.measureInWindow?.((x, y, width, height) => {
      if (width > 0 && height > 0) {
        registerGuideMeasurement(stepId, { x, y, width, height, borderRadius });
      }
    });
  }, [stepId, borderRadius]);

  useEffect(() => {
    if (!active) return;
    const timers = [0, 300, 700, 1200].map((ms) => setTimeout(measure, ms));
    return () => timers.forEach(clearTimeout);
  }, [active, measure]);

  return { ref, onLayout: measure, collapsable: false as const };
}

/** Wraps the element a guide step points at. */
export function GuideTarget({
  id,
  radius,
  style,
  children,
}: {
  id: string;
  radius?: number;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}) {
  const target = useGuideTarget(id, radius);
  return (
    <View {...target} style={style}>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {children as any}
    </View>
  );
}

interface GuideStepDef {
  id: string;
  titleKey: string;
  descriptionKey: string;
  route?: string;
  routeParams?: Record<string, string>;
  /** Only shown when the element exists, i.e. with the v2 watch page. */
  requiresV2?: boolean;
}

const DETAIL_ROUTE = '/market/[id]';
const DETAIL_PARAMS = { id: '126610LN', reference: '126610LN' };

const allGuideSteps: GuideStepDef[] = [
  { id: 'profile', titleKey: 'guide.profileTitle', descriptionKey: 'guide.profileDescription', route: '/(tabs)' },
  { id: 'search', titleKey: 'guide.searchTitle', descriptionKey: 'guide.searchDescription', route: '/(tabs)' },
  { id: 'market', titleKey: 'guide.marketTitle', descriptionKey: 'guide.marketDescription', route: '/(tabs)' },
  { id: 'filters', titleKey: 'guide.filtersTitle', descriptionKey: 'guide.filtersDescription', route: '/(tabs)/market' },
  { id: 'watch-details', titleKey: 'guide.watchDetailsTitle', descriptionKey: 'guide.watchDetailsDescription', route: '/(tabs)/market' },
  { id: 'order-book', titleKey: 'guide.orderBookTitle', descriptionKey: 'guide.orderBookDescription', route: DETAIL_ROUTE, routeParams: DETAIL_PARAMS },
  { id: 'ai-assistant', titleKey: 'guide.aiAssistantTitle', descriptionKey: 'guide.aiAssistantDescription', route: DETAIL_ROUTE, routeParams: DETAIL_PARAMS, requiresV2: true },
  { id: 'place-orders', titleKey: 'guide.placeOrdersTitle', descriptionKey: 'guide.placeOrdersDescription', route: DETAIL_ROUTE, routeParams: DETAIL_PARAMS, requiresV2: true },
];

const sameScreen = (a?: GuideStepDef, b?: GuideStepDef) =>
  !!a && !!b && a.route === b.route && JSON.stringify(a.routeParams) === JSON.stringify(b.routeParams);

interface GuideContextType {
  isGuideActive: boolean;
  currentStep: number;
  totalSteps: number;
  currentGuideStep: GuideStepDef | null;
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
  const { v2Enabled } = useV2();
  const guideSteps = useMemo(
    () => allGuideSteps.filter((step) => !step.requiresV2 || v2Enabled),
    [v2Enabled]
  );
  const [isGuideActive, setIsGuideActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [hasSeenGuide, setHasSeenGuideState] = useState(true);
  const isNavigating = useRef(false);

  /** Navigate only when the step lives on another screen (re-pushing the same route stacked
   *  duplicate screens and re-mounted the one being highlighted). */
  const navigateToStep = useCallback((step: GuideStepDef, from?: GuideStepDef) => {
    if (!step.route || sameScreen(step, from) || isNavigating.current) return;
    isNavigating.current = true;
    try {
      if (step.routeParams) {
        router.push({ pathname: step.route as never, params: step.routeParams });
      } else {
        router.navigate(step.route as never);
      }
    } catch (e) {
      console.log('Navigation error:', e);
    }
    setTimeout(() => {
      isNavigating.current = false;
    }, 500);
  }, []);

  const startGuide = useCallback(() => {
    setCurrentStep(0);
    setIsGuideActive(true);
    const firstStep = guideSteps[0];
    if (firstStep?.route) router.navigate(firstStep.route as never);
  }, [guideSteps]);

  const endGuide = useCallback(async () => {
    setIsGuideActive(false);
    setCurrentStep(0);
    setHasSeenGuideState(true);
    await AsyncStorage.setItem(GUIDE_SEEN_KEY, 'true');
    // Navigate back to home tab after ending the guide
    router.replace('/(tabs)');
  }, []);

  const goToStep = useCallback(
    (stepIndex: number) => {
      if (stepIndex < 0 || stepIndex >= guideSteps.length || stepIndex === currentStep) return;
      setCurrentStep(stepIndex);
      navigateToStep(guideSteps[stepIndex], guideSteps[currentStep]);
    },
    [currentStep, guideSteps, navigateToStep]
  );

  const nextStep = useCallback(() => {
    if (currentStep < guideSteps.length - 1) goToStep(currentStep + 1);
    else endGuide();
  }, [currentStep, guideSteps.length, endGuide, goToStep]);

  const previousStep = useCallback(() => {
    if (currentStep > 0) goToStep(currentStep - 1);
  }, [currentStep, goToStep]);

  const setHasSeenGuide = useCallback((seen: boolean) => {
    setHasSeenGuideState(seen);
  }, []);

  const checkFirstLogin = useCallback(async (): Promise<boolean> => {
    const seen = await AsyncStorage.getItem(GUIDE_SEEN_KEY);
    const isFirstLogin = seen !== 'true';
    setHasSeenGuideState(!isFirstLogin);
    return isFirstLogin;
  }, []);

  const currentGuideStep = isGuideActive ? guideSteps[currentStep] ?? null : null;

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
  const [, forceUpdate] = useState(0);
  const stepStartedAt = useRef(0);
  const prevStep = useRef<string | null>(null);

  // Re-render whenever a target reports its position.
  useEffect(() => {
    const listener = () => forceUpdate((n) => n + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const stepId = context?.currentGuideStep?.id ?? null;
  if (stepId !== prevStep.current) {
    prevStep.current = stepId;
    stepStartedAt.current = Date.now();
  }

  if (!context || !context.isGuideActive || !context.currentGuideStep) {
    return null;
  }

  const { currentStep, currentGuideStep, totalSteps, nextStep, previousStep, goToStep, endGuide } = context;
  const isLastStep = currentStep === totalSteps - 1;
  const isFirstStep = currentStep === 0;

  // Only trust a position measured while this step is showing (an older one may come from
  // another scroll position or screen).
  const m = measurements.get(currentGuideStep.id);
  const highlightArea = m && m.at >= stepStartedAt.current - 50 ? m.area : null;
  const padding = wp(8);

  const cardHeight = hp(200);
  let cardTop = (SCREEN_HEIGHT - cardHeight) / 2;
  if (highlightArea) {
    const highlightBottom = highlightArea.y + highlightArea.height + padding;
    const spaceBelow = SCREEN_HEIGHT - highlightBottom;
    cardTop =
      spaceBelow > cardHeight + hp(40)
        ? highlightBottom + hp(16)
        : Math.max(STATUS_BAR_HEIGHT + hp(8), highlightArea.y - padding - cardHeight - hp(16));
  }
  const radius = highlightArea ? (highlightArea.borderRadius ?? wp(12)) + padding / 2 : 0;

  return (
    <Modal
      visible={true}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={endGuide}
    >
      <View style={styles.overlay}>
        {/* SVG Overlay with cutout */}
        <Svg width={SCREEN_WIDTH} height={SCREEN_HEIGHT} style={StyleSheet.absoluteFill}>
          <Defs>
            <Mask id="mask">
              <Rect x="0" y="0" width={SCREEN_WIDTH} height={SCREEN_HEIGHT} fill="white" />
              {highlightArea ? (
                <Rect
                  x={highlightArea.x - padding}
                  y={highlightArea.y - padding}
                  width={highlightArea.width + padding * 2}
                  height={highlightArea.height + padding * 2}
                  rx={radius}
                  ry={radius}
                  fill="black"
                />
              ) : null}
            </Mask>
          </Defs>
          <Rect
            x="0"
            y="0"
            width={SCREEN_WIDTH}
            height={SCREEN_HEIGHT}
            fill="rgba(0, 0, 0, 0.75)"
            mask="url(#mask)"
          />
          {highlightArea ? (
            <Rect
              x={highlightArea.x - padding}
              y={highlightArea.y - padding}
              width={highlightArea.width + padding * 2}
              height={highlightArea.height + padding * 2}
              rx={radius}
              ry={radius}
              fill="none"
              stroke="white"
              strokeWidth={2}
            />
          ) : null}
        </Svg>

        {/* Content card */}
        <View style={[styles.contentCard, { top: cardTop }]}>
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

          {/* Skip: rendered last so nothing in the card is drawn over it and steals the tap. */}
          <TouchableOpacity
            style={styles.skipButton}
            onPress={endGuide}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
          >
            <Text style={styles.skipButtonText}>{t('guide.skip')}</Text>
          </TouchableOpacity>
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
    zIndex: 2,
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
    paddingRight: wp(56),
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
