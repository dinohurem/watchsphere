import { View, StyleSheet } from 'react-native';
import { LogoIcon } from './LogoIcon';
import { sp } from '@/utils/responsive';

interface ImagePlaceholderProps {
  size?: number;
  width?: number;
  height?: number;
  iconSize?: number;
  borderRadius?: number;
  backgroundColor?: string;
}

export function ImagePlaceholder({
  size,
  width = 100,
  height = 100,
  iconSize,
  borderRadius = 8,
  backgroundColor = '#F5F5F5',
}: ImagePlaceholderProps) {
  const containerWidth = size ?? width;
  const containerHeight = size ?? height;
  // Icon size is 40% of the smaller dimension by default
  const calculatedIconSize = iconSize ?? Math.min(containerWidth, containerHeight) * 0.4;

  return (
    <View
      style={[
        styles.container,
        {
          width: containerWidth,
          height: containerHeight,
          borderRadius: sp(borderRadius),
          backgroundColor,
        },
      ]}
    >
      <LogoIcon size={calculatedIconSize} color="rgba(33, 33, 33, 0.15)" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
