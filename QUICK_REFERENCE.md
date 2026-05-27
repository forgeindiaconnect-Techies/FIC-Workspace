# Quick Reference: Responsive Design for Mobile App

## 🚀 Quick Start (60 seconds)

```typescript
import { useWindowDimensions } from 'react-native';
import { useResponsiveLayout } from '../lib/responsive';

export default function MyComponent() {
  const { screenType, contentPadding, gridColumns, isSmallScreen } = useResponsiveLayout();
  
  return (
    <View style={{ paddingHorizontal: contentPadding.horizontal }}>
      {isSmallScreen ? <SimplifiedView /> : <FullView />}
    </View>
  );
}
```

## 📱 Screen Types

| Type | Width | Example Devices |
|------|-------|-----------------|
| **small** | < 480px | iPhone SE, old phones |
| **mobile** | 480-600px | iPhone 12, standard |
| **compact** | 600-768px | iPhone 15 Pro Max |
| **tablet** | 768-1024px | iPad, Galaxy Tab |
| **desktop** | > 1024px | Large tablets, web |

## 🎨 Key Functions

```typescript
// Get screen type
const screenType = getScreenType(width); // 'small' | 'mobile' | 'compact' | 'tablet' | 'desktop'

// Get responsive padding
const { horizontal, vertical } = getContentPadding(screenType, width);

// Get navigation heights
const bottomNavHeight = getBottomNavHeight(width);
const topBarHeight = getTopBarHeight(insets);

// Get grid columns
const cols = getGridColumns(screenType); // 2, 3, 4, or 5

// Hook for everything
const { screenType, contentPadding, gridColumns, isSmallScreen, isTabletScreen } = useResponsiveLayout();
```

## 💡 Common Patterns

### Responsive Font Size
```typescript
fontSize: isSmallScreen ? 14 : 16
```

### Responsive Layout
```typescript
flexDirection: screenType === 'tablet' ? 'row' : 'column'
```

### Conditional Components
```typescript
{isSmallScreen && <CompactView />}
{!isSmallScreen && <ExpandedView />}
{isTabletScreen && <TabletLayout />}
```

### Responsive Grid
```typescript
const itemWidth = (width - spacing) / getGridColumns(screenType);
<View style={{ width: itemWidth }} />
```

### Safe Area Handling
```typescript
const insets = useSafeAreaInsets();
const safeInsets = getSafeAreaInsets(insets);
style={{ paddingTop: safeInsets.top, paddingBottom: safeInsets.bottom }}
```

## ⚠️ DO's and DON'Ts

### DO ✅
```typescript
✅ const padding = contentPadding.horizontal;
✅ fontSize: screenType === 'small' ? 14 : 16
✅ Wrap styles in useMemo()
✅ Use useWindowDimensions()
✅ Test on multiple devices
```

### DON'T ❌
```typescript
❌ const padding = 16; // Hardcoded
❌ fontSize: 16 // Same on all screens
❌ Inline style objects
❌ Dimensions.get('window') // Use hook instead
❌ Skip testing on small devices
```

## 🧪 Testing Checklist

```
☐ Small phone (iPhone SE)
☐ Standard phone (iPhone 12/13)
☐ Large phone (iPhone 15 Pro Max)
☐ Tablet (iPad)
☐ Android phone
☐ Android tablet
☐ Landscape mode
☐ Notched devices
☐ No overlapping content
☐ No console errors
```

## 📋 Files & Resources

| File | Purpose |
|------|---------|
| `mobile/src/lib/responsive.ts` | Utility functions |
| `mobile/src/components/AppLayout.tsx` | Main layout implementation |
| `mobile/src/components/layout.tsx` | TopBar & BottomNav example |
| `RESPONSIVE_DESIGN_GUIDE.md` | Full documentation |
| `IMPLEMENTATION_EXAMPLES.md` | Code examples |
| `RESPONSIVE_IMPLEMENTATION_CHECKLIST.md` | Testing checklist |

## 🔧 Troubleshooting

| Problem | Solution |
|---------|----------|
| Content overlaps bottom nav | Set `paddingBottom: getBottomNavHeight(width) + padding.vertical` |
| Text too small | Use `getResponsiveFontSize(screenType, size)` |
| Modal off-screen | Calculate position with safe area insets |
| Layout breaks on rotation | Add `width`, `height` to `useMemo` dependencies |
| Different heights on iOS/Android | Use `Platform.select()` or safe area insets |

## 📞 Need Help?

1. Check `RESPONSIVE_DESIGN_GUIDE.md` for concepts
2. See `IMPLEMENTATION_EXAMPLES.md` for code samples
3. Review existing implementations (AppLayout.tsx, layout.tsx)
4. Use `RESPONSIVE_IMPLEMENTATION_CHECKLIST.md` when implementing

## 🎯 Next Steps

1. Review the RESPONSIVE_DESIGN_GUIDE.md
2. Study IMPLEMENTATION_EXAMPLES.md 
3. Apply responsive utilities to your components
4. Test on multiple devices
5. Use RESPONSIVE_IMPLEMENTATION_CHECKLIST.md for verification

---

**Last Updated**: May 27, 2026  
**Version**: 1.0  
**Status**: Ready for Production
