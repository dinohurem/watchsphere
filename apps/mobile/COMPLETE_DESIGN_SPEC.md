# WatchSphere Mobile - Complete Design Specification

*Based on actual Figma designs - Analyzed from screenshots*

## Color Palette

### Primary Colors
```typescript
primary: '#000000',        // Black - Primary buttons, active pills
primaryText: '#000000',    // Black - Main text, titles
```

### Secondary Colors
```typescript
secondary: '#F5F5F5',      // Light gray - Inactive pills, backgrounds
surface: '#FFFFFF',         // White - Cards, backgrounds
surfaceVariant: '#F9F9F9', // Very light gray - Subtle backgrounds
```

### Text Colors
```typescript
textPrimary: '#000000',    // Black - Headlines, prices
textSecondary: '#8E8E93',  // Gray - Subtitles, model numbers, labels
textTertiary: '#C7C7CC',   // Light gray - Placeholder text
```

### Status Colors
```typescript
success: '#34C759',        // Green - Positive price changes (▲)
error: '#FF3B30',         // Red/Coral - Negative price changes (▼)
```

### Interactive Colors
```typescript
activeTab: '#007AFF',      // Blue - Active bottom nav icon (Market)
inactiveTab: '#8E8E93',   // Gray - Inactive bottom nav icons
```

### Border & Divider
```typescript
border: '#E5E5EA',        // Light gray borders
divider: '#F2F2F7',       // Very light gray dividers (table rows)
```

## Typography

### Font Family
- **Primary**: SF Pro Display / SF Pro Text (iOS System Font)
- **Android Alternative**: Roboto

### Font Sizes & Weights

```typescript
// Headings
h1: {
  fontSize: 24,
  fontWeight: '600', // Semi-bold
  lineHeight: 32,
}

h2: {
  fontSize: 20,
  fontWeight: '600',
  lineHeight: 26,
}

// Watch Titles
watchTitle: {
  fontSize: 16,
  fontWeight: '400', // Regular
  lineHeight: 22,
  color: '#000000',
}

watchSubtitle: {
  fontSize: 14,
  fontWeight: '400',
  lineHeight: 19,
  color: '#8E8E93',
}

// Prices
priceLarge: {
  fontSize: 18,
  fontWeight: '600',
  lineHeight: 24,
  color: '#000000',
}

priceMedium: {
  fontSize: 16,
  fontWeight: '600',
  lineHeight: 21,
  color: '#000000',
}

// Body Text
body: {
  fontSize: 15,
  fontWeight: '400',
  lineHeight: 21,
  color: '#000000',
}

// Labels
label: {
  fontSize: 14,
  fontWeight: '400',
  lineHeight: 19,
  color: '#8E8E93',
}

// Small Text (percentages, dates)
small: {
  fontSize: 13,
  fontWeight: '400',
  lineHeight: 18,
  color: '#8E8E93',
}

// Tab Labels
tab: {
  fontSize: 11,
  fontWeight: '500',
  lineHeight: 14,
}
```

## Spacing System

```typescript
spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
}

// Semantic Spacing
screenPadding: 16,      // Left/right screen margins
cardPadding: 16,        // Inside cards
listItemPadding: 16,    // Horizontal list item padding
listItemSpacing: 12,    // Vertical space between list items
sectionSpacing: 24,     // Space between sections
```

## Border Radius

```typescript
radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 100,  // For fully rounded pills
}

// Component-specific
searchBar: 12,
filterPill: 20,  // Fully rounded
button: 12,
card: 16,
image: 12,
modal: 24,       // Top corners of bottom sheets
input: 8,
```

## Component Specifications

### 1. Search Bar
```typescript
{
  height: 48,
  backgroundColor: '#F5F5F5',
  borderRadius: 12,
  paddingHorizontal: 16,
  placeholder: {
    text: 'Search watches...',
    color: '#8E8E93',
    fontSize: 15,
  },
  fontSize: 15,
  color: '#000000',
}
```

### 2. Filter Pills
```typescript
// Inactive Pill
{
  backgroundColor: '#F5F5F5',
  paddingVertical: 10,
  paddingHorizontal: 20,
  borderRadius: 20,
  text: {
    fontSize: 15,
    fontWeight: '500',
    color: '#000000',
  }
}

// Active Pill
{
  backgroundColor: '#000000',
  paddingVertical: 10,
  paddingHorizontal: 20,
  borderRadius: 20,
  text: {
    fontSize: 15,
    fontWeight: '500',
    color: '#FFFFFF',
  }
}

// Filter Icon Button
{
  width: 48,
  height: 48,
  backgroundColor: '#F5F5F5',
  borderRadius: 12,
  icon: {
    size: 20,
    color: '#000000',
  }
}
```

### 3. Watch List Item
```typescript
{
  paddingVertical: 16,
  paddingHorizontal: 16,
  backgroundColor: '#FFFFFF',
  borderBottomWidth: 1,
  borderBottomColor: '#F2F2F7',

  title: {
    fontSize: 16,
    fontWeight: '400',
    color: '#000000',
  },

  subtitle: {
    fontSize: 14,
    fontWeight: '400',
    color: '#8E8E93',
    marginTop: 2,
  },

  price: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },

  priceChange: {
    fontSize: 13,
    fontWeight: '400',
    color: '#34C759', // Green for positive
    // OR color: '#FF3B30', // Red for negative
    marginTop: 2,
  }
}
```

### 4. Stats Card (Last trade, Highest bid, Listings)
```typescript
{
  backgroundColor: '#FFFFFF',
  padding: 16,
  borderRadius: 16,

  label: {
    fontSize: 14,
    fontWeight: '400',
    color: '#8E8E93',
    marginBottom: 4,
  },

  value: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  }
}
```

### 5. Primary Button (Buy)
```typescript
{
  backgroundColor: '#000000',
  height: 56,
  borderRadius: 12,
  paddingHorizontal: 24,

  text: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // With price
  priceText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  }
}
```

### 6. Secondary Button (Sell)
```typescript
{
  backgroundColor: '#FFFFFF',
  borderWidth: 1,
  borderColor: '#E5E5EA',
  height: 56,
  borderRadius: 12,
  paddingHorizontal: 24,

  text: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },

  priceText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  }
}
```

### 7. Time Range Selector
```typescript
// Inactive
{
  backgroundColor: '#F5F5F5',
  paddingVertical: 10,
  paddingHorizontal: 20,
  borderRadius: 20,
  text: {
    fontSize: 14,
    fontWeight: '500',
    color: '#000000',
  }
}

// Active (e.g., 1YR)
{
  backgroundColor: '#000000',
  paddingVertical: 10,
  paddingHorizontal: 20,
  borderRadius: 20,
  text: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
  }
}
```

### 8. Price Chart
```typescript
{
  height: 200,
  backgroundColor: '#FFFFFF',

  line: {
    color: '#000000',
    width: 2,
  },

  grid: {
    color: '#F2F2F7',
    width: 1,
    style: 'dashed',
  },

  yAxisLabels: {
    fontSize: 13,
    fontWeight: '400',
    color: '#8E8E93',
    align: 'right',
  },

  dot: {
    size: 8,
    color: '#000000',
    position: 'end', // Last data point
  }
}
```

### 9. Watch Image Card (Grid)
```typescript
{
  aspectRatio: 1, // Square
  borderRadius: 12,
  overflow: 'hidden',
  marginBottom: 8,

  image: {
    width: '100%',
    height: '100%',
  },

  favoriteIcon: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 40,
    height: 40,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    icon: {
      size: 20,
      color: '#000000',
    }
  },

  title: {
    fontSize: 15,
    fontWeight: '400',
    color: '#000000',
    marginTop: 8,
  },

  subtitle: {
    fontSize: 13,
    fontWeight: '400',
    color: '#8E8E93',
    marginTop: 2,
  },

  price: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginTop: 4,
  }
}
```

### 10. Bottom Sheet / Modal
```typescript
{
  backgroundColor: '#FFFFFF',
  borderTopLeftRadius: 24,
  borderTopRightRadius: 24,
  paddingTop: 12,

  handle: {
    width: 36,
    height: 5,
    backgroundColor: '#E5E5EA',
    borderRadius: 2.5,
    alignSelf: 'center',
  },

  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    backgroundColor: '#F5F5F5',
    borderRadius: 16,
    icon: {
      size: 16,
      color: '#000000',
    }
  },

  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    textAlign: 'center',
    marginTop: 24,
  }
}
```

### 11. Segmented Control (Buy/Sell)
```typescript
{
  backgroundColor: '#F5F5F5',
  borderRadius: 10,
  padding: 2,
  height: 40,

  // Active segment
  activeSegment: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    shadow: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
    }
  },

  text: {
    fontSize: 15,
    fontWeight: '600',
  },

  activeText: {
    color: '#000000',
  },

  inactiveText: {
    color: '#8E8E93',
  }
}
```

### 12. Order Book Table
```typescript
{
  // Header
  header: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',

    text: {
      fontSize: 14,
      fontWeight: '600',
      color: '#000000',
    }
  },

  // Row
  row: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',

    // Alternating background
    evenRow: {
      backgroundColor: '#F9F9F9',
    }
  },

  // Cell
  cell: {
    fontSize: 15,
    fontWeight: '400',
    color: '#000000',
  }
}
```

### 13. Bottom Navigation
```typescript
{
  height: 60, // + safe area
  backgroundColor: '#FFFFFF',
  borderTopWidth: 1,
  borderTopColor: '#E5E5EA',
  paddingBottom: 'safe-area',

  item: {
    icon: {
      size: 24,
      activeColor: '#007AFF',
      inactiveColor: '#8E8E93',
    },

    label: {
      fontSize: 11,
      fontWeight: '500',
      marginTop: 4,
      activeColor: '#007AFF',
      inactiveColor: '#8E8E93',
    }
  },

  items: [
    { icon: 'home', label: 'Home' },
    { icon: 'chart', label: 'Market' },
    { icon: 'watch', label: 'Inventory' },
    { icon: 'message', label: 'Chat' },
    { icon: 'user', label: 'Profile' },
  ]
}
```

### 14. Input Field (Make an offer)
```typescript
{
  backgroundColor: '#FFFFFF',
  borderWidth: 1,
  borderColor: '#E5E5EA',
  borderRadius: 8,
  height: 56,
  paddingHorizontal: 16,

  prefix: {
    fontSize: 18,
    fontWeight: '400',
    color: '#8E8E93',
    marginRight: 4,
  },

  input: {
    fontSize: 18,
    fontWeight: '400',
    color: '#000000',
  },

  placeholder: {
    color: '#C7C7CC',
  },

  // Focused state
  focused: {
    borderColor: '#000000',
    borderWidth: 2,
  }
}
```

### 15. Chat Components

#### Chat Header
```typescript
{
  paddingVertical: 12,
  paddingHorizontal: 16,
  backgroundColor: '#FFFFFF',
  borderBottomWidth: 1,
  borderBottomColor: '#E5E5EA',

  thumbnail: {
    width: 56,
    height: 56,
    borderRadius: 8,
    marginRight: 12,
  },

  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },

  price: {
    fontSize: 14,
    fontWeight: '400',
    color: '#8E8E93',
    marginTop: 2,
  }
}
```

#### Empty Chat State
```typescript
{
  centerContent: true,
  padding: 24,

  date: {
    fontSize: 13,
    fontWeight: '400',
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 16,
  },

  promptCard: {
    backgroundColor: '#F5F5F5',
    borderRadius: 16,
    padding: 20,

    title: {
      fontSize: 16,
      fontWeight: '600',
      color: '#000000',
      marginBottom: 8,
    },

    subtitle: {
      fontSize: 14,
      fontWeight: '400',
      color: '#8E8E93',
    }
  }
}
```

#### Chat Input
```typescript
{
  backgroundColor: '#F5F5F5',
  borderRadius: 24,
  height: 44,
  paddingHorizontal: 16,
  marginHorizontal: 16,
  marginBottom: 16,

  icon: {
    size: 24,
    color: '#8E8E93',
    marginRight: 8,
  },

  input: {
    fontSize: 15,
    fontWeight: '400',
    color: '#000000',
  },

  placeholder: {
    text: 'Send message...',
    color: '#C7C7CC',
  }
}
```

## Screen Layouts

### Market List Screen
- Search bar (top, 16px margin)
- Filter pills (horizontal scroll, 8px spacing)
- Watch list (scrollable)
- Bottom navigation

### Watch Detail Screen
- Header (Back button, "See Order Book" link)
- Watch title + model
- Stats row (3 stats cards)
- Buy/Sell buttons (side by side)
- Price History section
- Chart with time selectors
- Listings grid (2 columns, 12px gap)

### Order Book Modal
- Pull-down handle
- Close button (top-left X)
- Title "Order Book"
- Buy/Sell segmented control
- Table header (Date, Condition, Price)
- Scrollable table rows

### Chat Screen
- Watch info header
- Empty state OR message list
- Input field at bottom

## Implementation Notes

1. **Use React Native StyleSheet.create()** for all styles
2. **Import theme from** `@/theme`
3. **Bottom Safe Area**: Use `react-native-safe-area-context`
4. **Navigation**: Already set up with Expo Router in `app/(tabs)/`
5. **Icons**: Use `lucide-react-native` or similar
6. **Charts**: Use `react-native-svg` + `victory-native` or `react-native-chart-kit`

## File Structure

```
apps/mobile/src/
├── theme/
│   ├── colors.ts        ✅ Created
│   ├── typography.ts    ✅ Created
│   ├── spacing.ts       ✅ Created
│   ├── shadows.ts       ✅ Created
│   └── index.ts         ✅ Created
├── components/
│   ├── SearchBar.tsx
│   ├── FilterPills.tsx
│   ├── WatchListItem.tsx
│   ├── StatsCard.tsx
│   ├── PrimaryButton.tsx
│   ├── SecondaryButton.tsx
│   ├── TimeRangeSelector.tsx
│   ├── PriceChart.tsx
│   ├── WatchImageCard.tsx
│   ├── BottomSheet.tsx
│   ├── SegmentedControl.tsx
│   └── ChatInput.tsx
└── screens/
    └── (Already in app/(tabs)/)
```

## Next Steps

1. Install chart library: `npx expo install react-native-svg victory-native`
2. Install icon library: `npm install lucide-react-native`
3. Start building components based on these specs
4. Reference the theme system at all times
5. Test on both iOS and Android

---

*All measurements are in pixels/points. Colors are hex values.*
*This spec is based on actual Figma designs captured on 2025-10-25.*
