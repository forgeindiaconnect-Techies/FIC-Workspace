# Responsive Design Implementation Checklist

Use this checklist when implementing responsive design in your mobile app components.

## Pre-Implementation

- [ ] Review the RESPONSIVE_DESIGN_GUIDE.md
- [ ] Understand the 5 screen types (small, mobile, compact, tablet, desktop)
- [ ] Check existing implementations in AppLayout.tsx and layout.tsx for patterns
- [ ] Review IMPLEMENTATION_EXAMPLES.md for code patterns

## Component Implementation

### Imports & Hooks
- [ ] Import `useWindowDimensions` from 'react-native'
- [ ] Import `useResponsiveLayout` or specific functions from '../lib/responsive'
- [ ] Import `useMemo` and `useState` from 'react' if needed
- [ ] Import `useSafeAreaInsets` if handling safe areas

### Layout Structure
- [ ] Main container uses `flex: 1`
- [ ] Content padding uses responsive values (not hardcoded)
- [ ] Bottom navigation space is accounted for (`getBottomNavHeight()`)
- [ ] Top bar space is considered if applicable

### Responsive Values
- [ ] Font sizes are responsive (`screenType === 'small'` ? smaller : larger)
- [ ] Icon sizes adjust based on screen type
- [ ] Padding/margins use `contentPadding` values
- [ ] Grid columns use `getGridColumns(screenType)`
- [ ] Modal widths are constrained appropriately

### Style Calculations
- [ ] Styles are wrapped in `useMemo()`
- [ ] Dependencies include: `width`, `screenType`, `contentPadding`
- [ ] No inline style objects (use `StyleSheet.create()`)
- [ ] Platform-specific styles use `Platform.select()` only when necessary

### Content Areas
- [ ] Text content truncates gracefully on small screens
- [ ] Images scale appropriately
- [ ] Buttons are touch-friendly (min 44x44 on iOS, 48x48 on Android)
- [ ] Forms fields are appropriately sized
- [ ] Lists items have proper spacing

### Modals & Overlays
- [ ] Modal width calculated responsively
- [ ] Positioned correctly with safe area consideration
- [ ] Scrollable if content exceeds screen height
- [ ] Close buttons accessible on all screen sizes

### Conditional Rendering
- [ ] Simplified layouts for `small` screens
- [ ] Full layouts for `tablet` and `desktop`
- [ ] Different component arrangements based on `screenType`
- [ ] Hidden non-essential elements on small screens

## Testing

### Device Testing
- [ ] Tested on small phone (< 480px)
- [ ] Tested on standard phone (480-600px)
- [ ] Tested on compact phone (600-768px)
- [ ] Tested on tablet (768-1024px)
- [ ] Tested on large tablet/web (> 1024px)

### OS Testing
- [ ] iOS phone (iPhone SE, 12, 13, 14, 15)
- [ ] iOS tablet (iPad)
- [ ] Android phone (various sizes)
- [ ] Android tablet
- [ ] Web browser (multiple sizes)

### Orientation Testing
- [ ] Portrait mode displays correctly
- [ ] Landscape mode displays correctly
- [ ] Content doesn't overlap on rotation
- [ ] Padding adjusts appropriately

### Edge Cases
- [ ] Notched/Dynamic Island devices (iOS)
- [ ] Status bar height on Android
- [ ] Bottom navigation spacing correct
- [ ] Modals don't go off-screen
- [ ] Very long text handles gracefully
- [ ] Keyboard doesn't cover content

## Code Quality

### Performance
- [ ] Styles calculated in `useMemo()` (not on every render)
- [ ] No unnecessary re-renders
- [ ] Responsive hook used efficiently
- [ ] No console warnings

### Maintainability
- [ ] Comments explain responsive logic
- [ ] Consistent naming conventions
- [ ] No magic numbers (use helper functions)
- [ ] Code follows existing patterns in codebase

### Accessibility
- [ ] Text is readable (sufficient contrast)
- [ ] Touch targets are large enough
- [ ] No important content hidden on small screens
- [ ] Semantic structure maintained

## Review Checklist

Before submitting code for review:

- [ ] All responsive utilities are imported correctly
- [ ] No hardcoded pixel values (except in base definitions)
- [ ] Tested on minimum 3 different screen sizes
- [ ] Tested on both iOS and Android
- [ ] No overlapping content
- [ ] Modal positioning is correct
- [ ] Safe area insets handled properly
- [ ] Code follows existing patterns
- [ ] Performance is acceptable
- [ ] No console errors or warnings

## Common Issues & Fixes

| Issue | Cause | Fix |
|-------|-------|-----|
| Content overlaps bottom nav | Hardcoded padding | Use `getBottomNavHeight()` |
| Text cut off on small screens | Fixed font size | Use conditional: `screenType === 'small' ? smaller : normal` |
| Modal appears off-screen | Fixed position | Calculate position based on screen dimensions |
| Buttons too small to tap | Fixed padding | Use `min 44x44` (iOS) or `48x48` (Android) |
| Layout shifts on rotation | Missing dependencies in `useMemo` | Add `width`, `height`, `screenType` to deps |
| Icons overlap on small screens | Fixed sizes | Make icons responsive to `screenType` |
| Notch not handled on iOS | Ignoring safe area | Use `useSafeAreaInsets()` |
| Different heights on different OS | Hardcoded values | Use platform-specific calculations |

## Quick Reference

### Must Use
✅ `useWindowDimensions()` - For screen dimensions  
✅ `useSafeAreaInsets()` - For notches and safe areas  
✅ `useMemo()` - For style calculations  
✅ `StyleSheet.create()` - For style definitions  
✅ Responsive utility functions - For consistent values  

### Must NOT Use
❌ Hardcoded padding/margins  
❌ Fixed pixel dimensions  
❌ Inline style objects  
❌ Dimensions.get() (use useWindowDimensions instead)  
❌ Platform check conditions for every value  

## Files to Reference

- `mobile/src/lib/responsive.ts` - Utility functions
- `mobile/src/components/AppLayout.tsx` - Main layout example
- `mobile/src/components/layout.tsx` - TopBar & BottomNav example
- `RESPONSIVE_DESIGN_GUIDE.md` - Comprehensive guide
- `IMPLEMENTATION_EXAMPLES.md` - Code examples

## Questions?

Refer to:
1. RESPONSIVE_DESIGN_GUIDE.md for concepts
2. IMPLEMENTATION_EXAMPLES.md for code patterns
3. Existing components (AppLayout.tsx, layout.tsx)
4. Responsive utility functions documentation
