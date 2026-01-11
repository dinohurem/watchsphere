import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useState } from 'react';
import Svg, { Path } from 'react-native-svg';
import { wp, hp, sp, fp } from '@/utils/responsive';

// Back Arrow Icon (Chevron Left)
function ChevronLeftIcon() {
  return (
    <Svg width={sp(24)} height={sp(24)} viewBox="0 0 24 24" fill="none">
      <Path
        d="M15 18L9 12L15 6"
        stroke="#1D1D1F"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// Chevron Down Icon
function ChevronDownIcon({ isOpen }: { isOpen: boolean }) {
  return (
    <Svg
      width={sp(20)}
      height={sp(20)}
      viewBox="0 0 24 24"
      fill="none"
      style={{ transform: [{ rotate: isOpen ? '180deg' : '0deg' }] }}
    >
      <Path
        d="M6 9l6 6 6-6"
        stroke="#1D1D1F"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

interface FAQItem {
  question: string;
  answer: string;
}

const faqData: FAQItem[] = [
  {
    question: 'What is WatchSphere?',
    answer: 'WatchSphere is a comprehensive platform for watch collectors and dealers. It provides market data, price tracking, social features, and a marketplace for buying and selling luxury watches.',
  },
  {
    question: 'How do I add watches to my watchlist?',
    answer: 'You can add watches to your watchlist by navigating to the Market section, finding a watch you\'re interested in, and tapping the heart icon. You can also set price alerts to be notified when a watch reaches your target price.',
  },
  {
    question: 'How do buy and sell orders work?',
    answer: 'Buy orders let you post what watches you\'re looking to purchase along with your target price. Sell orders let you list watches you want to sell. Other users can browse these orders and reach out to you through the app\'s messaging feature.',
  },
  {
    question: 'How do I contact a seller or buyer?',
    answer: 'When viewing a buy or sell order, you\'ll see options to contact the user via the in-app chat, WhatsApp, or Telegram (depending on what contact methods they\'ve provided in their profile).',
  },
  {
    question: 'How is watch pricing data collected?',
    answer: 'Our pricing data is aggregated from multiple sources including authorized dealers, secondary market platforms, and auction results. We update prices regularly to provide the most accurate market information.',
  },
  {
    question: 'What should I do if I have a dispute with another user?',
    answer: 'If you have a dispute regarding a transaction, you can file a dispute through the Support section of the app. Go to Settings > Support > Disputes to create a new dispute. Our team will review and assist in resolving the issue.',
  },
  {
    question: 'How do I update my profile information?',
    answer: 'Go to Settings > Profile Settings to update your name, contact information, and profile photo. You can also add your WhatsApp and Telegram information so other users can contact you easily.',
  },
  {
    question: 'Is my data secure?',
    answer: 'Yes, we take data security seriously. All communications are encrypted, and we never share your personal information with third parties without your consent. You can review our Privacy Policy for more details.',
  },
  {
    question: 'How do I report a bug or issue?',
    answer: 'You can report issues through Settings > Support > Report an Issue. Please provide as much detail as possible about the problem you encountered, and our team will investigate and work on a fix.',
  },
  {
    question: 'Can I delete my account?',
    answer: 'Yes, you can deactivate your account through Settings > Account Details > Delete Account. This will deactivate your account and you will no longer be able to log in. Your data will be retained for a period as required by law.',
  },
];

interface FAQAccordionProps {
  item: FAQItem;
  isOpen: boolean;
  onToggle: () => void;
}

function FAQAccordion({ item, isOpen, onToggle }: FAQAccordionProps) {
  return (
    <View style={styles.accordionContainer}>
      <TouchableOpacity
        style={styles.accordionHeader}
        onPress={onToggle}
        activeOpacity={0.7}
      >
        <Text style={styles.accordionQuestion}>{item.question}</Text>
        <ChevronDownIcon isOpen={isOpen} />
      </TouchableOpacity>
      {isOpen && (
        <View style={styles.accordionContent}>
          <Text style={styles.accordionAnswer}>{item.answer}</Text>
        </View>
      )}
    </View>
  );
}

export default function FAQScreen() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggleAccordion = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <ChevronLeftIcon />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>FAQ</Text>
        <View style={styles.headerButton} />
      </View>

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Title */}
        <View style={styles.titleSection}>
          <Text style={styles.title}>Frequently Asked Questions</Text>
          <Text style={styles.subtitle}>
            Find answers to common questions about WatchSphere
          </Text>
        </View>

        {/* FAQ List */}
        <View style={styles.faqList}>
          {faqData.map((item, index) => (
            <FAQAccordion
              key={index}
              item={item}
              isOpen={openIndex === index}
              onToggle={() => toggleAccordion(index)}
            />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: hp(44),
    paddingHorizontal: wp(8),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(33, 33, 33, 0.05)',
  },
  headerButton: {
    width: sp(44),
    height: sp(44),
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: fp(17),
    fontWeight: '600',
    color: '#1D1D1F',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: wp(16),
    paddingVertical: hp(20),
    paddingBottom: hp(40),
  },
  titleSection: {
    marginBottom: hp(24),
  },
  title: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: fp(24),
    fontWeight: '600',
    color: '#1D1D1F',
    lineHeight: fp(31),
  },
  subtitle: {
    fontFamily: 'HankenGrotesk_400Regular',
    fontSize: fp(15),
    color: '#666666',
    marginTop: hp(8),
    lineHeight: fp(20),
  },
  faqList: {
    gap: hp(8),
  },
  accordionContainer: {
    backgroundColor: '#FAFAFA',
    borderRadius: sp(16),
    overflow: 'hidden',
  },
  accordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: wp(16),
    paddingVertical: hp(16),
  },
  accordionQuestion: {
    flex: 1,
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: fp(15),
    fontWeight: '600',
    color: '#1D1D1F',
    lineHeight: fp(20),
    paddingRight: wp(12),
  },
  accordionContent: {
    paddingHorizontal: wp(16),
    paddingBottom: hp(16),
    paddingTop: hp(0),
  },
  accordionAnswer: {
    fontFamily: 'HankenGrotesk_400Regular',
    fontSize: fp(14),
    color: '#666666',
    lineHeight: fp(22),
  },
});
