import React, { useState, useRef } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Animated,
  PanResponder,
  Modal,
  Text,
  Dimensions,
} from 'react-native';
import { Sparkles, MessageSquare, Move, EyeOff } from './icons';

interface FloatingAIButtonAdvancedProps {
  onPress: () => void;
  onHide: () => void;
}

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;
const BUTTON_SIZE = 48;

export function FloatingAIButtonAdvanced({ onPress, onHide }: FloatingAIButtonAdvancedProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const position = useRef(
    new Animated.ValueXY({
      x: SCREEN_WIDTH - BUTTON_SIZE - 20,
      y: SCREEN_HEIGHT - (Platform.OS === 'ios' ? 140 : 130),
    })
  ).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only start dragging if there's significant movement
        return Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) > 5;
      },
      onPanResponderGrant: () => {
        setIsDragging(true);
        position.setOffset({
          // @ts-ignore
          x: position.x._value,
          // @ts-ignore
          y: position.y._value,
        });
        position.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event([null, { dx: position.x, dy: position.y }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: (_, gestureState) => {
        position.flattenOffset();
        setIsDragging(false);

        // Snap to edges
        // @ts-ignore
        const finalX = position.x._value + gestureState.dx < SCREEN_WIDTH / 2
          ? 20
          : SCREEN_WIDTH - BUTTON_SIZE - 20;

        Animated.spring(position, {
          // @ts-ignore
          toValue: { x: finalX, y: position.y._value },
          useNativeDriver: false,
          friction: 7,
        }).start();
      },
    })
  ).current;

  const handleLongPress = () => {
    setShowMenu(true);
  };

  const handleNewChat = () => {
    setShowMenu(false);
    onPress();
  };

  const handleMove = () => {
    setShowMenu(false);
    // Moving is now handled by pan responder - just inform user
  };

  const handleHide = () => {
    setShowMenu(false);
    onHide();
  };

  return (
    <>
      <Animated.View
        style={[
          styles.floatingButton,
          {
            transform: position.getTranslateTransform(),
          },
        ]}
        {...(isDragging ? {} : panResponder.panHandlers)}
      >
        <TouchableOpacity
          style={styles.buttonTouchable}
          onPress={isDragging ? undefined : onPress}
          onLongPress={handleLongPress}
          activeOpacity={0.8}
          delayLongPress={500}
        >
          <Sparkles size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </Animated.View>

      {/* Long Press Menu */}
      <Modal
        visible={showMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMenu(false)}
      >
        <TouchableOpacity
          style={styles.menuOverlay}
          activeOpacity={1}
          onPress={() => setShowMenu(false)}
        >
          <View style={styles.menuContainer}>
            <TouchableOpacity style={styles.menuItem} onPress={handleNewChat}>
              <MessageSquare size={20} color="#000000" />
              <Text style={styles.menuText}>New Chat</Text>
            </TouchableOpacity>

            <View style={styles.menuDivider} />

            <TouchableOpacity style={styles.menuItem} onPress={handleMove}>
              <Move size={20} color="#000000" />
              <Text style={styles.menuText}>Move (Drag button)</Text>
            </TouchableOpacity>

            <View style={styles.menuDivider} />

            <TouchableOpacity style={styles.menuItem} onPress={handleHide}>
              <EyeOff size={20} color="#FF3B30" />
              <Text style={[styles.menuText, styles.menuTextDanger]}>Hide</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  floatingButton: {
    position: 'absolute',
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    zIndex: 1000,
  },
  buttonTouchable: {
    width: '100%',
    height: '100%',
    borderRadius: BUTTON_SIZE / 2,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    minWidth: 200,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
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
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
  },
  menuTextDanger: {
    color: '#FF3B30',
  },
});
