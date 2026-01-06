interface ImagePlaceholderProps {
  size?: number;
  width?: number;
  height?: number;
  iconSize?: number;
  borderRadius?: number;
  className?: string;
}

// WatchSphere logo SVG paths
function LogoIcon({ size = 33, color = 'rgba(33, 33, 33, 0.15)' }: { size?: number; color?: string }) {
  const height = size * (28 / 33);
  return (
    <svg width={size} height={height} viewBox="0 0 33 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M20.2778 12.5788H24.117L24.9701 7.85871H27.1054L26.2523 12.5788H27.1117C30.0961 12.5789 32.5159 14.9888 32.5159 17.9612C32.5158 20.9336 30.0961 23.3436 27.1117 23.3437H24.307L23.6008 27.2514H20.794L20.0878 23.3437H13.1136L12.4074 27.2514H9.6005L8.8943 23.3437H0.121422V21.2496H22.5502L23.7386 14.6726H20.6562L21.5093 19.3933H19.3734L17.2888 7.85871H19.4247L20.2778 12.5788ZM24.6854 21.2496H27.1117C28.9352 21.2495 30.4139 19.7775 30.414 17.9612C30.414 16.145 28.9353 14.6727 27.1117 14.6726H25.8738L24.6854 21.2496Z"
        fill={color}
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M7.51683 3.90774H14.491L15.1972 0H18.0041L18.7103 3.90774H25.6845L26.3907 0H28.5259L27.8197 3.90774H32.5159V6.00181H7.89525L9.0843 12.5788H12.9236L13.7767 7.85871H15.9125L13.8279 19.3933H11.692L12.5451 14.6726H9.46272L10.3158 19.3933H8.17993L7.32683 14.6726H5.40358C2.41918 14.6724 0 12.2626 0 9.29016C3.94128e-05 6.32509 2.4073 3.91967 5.38156 3.90774L4.67537 0H6.81063L7.51683 3.90774ZM5.75999 6.00181C3.84278 6.00182 2.10164 7.22546 2.1016 9.29016C2.1016 11.1064 3.58002 12.5787 5.40358 12.5788H6.94841L5.75999 6.00181Z"
        fill={color}
      />
    </svg>
  );
}

export function ImagePlaceholder({
  size,
  width = 100,
  height = 100,
  iconSize,
  borderRadius = 8,
  className = '',
}: ImagePlaceholderProps) {
  const containerWidth = size ?? width;
  const containerHeight = size ?? height;
  // Icon size is 40% of the smaller dimension by default
  const calculatedIconSize = iconSize ?? Math.min(containerWidth, containerHeight) * 0.4;

  return (
    <div
      className={`flex items-center justify-center bg-gray-100 ${className}`}
      style={{
        width: containerWidth,
        height: containerHeight,
        borderRadius: borderRadius,
      }}
    >
      <LogoIcon size={calculatedIconSize} />
    </div>
  );
}
