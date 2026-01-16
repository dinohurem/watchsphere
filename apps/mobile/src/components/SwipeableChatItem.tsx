import React, { useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Animated, Pressable, TextInput, Alert } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { useTheme } from '@/contexts/ThemeContext';
import { MoreVertical, Trash2, CheckCheck, Flag, X } from './icons';
import { api } from '@/services/api';

interface SwipeableChatItemProps {
  children: React.ReactNode;
  onMore: () => void;
  onDelete: () => void;
  isGroup?: boolean;
  onPress?: () => void;
  chatId?: string;
  chatName?: string;
  onLongPress?: () => void;
}

export function SwipeableChatItem({ children, onMore, onDelete, isGroup = false, onPress, chatId, chatName, onLongPress }: SwipeableChatItemProps) {
  const { colors, fonts } = useTheme();
  const swipeableRef = useRef<Swipeable>(null);
  const [showModal, setShowModal] = React.useState(false);
  const [modalPosition, setModalPosition] = React.useState({ x: 0, y: 0 });
  const [isSwiping, setIsSwiping] = React.useState(false);
  const [showReportModal, setShowReportModal] = React.useState(false);
  const [reportReason, setReportReason] = React.useState('');
  const [reportDescription, setReportDescription] = React.useState('');
  const [isSubmittingReport, setIsSubmittingReport] = React.useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const moreButtonRef = useRef<View>(null);

  const handleLongPress = () => {
    if (onLongPress) {
      onLongPress();
    } else {
      // Default behavior: show the modal
      setShowModal(true);
    }
  };

  const handleReport = async () => {
    if (!reportReason) {
      Alert.alert('Error', 'Please select a reason for the report');
      return;
    }

    setIsSubmittingReport(true);
    try {
      await api.post('/support/reports', {
        reported_type: isGroup ? 'group' : 'conversation',
        reported_id: chatId,
        reported_name: chatName,
        reason: reportReason,
        description: reportDescription,
      });
      Alert.alert('Report Submitted', 'Thank you for your report. We will review it shortly.');
      setShowReportModal(false);
      setReportReason('');
      setReportDescription('');
    } catch (error) {
      console.error('Failed to submit report:', error);
      Alert.alert('Error', 'Failed to submit report. Please try again.');
    } finally {
      setIsSubmittingReport(false);
    }
  };

  const handleDeleteConfirm = () => {
    setShowDeleteConfirm(false);
    onDelete();
  };

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
    // Report modal styles
    reportModalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    reportModalContent: {
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingBottom: 40,
    },
    reportModalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
    },
    reportModalTitle: {
      fontSize: 18,
      fontFamily: fonts.semiBold,
    },
    reportModalBody: {
      padding: 20,
    },
    reportLabel: {
      fontSize: 14,
      fontFamily: fonts.medium,
      marginBottom: 8,
    },
    reportPicker: {
      borderWidth: 1,
      borderRadius: 12,
      marginBottom: 16,
      padding: 12,
    },
    reportTextArea: {
      borderWidth: 1,
      borderRadius: 12,
      padding: 12,
      minHeight: 100,
      textAlignVertical: 'top',
      fontSize: 15,
      fontFamily: fonts.regular,
    },
    reportSubmitButton: {
      marginTop: 20,
      paddingVertical: 14,
      borderRadius: 99,
      alignItems: 'center',
    },
    reportSubmitText: {
      fontSize: 16,
      fontFamily: fonts.semiBold,
    },
    // Delete confirm modal
    deleteModalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    deleteModalContent: {
      borderRadius: 24,
      padding: 24,
      width: '100%',
      maxWidth: 340,
      alignItems: 'center',
    },
    deleteModalIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: '#FEE2E2',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 16,
    },
    deleteModalTitle: {
      fontSize: 18,
      fontFamily: fonts.semiBold,
      marginBottom: 8,
      textAlign: 'center',
    },
    deleteModalDesc: {
      fontSize: 15,
      fontFamily: fonts.regular,
      textAlign: 'center',
      marginBottom: 24,
      opacity: 0.6,
    },
    deleteModalButtons: {
      flexDirection: 'row',
      gap: 12,
      width: '100%',
    },
    deleteModalButton: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 99,
      alignItems: 'center',
    },
    reasonOption: {
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 8,
      marginBottom: 8,
      borderWidth: 1,
    },
  }), [fonts]);

  const renderRightActions = (progress: Animated.AnimatedInterpolation<number>, dragX: Animated.AnimatedInterpolation<number>) => {
    // Elastic animation - button comes from right
    const trans = dragX.interpolate({
      inputRange: [-70, 0],
      outputRange: [0, 70],
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
          style={[styles.actionButton, { backgroundColor: colors.border, width: 70 }]}
          onPress={() => {
            // Measure button position and show modal below it
            moreButtonRef.current?.measureInWindow((x, y, width, height) => {
              setModalPosition({ x: x - 200, y: y + height + 8 });
              swipeableRef.current?.close();
              setShowModal(true);
            });
          }}
        >
          <View ref={moreButtonRef} collapsable={false}>
            <MoreVertical size={24} color={colors.text} />
          </View>
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
        <Pressable
          onLongPress={handleLongPress}
          delayLongPress={500}
          disabled={isSwiping}
        >
          <View pointerEvents={isSwiping ? 'none' : 'auto'}>
            {children}
          </View>
        </Pressable>
      </Swipeable>

      {/* More Options Modal */}
      <Modal
        visible={showModal}
        transparent
        animationType="fade"
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
                minWidth: 200,
                position: 'absolute',
                top: modalPosition.y,
                right: 16,
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
              <CheckCheck size={20} color={colors.text} />
              <Text style={[styles.modalOptionText, { color: colors.text }]}>Mark as Read</Text>
            </TouchableOpacity>

            <View style={[styles.modalDivider, { backgroundColor: colors.border }]} />

            <TouchableOpacity
              style={styles.modalOption}
              onPress={() => {
                setShowModal(false);
                swipeableRef.current?.close();
                setShowReportModal(true);
              }}
            >
              <Flag size={20} color={colors.text} />
              <Text style={[styles.modalOptionText, { color: colors.text }]}>Report</Text>
            </TouchableOpacity>

            <View style={[styles.modalDivider, { backgroundColor: colors.border }]} />

            <TouchableOpacity
              style={styles.modalOption}
              onPress={() => {
                setShowModal(false);
                swipeableRef.current?.close();
                setShowDeleteConfirm(true);
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
                    onDelete();
                  }}
                >
                  <Text style={[styles.modalOptionText, { color: '#FF3B30' }]}>Leave Chat</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={showDeleteConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteConfirm(false)}
      >
        <View style={styles.deleteModalOverlay}>
          <View style={[styles.deleteModalContent, { backgroundColor: colors.card }]}>
            <View style={styles.deleteModalIcon}>
              <Trash2 size={24} color="#DC2626" />
            </View>
            <Text style={[styles.deleteModalTitle, { color: colors.text }]}>Delete Conversation</Text>
            <Text style={[styles.deleteModalDesc, { color: colors.text }]}>
              Are you sure you want to delete this conversation{chatName ? ` with ${chatName}` : ''}? This action cannot be undone.
            </Text>
            <View style={styles.deleteModalButtons}>
              <TouchableOpacity
                style={[styles.deleteModalButton, { backgroundColor: colors.border }]}
                onPress={() => setShowDeleteConfirm(false)}
              >
                <Text style={[styles.reportSubmitText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.deleteModalButton, { backgroundColor: '#DC2626' }]}
                onPress={handleDeleteConfirm}
              >
                <Text style={[styles.reportSubmitText, { color: '#FFFFFF' }]}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Report Modal */}
      <Modal
        visible={showReportModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowReportModal(false)}
      >
        <View style={styles.reportModalOverlay}>
          <View style={[styles.reportModalContent, { backgroundColor: colors.card }]}>
            {/* Header */}
            <View style={[styles.reportModalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.reportModalTitle, { color: colors.text }]}>Report Conversation</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowReportModal(false);
                  setReportReason('');
                  setReportDescription('');
                }}
              >
                <X size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            {/* Body */}
            <View style={styles.reportModalBody}>
              <Text style={[styles.reportLabel, { color: colors.text }]}>Reason for report *</Text>

              {/* Reason Options */}
              {[
                { value: 'spam', label: 'Spam or scam' },
                { value: 'harassment', label: 'Harassment or bullying' },
                { value: 'inappropriate', label: 'Inappropriate content' },
                { value: 'fraud', label: 'Fraud or fake listings' },
                { value: 'other', label: 'Other' },
              ].map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.reasonOption,
                    {
                      borderColor: reportReason === option.value ? colors.text : colors.border,
                      backgroundColor: reportReason === option.value ? `${colors.text}10` : 'transparent',
                    }
                  ]}
                  onPress={() => setReportReason(option.value)}
                >
                  <Text style={[styles.modalOptionText, { color: colors.text }]}>{option.label}</Text>
                </TouchableOpacity>
              ))}

              <Text style={[styles.reportLabel, { color: colors.text, marginTop: 16 }]}>Additional details (optional)</Text>
              <TextInput
                style={[styles.reportTextArea, { borderColor: colors.border, color: colors.text }]}
                value={reportDescription}
                onChangeText={setReportDescription}
                placeholder="Provide more context about your report..."
                placeholderTextColor={`${colors.text}50`}
                multiline
                numberOfLines={4}
              />

              <TouchableOpacity
                style={[
                  styles.reportSubmitButton,
                  { backgroundColor: reportReason ? colors.text : colors.border }
                ]}
                onPress={handleReport}
                disabled={!reportReason || isSubmittingReport}
              >
                <Text style={[styles.reportSubmitText, { color: reportReason ? colors.card : colors.text }]}>
                  {isSubmittingReport ? 'Submitting...' : 'Submit Report'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}
