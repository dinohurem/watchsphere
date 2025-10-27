# WatchSphere Mobile Design Reference

## Figma Design
Design file: [WS-Design](https://www.figma.com/design/kywyaZSkxT0597DBnWRuMO/WS-Design?node-id=1-1188&t=3PtSpKeY75HlZQjM-0)

## Design System

### Color Palette
Based on the design screens:
- **Primary Color**: `#1C1C1E` (Black/Dark Gray - used for buttons, primary actions)
- **Secondary Color**: `#F5F5F5` (Light Gray - backgrounds, secondary buttons)
- **Accent Color**: `#2C2C2E` (Dark gray for cards)
- **Background**: `#FFFFFF` (White)
- **Surface**: `#F8F8F8` (Light gray for cards)
- **Text Primary**: `#000000` (Black)
- **Text Secondary**: `#8E8E93` (Gray for secondary text, prices changes)
- **Success/Positive**: `#34C759` (Green - for positive price changes)
- **Error/Negative**: `#FF3B30` (Red - for negative price changes)
- **Border**: `#E5E5EA` (Light gray for borders)
- **Chart Line**: `#000000` (Black line for price charts)

### Typography
Using SF Pro (iOS system font) - clean and modern:
- **Font Family**: SF Pro Display / SF Pro Text
- **Font Sizes**:
  - **H1** (Watch Model): 20px, Semi-Bold
  - **H2** (Price/Numbers): 16-18px, Semi-Bold
  - **Body** (Regular text): 14-15px, Regular
  - **Caption** (Secondary info, model numbers): 13px, Regular
  - **Small** (Timestamps, percentages): 11-12px, Regular
- **Font Weights**:
  - Regular: 400
  - Semi-Bold: 600
  - Bold: 700

### Spacing
- **Base unit**: 4px
- **Extra Small**: 4px
- **Small**: 8px
- **Medium**: 12-16px
- **Large**: 20-24px
- **Extra Large**: 32px
- **Card padding**: 16px
- **Screen padding**: 16-20px

### Border Radius
- **Small** (Chips/Pills): 16-20px (pill shape)
- **Medium** (Buttons): 12px
- **Large** (Cards): 16px
- **Images**: 12px

## Screen Layouts

### Market Screen (Screen 1)
**Layout**:
- Search bar at top with rounded corners
- Horizontal scrolling filter chips (All, Rolex, Omega, Audemars)
- List of watch cards with:
  - Watch name (bold)
  - Model number (gray text)
  - Price (large, bold)
  - Price change percentage (green ▲ or red ▼)

**Components**:
- Search input with placeholder "Search watches..."
- Filter icon (hamburger/menu)
- Pill-shaped filter chips with black active state
- Watch list items with dividers

**Spacing**:
- Top padding: 16px
- Card vertical spacing: 12px
- Horizontal margins: 16px

### Watch Detail Screen (Screen 2)
**Layout**:
- Back button top-left, "See Order Book" top-right
- Watch title and model number
- Stats row (Last trade, Highest bid, Listings)
- Large Buy/Sell buttons
- Price History section with line chart
- Time range selector (All, 1M, 3M, 6M, 1YR)
- Listings section with image grid

**Components**:
- Stats cards with label and value
- Primary action buttons (Buy - black, Sell - white with border)
- Line chart with time markers
- Pill-shaped time range selector
- Image grid with 2 columns
- Favorite heart icon on images

**Chart**:
- Black line on white background
- Time markers on right (15k, 14k, 13k, 12k, 11k)
- Clean, minimal design

### Order Book Screen (Screen 3)
**Layout**:
- Close button (X) top-left, "Order Book" title center, navigation arrow top-right
- Buy/Sell toggle tabs
- Mini price chart at top
- Table with columns: Date, Condition, Price
- Scrollable list of orders

**Components**:
- Segmented control for Buy/Sell
- Compact line chart
- Data table with aligned columns
- Date format: DD.MM.YY
- Consistent price format: €XX,XXX

**Table Design**:
- Left-aligned text
- Gray dividers between rows
- Compact row height
- Clean, readable layout

### Market Analytics Screen (Screen 4)
**Layout**:
- Back button with "Order Book →" navigation
- Large price chart
- Time range selector (All, 1M, 3M, 6M, 1YR - with 1YR active)
- "Listings" section title
- 2-column image grid
- Watch cards with:
  - Product image
  - Heart icon (favorite)
  - Watch name and model
  - Price

**Grid Layout**:
- 2 columns
- Equal width cards
- 12px gap between cards
- 16px horizontal margins
- Heart icon top-right of each image

## UI Components

### Buttons

**Primary Button** (Buy button):
- Background: `#1C1C1E` (black)
- Text: White
- Border radius: 12px
- Height: 48-52px
- Font: Semi-Bold, 16px
- Padding: 16px horizontal

**Secondary Button** (Sell button):
- Background: `#FFFFFF` (white)
- Border: 1px solid `#E5E5EA`
- Text: Black
- Border radius: 12px
- Height: 48-52px
- Font: Semi-Bold, 16px
- Padding: 16px horizontal

**Filter Chips**:
- Inactive: White background, black border, black text
- Active: Black background, white text
- Border radius: 20px (pill shape)
- Padding: 8px 16px
- Font: Regular, 14px

**Icon Buttons**:
- Size: 40x40px
- Background: Transparent or white
- Icons: Black, 20-24px

### Cards

**Watch List Card** (Market Screen):
- Background: White
- No border or subtle border
- Padding: 12px 0
- Border bottom: 1px solid `#F2F2F7`
- Layout: Horizontal with text on left, price/stats on right

**Watch Image Card** (Listings Grid):
- Background: White
- Border radius: 12px
- Shadow: Subtle (elevation 1-2)
- Aspect ratio: ~4:3 or 1:1
- Image border radius: 12px top
- Padding: 0 (image full bleed)
- Bottom section: 12px padding for text

**Stats Card**:
- Background: `#F8F8F8`
- Border radius: 8px
- Padding: 12px
- Label: Gray, 13px
- Value: Black, 16px Semi-Bold

### Input Fields

**Search Bar**:
- Background: `#F8F8F8`
- Border: None (or 1px `#E5E5EA` when focused)
- Border radius: 12px
- Height: 40-44px
- Padding: 12px 16px
- Placeholder: `#8E8E93`
- Font: Regular, 15px
- Icon: Gray magnifying glass, left side

### Navigation

**Bottom Navigation Bar**:
- Background: White
- Height: 60px + safe area
- Items: 5 (Home, Market, Inventory, Chat, Profile)
- Active color: `#1C1C1E` (black)
- Inactive color: `#8E8E93` (gray)
- Icon size: 24px
- Label: 11px
- Top border: 1px solid `#E5E5EA`

**App Bar / Header**:
- Height: 44px + safe area
- Background: White or transparent
- Title: Center or left-aligned, 17px Semi-Bold
- Back button: Left, arrow icon
- Action button: Right, text or icon

**Segmented Control** (Buy/Sell toggle):
- Background: `#F8F8F8`
- Border radius: 10px
- Height: 36px
- Active segment: White background with shadow
- Inactive segment: Transparent
- Font: Semi-Bold, 14px
- Animation: Smooth slide transition

### Charts

**Line Chart**:
- Line color: `#000000` (black)
- Line width: 2px
- Background: White
- Grid: None or very subtle
- Y-axis labels: Right-aligned, gray, 12px
- X-axis: Time range selector below
- Touch interaction: Show crosshair and value on tap

### Additional Components

**Heart/Favorite Icon**:
- Size: 24x24px
- Unfilled: White with black stroke or transparent with stroke
- Filled: Red or black fill
- Position: Top-right of image cards
- Background: Optional white circle with shadow for visibility

**Price Change Indicator**:
- Positive: `#34C759` with ▲
- Negative: `#FF3B30` with ▼
- Font: Regular, 12px
- Format: ▲ X.X%

**Dividers**:
- Color: `#E5E5EA` or `#F2F2F7`
- Height: 1px
- Margins: 16px horizontal (or edge-to-edge)

### Bottom Navigation
The app uses a 5-tab bottom navigation:
1. **Home** - Dashboard with quick actions
2. **Market** - Watch listings and search
3. **Inventory** - User's watch inventory
4. **Chat** - Messaging with dealers
5. **Profile** - Account settings

## Chat Screens

### Chat List Screen
**Layout**:
- Search bar at top
- List of conversations
- Each conversation card shows:
  - User avatar/image
  - Name
  - Last message preview
  - Timestamp
  - Unread badge (if applicable)

**Components**:
- Search input
- Conversation cards with avatar, title, subtitle, timestamp
- Unread indicators (badges or dots)
- Empty state for no conversations

### Chat Detail Screen
**Layout**:
- Header with back button, user name, online status
- Message list (scrollable)
- Message input at bottom with send button
- Optional: Attachment/image button

**Message Bubbles**:
- Sent messages: Aligned right, dark background
- Received messages: Aligned left, light gray background
- Border radius: 16-20px
- Padding: 12px 16px
- Tail/pointer optional

**Input**:
- Background: Light gray
- Border radius: 24px (pill shape)
- Height: 40px
- Send button: Icon or text, primary color

## Implementation Notes

### Theme Implementation
Theme files are located in: `src/theme/`
- `index.ts` - Main theme export
- `colors.ts` - Color constants
- `typography.ts` - Text styles
- `spacing.ts` - Spacing, sizing, radius constants
- `shadows.ts` - Shadow definitions for iOS/Android

### Usage
```typescript
import { theme, colors, typography, spacing } from '@/theme';

// Use in components
<Text style={typography.h1}>Title</Text>
<View style={{ padding: spacing.lg, backgroundColor: colors.surface }}>
  ...
</View>
```

### Component Styling Pattern
```typescript
import { StyleSheet } from 'react-native';
import { colors, spacing, typography, radius } from '@/theme';

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    padding: spacing.screenPadding,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: spacing.cardPadding,
  },
  title: {
    ...typography.h3,
  },
});
```

### Key Implementation Details
1. Use **Expo** for development
2. Use **Expo Router** for navigation (already set up in `app/` folder)
3. Style with **StyleSheet.create()** for performance
4. Follow the exact spacing and sizing from this spec
5. Use the theme tokens consistently
6. Implement iOS and Android platform-specific shadows
7. Test on both iOS and Android devices
