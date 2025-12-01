import React, { useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Animated } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { useTheme } from '@/contexts/ThemeContext';
import { MoreHorizontal, Pin, Trash2, Check } from './icons';

interface SwipeableChatItemProps {
  children: React.ReactNode;
  onMore: () => void;
  onPin: () => void;
  onDelete: () => void;
  isGroup?: boolean;
  onPress?: () => void;
}

export function SwipeableChatItem({ children, onMore, onPin, onDelete, isGroup = false, onPress }: SwipeableChatItemProps) {
  const { colors, fonts } = useTheme();
  const swipeableRef = useRef<Swipeable>(null);
  const [showModal, setShowModal] = React.useState(false);
  const [modalPosition, setModalPosition] = React.useState({ x: 0, y: 0 });
  const [isSwiping, setIsSwiping] = React.useState(false);
  const moreButtonRef = useRef<View>(null);

  const styles = React.useMemo(() => StyleSheet.create({
    actionsContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    actionButton: {
      width: 60,
      height: '100%',
      justifyContent: 'center',
      alignItems: 'center',
    },
    actionText: {
      color: '#FFFFFF',
      fontSize: 11,
      fontFamily: fonts.semiBold,
      marginTop: 4,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.3)',
    },
    modalContent: {
      minWidth: 200,
      borderRadius: 12,
      paddingVertical: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 8,
      elevation: 5,
    },
    modalOption: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 16,
      paddingHorizontal: 20,
      gap: 12,
    },
    modalOptionText: {
      fontSize: 16,
      fontFamily: fonts.medium,
    },
    modalDivider: {
      height: 1,
      marginHorizontal: 20,
    },
  }), [fonts]);

  const renderRightActions = (progress: Animated.AnimatedInterpolation<number>, dragX: Animated.AnimatedInterpolation<number>) => {
    // Elastic animation - buttons come from right
    const trans = dragX.interpolate({
      inputRange: [-180, 0],
      outputRange: [0, 180],
      extrapolate: 'clamp',
    });

    return (
      <Animated.View
        style={[
          styles.actionsContainer,
          {
            transform: [{ translateX: trans }],
          }
        ]}
      >
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: colors.primary }]}
          onPress={() => {
            // Get button position for modal placement
            moreButtonRef.current?.measure((x, y, width, height, pageX, pageY) => {
              setModalPosition({ x: pageX, y: pageY + height });
              setShowModal(true);
            });
          }}
        >
          <View ref={moreButtonRef}>
            <MoreHorizontal size={20} color="#FFFFFF" />
            <Text style={styles.actionText}>More</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: '#FF9500' }]}
          onPress={() => {
            swipeableRef.current?.close();
            onPin();
          }}
        >
          <Pin size={20} color="#FFFFFF" />
          <Text style={styles.actionText}>Pin</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: '#FF3B30' }]}
          onPress={() => {
            swipeableRef.current?.close();
            onDelete();
          }}
        >
          <Trash2 size={20} color="#FFFFFF" />
          <Text style={styles.actionText}>Delete</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <>
      <Swipeable
        ref={swipeableRef}
        renderRightActions={renderRightActions}
        rightThreshold={40}
        overshootRight={false}
        friction={1.5}
        overshootFriction={8}
        enableTrackpadTwoFingerGesture
        onSwipeableWillOpen={() => setIsSwiping(true)}
        onSwipeableClose={() => setIsSwiping(false)}
        containerStyle={{ backgroundColor: 'transparent' }}
        childrenContainerStyle={{ backgroundColor: colors.card }}
      >
        <View pointerEvents={isSwiping ? 'none' : 'auto'}>
          {children}
        </View>
      </Swipeable>

      {/* More Options Modal */}
      <Modal
        visible={showModal}
        transparent
        animationType="none"
        onRequestClose={() => setShowModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => {
            setShowModal(false);
            swipeableRef.current?.close();
          }}
        >
          <View
            style={[
              styles.modalContent,
              {
                backgroundColor: colors.card,
                position: 'absolute',
                right: 16,
                top: modalPosition.y || 100,
              }
            ]}
          >
            <TouchableOpacity
              style={styles.modalOption}
              onPress={() => {
                setShowModal(false);
                swipeableRef.current?.close();
                onMore();
              }}
            >
              <Check size={20} color={colors.text} />
              <Text style={[styles.modalOptionText, { color: colors.text }]}>Mark as read</Text>
            </TouchableOpacity>

            <View style={[styles.modalDivider, { backgroundColor: colors.border }]} />

            <TouchableOpacity
              style={styles.modalOption}
              onPress={() => {
                setShowModal(false);
                swipeableRef.current?.close();
                // Handle mute
              }}
            >
              <Text style={[styles.modalOptionText, { color: colors.text }]}>Mute</Text>
            </TouchableOpacity>

            <View style={[styles.modalDivider, { backgroundColor: colors.border }]} />

            <TouchableOpacity
              style={styles.modalOption}
              onPress={() => {
                setShowModal(false);
                swipeableRef.current?.close();
                onDelete();
              }}
            >
              <Trash2 size={20} color="#FF3B30" />
              <Text style={[styles.modalOptionText, { color: '#FF3B30' }]}>Delete</Text>
            </TouchableOpacity>

            {isGroup && (
              <>
                <View style={[styles.modalDivider, { backgroundColor: colors.border }]} />
                <TouchableOpacity
                  style={styles.modalOption}
                  onPress={() => {
                    setShowModal(false);
                    swipeableRef.current?.close();
                    // Handle leave chat
                  }}
                >
                  <Text style={[styles.modalOptionText, { color: '#FF3B30' }]}>Leave Chat</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}
