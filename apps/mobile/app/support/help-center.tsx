import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Svg, { Path, Circle } from 'react-native-svg';
import { wp, hp, sp, fp } from '@/utils/responsive';
import { useGuide } from '@/contexts/GuideContext';
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

// Chevron Right Icon
function ChevronRightIcon() {
  return (
    <Svg width={sp(8)} height={sp(14)} viewBox="0 0 8 14" fill="none">
      <Path
        d="M1 1L7 7L1 13"
        stroke="rgba(60,60,67,0.3)"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// Book Open Icon for FAQ
function BookOpenIcon() {
  return (
    <Svg width={sp(24)} height={sp(24)} viewBox="0 0 24 24" fill="none">
      <Path
        d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"
        stroke="#1D1D1F"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"
        stroke="#1D1D1F"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// Play Circle Icon for Demo
function PlayCircleIcon() {
  return (
    <Svg width={sp(24)} height={sp(24)} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={10} stroke="#1D1D1F" strokeWidth={1.5} />
      <Path
        d="M10 8l6 4-6 4V8z"
        stroke="#1D1D1F"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

interface HelpItemProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  onPress: () => void;
}

function HelpItem({ title, description, icon, onPress }: HelpItemProps) {
  return (
    <TouchableOpacity
      style={styles.helpItem}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.helpItemLeft}>
        <View style={styles.helpItemIcon}>{icon}</View>
        <View style={styles.helpItemContent}>
          <Text style={styles.helpItemTitle}>{title}</Text>
          <Text style={styles.helpItemDescription}>{description}</Text>
        </View>
      </View>
      <ChevronRightIcon />
    </TouchableOpacity>
  );
}

export default function HelpCenterScreen() {
  const { startGuide } = useGuide();
  const { t } = useTranslation();

  const handleDemo = () => {
    // Navigate to home first, then start the guide
    router.replace('/(tabs)');
    setTimeout(() => {
      startGuide();
    }, 500);
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
      </View>

      {/* Content */}
      <View style={styles.content}>
        {/* Title */}
        <View style={styles.titleSection}>
          <Text style={styles.title}>{t('support.helpCenter')}</Text>
          <Text style={styles.subtitle}>
            {t('support.helpCenterSubtitle')}
          </Text>
        </View>

        {/* Help Items */}
        <View style={styles.helpList}>
          <HelpItem
            title={t('support.faq')}
            description={t('support.faqSubtitle')}
            icon={<BookOpenIcon />}
            onPress={() => router.push('/support/faq' as any)}
          />
          <HelpItem
            title={t('support.demo')}
            description={t('support.demoSubtitle')}
            icon={<PlayCircleIcon />}
            onPress={handleDemo}
          />
        </View>
      </View>
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
  content: {
    flex: 1,
    paddingHorizontal: wp(16),
    paddingVertical: hp(20),
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
  helpList: {
    gap: hp(12),
  },
  helpItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FAFAFA',
    borderRadius: sp(16),
    paddingHorizontal: wp(16),
    paddingVertical: hp(16),
  },
  helpItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(12),
    flex: 1,
  },
  helpItemIcon: {
    width: sp(44),
    height: sp(44),
    borderRadius: sp(12),
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  helpItemContent: {
    flex: 1,
  },
  helpItemTitle: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: fp(15),
    fontWeight: '600',
    color: '#1D1D1F',
    lineHeight: fp(20),
  },
  helpItemDescription: {
    fontFamily: 'HankenGrotesk_400Regular',
    fontSize: fp(13),
    color: '#666666',
    lineHeight: fp(18),
    marginTop: hp(2),
  },
});
