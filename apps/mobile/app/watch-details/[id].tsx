import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { BackArrow } from '@/components/icons';

// Mock data for watch details
const mockWatchDetails = {
  brand: 'Rolex',
  model: 'Submariner Date',
  reference: '126610LN',
  condition: 'New Unworn 41mm',
  price: '€12,352',
  addedTime: 'Added 20 hrs ago',
  quickInfo: {
    condition: 'Used (very good)',
    caseSize: '45mm',
    boxPapers: 'Original box and papers',
    location: 'Switzerland',
  },
  basicInfo: {
    brand: 'Rolex',
    model: 'Submariner Date',
    reference: '126610LN',
    year: '2024',
    size: '41mm',
    movement: 'Automatic',
    caseMaterial: 'Steel',
    braceletMaterial: 'Steel',
    condition: 'Used (Very Good)',
    conditionDescription: 'The item shows visible and tangible signs of wear like scratches, scuffs, or small dents. The bracelet or strap may be significantly stretched. Markings and engravings may be worn but are still visible. The item may have been professionally polished.',
    boxPapers: 'Original box and papers',
    gender: "Men's watch",
    location: 'Switzerland',
    price: '€12,352',
    availability: 'Item is in stock',
  },
  caliber: {
    movement: 'Automatic',
    caliberMovement: '3235',
    baseCaliber: '3235',
    powerReserve: '70h',
    numberOfJewels: '31',
  },
  case: {
    caseMaterial: 'Steel',
    caseDiameter: '41 x 40 mm',
    waterResistance: '30 ATM',
    bezelMaterial: 'Ceramic',
    crystal: 'Sapphire crystal',
    dial: 'Black',
    dialNumerals: 'No numerals',
  },
  bracelet: {
    braceletMaterial: 'Steel',
    braceletColor: 'Steel',
    clasp: 'Fold clasp',
    claspMaterial: 'Steel',
  },
  other: {
    moreDetails: 'Luminous hands, Chronometer, Rotating Bezel, Screw-Down Crown, Luminous indices',
  },
};

export default function WatchDetailsScreen() {
  const { colors, fonts } = useTheme();
  const { t } = useTranslation();
  const { id } = useLocalSearchParams();

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#FFFFFF',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 12,
    },
    headerButton: {
      padding: 8,
    },
    scrollView: {
      flex: 1,
    },
    imageContainer: {
      width: '100%',
      height: 280,
      backgroundColor: colors.backgroundSecondary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    topSection: {
      gap: 24,
      paddingHorizontal: 16,
      paddingTop: 24,
      paddingBottom: 0,
    },
    headerInfo: {
      gap: 12,
    },
    titleSection: {
      gap: 0,
    },
    title: {
      fontSize: 20,
      fontFamily: fonts.semiBold,
      color: '#1D1D1F',
      lineHeight: 26,
    },
    subtitle: {
      fontSize: 15,
      fontFamily: fonts.medium,
      color: '#212121',
      opacity: 0.5,
      lineHeight: 20,
      letterSpacing: 0.075,
    },
    priceSection: {
      gap: 4,
    },
    price: {
      fontSize: 20,
      fontFamily: fonts.semiBold,
      color: '#1D1D1F',
      lineHeight: 26,
    },
    addedTime: {
      fontSize: 13,
      fontFamily: fonts.regular,
      color: '#1D1D1F',
      opacity: 0.5,
      lineHeight: 16.9,
    },
    quickInfoSection: {
      gap: 0,
    },
    quickInfoRow: {
      flexDirection: 'row',
      paddingVertical: 8,
    },
    quickInfoLabel: {
      width: 128,
      fontSize: 15,
      fontFamily: fonts.medium,
      color: '#212121',
      opacity: 0.5,
      lineHeight: 20,
      letterSpacing: 0.075,
    },
    quickInfoValue: {
      flex: 1,
      fontSize: 13,
      fontFamily: fonts.semiBold,
      color: '#212121',
      lineHeight: 18,
      letterSpacing: 0.065,
    },
    actionButtons: {
      flexDirection: 'row',
      gap: 12,
      paddingVertical: 0,
    },
    buyButton: {
      flex: 1,
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: 12,
      backgroundColor: '#212121',
      alignItems: 'center',
      justifyContent: 'center',
    },
    buyButtonText: {
      fontSize: 15,
      fontFamily: fonts.semiBold,
      color: '#FFFFFF',
      lineHeight: 20,
      letterSpacing: 0.075,
    },
    offerButton: {
      flex: 1,
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: 12,
      backgroundColor: '#FFFFFF',
      borderWidth: 1,
      borderColor: '#212121',
      alignItems: 'center',
      justifyContent: 'center',
    },
    offerButtonText: {
      fontSize: 15,
      fontFamily: fonts.semiBold,
      color: '#212121',
      lineHeight: 20,
      letterSpacing: 0.075,
    },
    detailsContainer: {
      gap: 24,
      paddingHorizontal: 16,
      paddingTop: 26,
    },
    section: {
      gap: 0,
    },
    sectionHeader: {
      flexDirection: 'row',
      paddingVertical: 16,
    },
    sectionTitle: {
      fontSize: 18,
      fontFamily: fonts.semiBold,
      color: '#212121',
      lineHeight: 20,
      letterSpacing: 0.09,
    },
    infoRow: {
      flexDirection: 'row',
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(0, 0, 0, 0.1)',
    },
    infoLabel: {
      width: 168,
      fontSize: 15,
      fontFamily: fonts.medium,
      color: '#212121',
      opacity: 0.5,
      lineHeight: 20,
      letterSpacing: 0.075,
    },
    infoValue: {
      flex: 1,
      fontSize: 13,
      fontFamily: fonts.semiBold,
      color: '#212121',
      lineHeight: 18,
      letterSpacing: 0.065,
    },
    conditionContainer: {
      gap: 8,
    },
    conditionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    conditionDescription: {
      fontSize: 13,
      fontFamily: fonts.medium,
      color: '#212121',
      lineHeight: 18,
      letterSpacing: 0.065,
    },
    placeholderImage: {
      width: 200,
      height: 200,
      resizeMode: 'contain',
    },
  });

  const renderInfoRow = (label: string, value: string, isLast?: boolean) => (
    <View style={[styles.infoRow, isLast && { borderBottomWidth: 0 }]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );

  const renderConditionRow = () => (
    <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
      <Text style={styles.infoLabel}>Condition</Text>
      <View style={styles.conditionContainer}>
        <View style={styles.conditionHeader}>
          <Text style={styles.infoValue}>{mockWatchDetails.basicInfo.condition}</Text>
        </View>
        <Text style={styles.conditionDescription}>
          {mockWatchDetails.basicInfo.conditionDescription}
        </Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
          <BackArrow size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Watch Image */}
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: 'https://placehold.co/400x400/f5f5f5/212121?text=Watch+Image' }}
            style={styles.placeholderImage}
          />
        </View>

        {/* Top Section */}
        <View style={styles.topSection}>
          {/* Header Info */}
          <View style={styles.headerInfo}>
            <View style={styles.titleSection}>
              <Text style={styles.title}>
                {mockWatchDetails.brand} {mockWatchDetails.model}
              </Text>
              <Text style={styles.subtitle}>
                {mockWatchDetails.reference}, {mockWatchDetails.condition}
              </Text>
            </View>

            <View style={styles.priceSection}>
              <Text style={styles.price}>{mockWatchDetails.price}</Text>
              <Text style={styles.addedTime}>{mockWatchDetails.addedTime}</Text>
            </View>
          </View>

          {/* Quick Info */}
          <View style={styles.quickInfoSection}>
            <View style={styles.quickInfoRow}>
              <Text style={styles.quickInfoLabel}>{t('watchDetails.condition')}</Text>
              <Text style={styles.quickInfoValue}>{mockWatchDetails.quickInfo.condition}</Text>
            </View>
            <View style={styles.quickInfoRow}>
              <Text style={styles.quickInfoLabel}>{t('watchDetails.caseSize')}</Text>
              <Text style={styles.quickInfoValue}>{mockWatchDetails.quickInfo.caseSize}</Text>
            </View>
            <View style={styles.quickInfoRow}>
              <Text style={styles.quickInfoLabel}>{t('watchDetails.boxPapers')}</Text>
              <Text style={styles.quickInfoValue}>{mockWatchDetails.quickInfo.boxPapers}</Text>
            </View>
            <View style={styles.quickInfoRow}>
              <Text style={styles.quickInfoLabel}>{t('watchDetails.location')}</Text>
              <Text style={styles.quickInfoValue}>{mockWatchDetails.quickInfo.location}</Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity style={styles.buyButton}>
              <Text style={styles.buyButtonText}>{t('watchDetails.buyNow')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.offerButton}>
              <Text style={styles.offerButtonText}>{t('watchDetails.makeOffer')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Details Container */}
        <View style={styles.detailsContainer}>
          {/* Basic Info Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t('watchDetails.basicInfo')}</Text>
            </View>
            {renderInfoRow(t('watchDetails.brand'), mockWatchDetails.basicInfo.brand)}
            {renderInfoRow(t('watchDetails.model'), mockWatchDetails.basicInfo.model)}
            {renderInfoRow(t('watchDetails.reference'), mockWatchDetails.basicInfo.reference)}
            {renderInfoRow(t('watchDetails.year'), mockWatchDetails.basicInfo.year)}
            {renderInfoRow(t('watchDetails.size'), mockWatchDetails.basicInfo.size)}
            {renderInfoRow(t('watchDetails.movement'), mockWatchDetails.basicInfo.movement)}
            {renderInfoRow(t('watchDetails.caseMaterial'), mockWatchDetails.basicInfo.caseMaterial)}
            {renderInfoRow(t('watchDetails.braceletMaterial'), mockWatchDetails.basicInfo.braceletMaterial)}
            {renderConditionRow()}
            {renderInfoRow(t('watchDetails.boxAndPapers'), mockWatchDetails.basicInfo.boxPapers)}
            {renderInfoRow(t('watchDetails.gender'), mockWatchDetails.basicInfo.gender)}
            {renderInfoRow(t('watchDetails.location'), mockWatchDetails.basicInfo.location)}
            {renderInfoRow(t('watchDetails.price'), mockWatchDetails.basicInfo.price)}
            {renderInfoRow(t('watchDetails.availability'), mockWatchDetails.basicInfo.availability, true)}
          </View>

          {/* Caliber Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t('watchDetails.caliber')}</Text>
            </View>
            {renderInfoRow(t('watchDetails.movement'), mockWatchDetails.caliber.movement)}
            {renderInfoRow(t('watchDetails.calibreMovement'), mockWatchDetails.caliber.caliberMovement)}
            {renderInfoRow(t('watchDetails.baseCaliber'), mockWatchDetails.caliber.baseCaliber)}
            {renderInfoRow(t('watchDetails.powerReserve'), mockWatchDetails.caliber.powerReserve)}
            {renderInfoRow(t('watchDetails.numberOfJewels'), mockWatchDetails.caliber.numberOfJewels, true)}
          </View>

          {/* Case Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t('watchDetails.case')}</Text>
            </View>
            {renderInfoRow(t('watchDetails.caseMaterial'), mockWatchDetails.case.caseMaterial)}
            {renderInfoRow(t('watchDetails.caseDiameter'), mockWatchDetails.case.caseDiameter)}
            {renderInfoRow(t('watchDetails.waterResistance'), mockWatchDetails.case.waterResistance)}
            {renderInfoRow(t('watchDetails.bezelMaterial'), mockWatchDetails.case.bezelMaterial)}
            {renderInfoRow(t('watchDetails.crystal'), mockWatchDetails.case.crystal)}
            {renderInfoRow(t('watchDetails.dial'), mockWatchDetails.case.dial)}
            {renderInfoRow(t('watchDetails.dialNumerals'), mockWatchDetails.case.dialNumerals, true)}
          </View>

          {/* Bracelet/strap Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t('watchDetails.braceletStrap')}</Text>
            </View>
            {renderInfoRow(t('watchDetails.braceletMaterial'), mockWatchDetails.bracelet.braceletMaterial)}
            {renderInfoRow(t('watchDetails.braceletColor'), mockWatchDetails.bracelet.braceletColor)}
            {renderInfoRow(t('watchDetails.clasp'), mockWatchDetails.bracelet.clasp)}
            {renderInfoRow(t('watchDetails.claspMaterial'), mockWatchDetails.bracelet.claspMaterial, true)}
          </View>

          {/* Other Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t('watchDetails.other')}</Text>
            </View>
            <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
              <Text style={styles.infoLabel}>{t('watchDetails.moreDetails')}</Text>
              <Text style={styles.infoValue}>{mockWatchDetails.other.moreDetails}</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
