import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Animated,
  PanResponder,
  Text,
  Dimensions,
} from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { AISparkle, MessageSquare, Move, EyeOff } from './icons';

interface FloatingAIButtonV2Props {
  onPress: () => void;
  onHide: () => void;
}

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;
const BUTTON_SIZE = 48;
const EXPANDED_WIDTH = 120;

export function FloatingAIButtonV2({ onPress, onHide }: FloatingAIButtonV2Props) {
  const { colors, fonts } = useTheme();
  const [showMenu, setShowMenu] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isOnLeftSide, setIsOnLeftSide] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const position = useRef(
    new Animated.ValueXY({
      x: SCREEN_WIDTH - BUTTON_SIZE - 20,
      y: SCREEN_HEIGHT - (Platform.OS === 'ios' ? 140 : 130),
    })
  ).current;

  const expandAnim = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const longPressTimeout = useRef<NodeJS.Timeout | null>(null);
  const expandIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isAnimatingRef = useRef(false);

  // Periodic expand animation
  useEffect(() => {
    const runExpandAnimation = () => {
      if (showMenu || isDragging || isAnimatingRef.current) return;

      isAnimatingRef.current = true;
      setIsExpanded(true);

      // Expand animation
      Animated.parallel([
        Animated.spring(expandAnim, {
          toValue: 1,
          tension: 50,
          friction: 8,
          useNativeDriver: false,
        }),
        Animated.timing(textOpacity, {
          toValue: 1,
          duration: 200,
          delay: 100,
          useNativeDriver: true,
        }),
      ]).start();

      // Collapse after 2 seconds
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(textOpacity, {
            toValue: 0,
            duration: 150,
            useNativeDriver: true,
          }),
          Animated.spring(expandAnim, {
            toValue: 0,
            tension: 50,
            friction: 8,
            useNativeDriver: false,
          }),
        ]).start(() => {
          setIsExpanded(false);
          isAnimatingRef.current = false;
        });
      }, 2000);
    };

    // Run initially after 3 seconds
    const initialTimeout = setTimeout(runExpandAnimation, 3000);

    // Then run every 30 seconds
    expandIntervalRef.current = setInterval(runExpandAnimation, 30000);

    return () => {
      clearTimeout(initialTimeout);
      if (expandIntervalRef.current) {
        clearInterval(expandIntervalRef.current);
      }
    };
  }, [showMenu, isDragging]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        const moved = Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) > 5;
        if (moved && longPressTimeout.current) {
          clearTimeout(longPressTimeout.current);
          longPressTimeout.current = null;
        }
        return moved;
      },
      onPanResponderGrant: () => {
        setIsDragging(true);
        setShowMenu(false);
        // Collapse if expanded
        if (isExpanded) {
          Animated.parallel([
            Animated.timing(textOpacity, { toValue: 0, duration: 100, useNativeDriver: true }),
            Animated.timing(expandAnim, { toValue: 0, duration: 100, useNativeDriver: false }),
          ]).start(() => {
            setIsExpanded(false);
            isAnimatingRef.current = false;
          });
        }
        position.extractOffset();
      },
      onPanResponderMove: Animated.event(
        [null, { dx: position.x, dy: position.y }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: () => {
        position.flattenOffset();
        setIsDragging(false);

        // Get current position
        // @ts-ignore
        const currentX = position.x._value;
        // @ts-ignore
        const currentY = position.y._value;

        // Constrain to screen bounds
        const maxX = SCREEN_WIDTH - BUTTON_SIZE - 20;
        const maxY = SCREEN_HEIGHT - (Platform.OS === 'ios' ? 140 : 130);

        const constrainedX = Math.max(20, Math.min(currentX, maxX));
        const constrainedY = Math.max(60, Math.min(currentY, maxY));

        // Snap to nearest edge (left or right)
        const snapX = constrainedX < SCREEN_WIDTH / 2 ? 20 : maxX;

        // Update left side state for menu positioning
        setIsOnLeftSide(snapX === 20);

        Animated.spring(position, {
          toValue: { x: snapX, y: constrainedY },
          useNativeDriver: false,
          friction: 7,
          tension: 40,
        }).start();
      },
    })
  ).current;

  const handlePressIn = () => {
    longPressTimeout.current = setTimeout(() => {
      setShowMenu(true);
      longPressTimeout.current = null;
    }, 500);
  };

  const handlePressOut = () => {
    if (longPressTimeout.current) {
      clearTimeout(longPressTimeout.current);
      longPressTimeout.current = null;
    }
  };

  const handlePress = () => {
    if (!isDragging && !showMenu) {
      onPress();
    }
  };

  const handleMenuAction = (action: () => void) => {
    setShowMenu(false);
    setTimeout(action, 100);
  };

  const buttonWidth = expandAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [BUTTON_SIZE, EXPANDED_WIDTH],
  });

  // When on right side, offset x position to expand leftward
  const expandOffset = expandAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -(EXPANDED_WIDTH - BUTTON_SIZE)],
  });

  // Animate padding to center icon when collapsed
  const contentPaddingLeft = expandAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 14],
  });

  const styles = StyleSheet.create({
    floatingButton: {
      position: 'absolute',
      height: BUTTON_SIZE,
      zIndex: 1000,
    },
    buttonTouchable: {
      width: '100%',
      height: '100%',
      borderRadius: BUTTON_SIZE / 2,
      backgroundColor: '#FFFFFF',
      borderWidth: 1,
      borderColor: '#0088FF',
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.15,
      shadowRadius: 6,
      elevation: 4,
    },
    buttonContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    buttonText: {
      fontSize: 14,
      fontFamily: fonts.semiBold,
      color: '#0088FF',
      marginLeft: 6,
    },
    bubbleMenu: {
      position: 'absolute',
      bottom: BUTTON_SIZE + 10,
      backgroundColor: '#FFFFFF',
      borderRadius: 12,
      minWidth: 160,
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.25,
      shadowRadius: 8,
      elevation: 5,
      overflow: 'visible',
    },
    bubbleMenuLeft: {
      left: 0,
    },
    bubbleMenuRight: {
      right: 0,
    },
    menuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 16,
      gap: 12,
    },
    menuDivider: {
      height: 1,
      backgroundColor: '#E5E5EA',
      marginHorizontal: 8,
    },
    menuText: {
      fontSize: 15,
      fontFamily: fonts.medium,
      color: '#000000',
    },
    menuTextDanger: {
      color: '#FF3B30',
    },
    menuArrow: {
      position: 'absolute',
      bottom: -6,
      width: 12,
      height: 12,
      backgroundColor: '#FFFFFF',
      transform: [{ rotate: '45deg' }],
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.1,
      shadowRadius: 2,
    },
    menuArrowLeft: {
      left: 12,
    },
    menuArrowRight: {
      right: 12,
    },
  });

  return (
    <>
      <Animated.View
        style={[
          styles.floatingButton,
          {
            width: buttonWidth,
            transform: [
              ...position.getTranslateTransform(),
              // Apply offset only when on right side to expand leftward
              { translateX: isOnLeftSide ? 0 : expandOffset },
            ],
          },
        ]}
        {...panResponder.panHandlers}
      >
        <TouchableOpacity
          style={styles.buttonTouchable}
          onPress={handlePress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          activeOpacity={0.8}
        >
          <Animated.View style={[styles.buttonContent, { paddingLeft: contentPaddingLeft }]}>
            <AISparkle size={20} color="#0088FF" />
            <Animated.Text style={[styles.buttonText, { opacity: textOpacity }]}>
              Ask AI
            </Animated.Text>
          </Animated.View>
        </TouchableOpacity>

        {/* Bubble Menu */}
        {showMenu && (
          <View style={[
            styles.bubbleMenu,
            isOnLeftSide ? styles.bubbleMenuLeft : styles.bubbleMenuRight
          ]}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => handleMenuAction(onPress)}
            >
              <MessageSquare size={18} color="#000000" />
              <Text style={styles.menuText}>New Chat</Text>
            </TouchableOpacity>

            <View style={styles.menuDivider} />

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => handleMenuAction(() => {})}
            >
              <Move size={18} color="#000000" />
              <Text style={styles.menuText}>Move (Drag)</Text>
            </TouchableOpacity>

            <View style={styles.menuDivider} />

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => handleMenuAction(onHide)}
            >
              <EyeOff size={18} color="#FF3B30" />
              <Text style={[styles.menuText, styles.menuTextDanger]}>Hide</Text>
            </TouchableOpacity>

            {/* Arrow pointing to button */}
            <View style={[
              styles.menuArrow,
              isOnLeftSide ? styles.menuArrowLeft : styles.menuArrowRight
            ]} />
          </View>
        )}
      </Animated.View>
    </>
  );
}
