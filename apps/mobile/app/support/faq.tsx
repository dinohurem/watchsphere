import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useState } from 'react';
import Svg, { Path } from 'react-native-svg';
import { wp, hp, sp, fp } from '@/utils/responsive';
import { useTranslation } from 'react-i18next';

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
  questionKey: string;
  answerKey: string;
}

const faqData: FAQItem[] = [
  {
    questionKey: 'faq.whatIsWatchSphere',
    answerKey: 'faq.whatIsWatchSphereAnswer',
  },
  {
    questionKey: 'faq.howToAddWatchlist',
    answerKey: 'faq.howToAddWatchlistAnswer',
  },
  {
    questionKey: 'faq.howBuySellWorks',
    answerKey: 'faq.howBuySellWorksAnswer',
  },
  {
    questionKey: 'faq.howToContact',
    answerKey: 'faq.howToContactAnswer',
  },
  {
    questionKey: 'faq.howPricingWorks',
    answerKey: 'faq.howPricingWorksAnswer',
  },
  {
    questionKey: 'faq.howToFileDispute',
    answerKey: 'faq.howToFileDisputeAnswer',
  },
  {
    questionKey: 'faq.howToUpdateProfile',
    answerKey: 'faq.howToUpdateProfileAnswer',
  },
  {
    questionKey: 'faq.isDataSecure',
    answerKey: 'faq.isDataSecureAnswer',
  },
  {
    questionKey: 'faq.howToReportBug',
    answerKey: 'faq.howToReportBugAnswer',
  },
  {
    questionKey: 'faq.canDeleteAccount',
    answerKey: 'faq.canDeleteAccountAnswer',
  },
];

interface FAQAccordionProps {
  item: FAQItem;
  isOpen: boolean;
  onToggle: () => void;
}

function FAQAccordion({ item, isOpen, onToggle }: FAQAccordionProps) {
  const { t } = useTranslation();
  return (
    <View style={styles.accordionContainer}>
      <TouchableOpacity
        style={styles.accordionHeader}
        onPress={onToggle}
        activeOpacity={0.7}
      >
        <Text style={styles.accordionQuestion}>{t(item.questionKey)}</Text>
        <ChevronDownIcon isOpen={isOpen} />
      </TouchableOpacity>
      {isOpen && (
        <View style={styles.accordionContent}>
          <Text style={styles.accordionAnswer}>{t(item.answerKey)}</Text>
        </View>
      )}
    </View>
  );
}

export default function FAQScreen() {
  const { t } = useTranslation();
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
        <Text style={styles.headerTitle}>{t('support.faq')}</Text>
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
          <Text style={styles.title}>{t('support.frequentlyAskedQuestions')}</Text>
          <Text style={styles.subtitle}>
            {t('support.faqDescription')}
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
