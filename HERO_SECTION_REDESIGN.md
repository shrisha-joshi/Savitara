# Hero Section Redesign - Implementation Guide

## Overview
The hero section has been completely redesigned with rotating Sanskrit text circles and a glowing sun effect, replacing the previous carousel component.

## What Changed

### Web Application (savitara-web)
- **Created:** `src/components/hero/HeroSection.jsx`
- **Modified:** `src/pages/Home.jsx` - Updated imports and component usage
- **Deleted:** `src/components/carousel/HeroCarousel.jsx` and entire carousel directory

### Mobile Application (savitara-app)
- **Created:** `src/components/HeroSection.js`
- **Modified:** `src/screens/grihasta/HomeScreen.js` - Updated imports and component usage
- **Deleted:** `src/components/HeroCarousel.js`

### Assets Structure
- **Web:** `savitara-web/public/assets/images/` - Place hero-image.jpg here
- **Mobile:** `savitara-app/assets/images/hero/` - Place hero-image.jpg here

## Features Implemented

### 1. **Rotating Sanskrit Text Circles**
- Three concentric circles rotating at different speeds
- Sanskrit verses in Kesari (dark orange) color (#FF8C00)
- Smooth CSS/Native animations
- Z-index layering for proper visual hierarchy

**Sanskrit Text Used:**
- **Inner Circle:** ॐ नमः शिवाय • श्री गणेशाय नमः
- **Middle Circle:** सत्यं शिवं सुंदरम् • धर्मो रक्षति रक्षितः
- **Outer Circle:** वसुधैव कुटुम्बकम् • योगः कर्मसु कौशलम्

### 2. **Glowing Sun Effect**
- Radial gradient background behind image
- Pulsing animation for dynamic effect
- Orange color scheme matching brand (#FF8C00)
- Positioned with proper z-index layering

### 3. **Responsive Layout**
**Desktop (Web):**
- Side-by-side layout
- Text content on left (45% width)
- Image with rotating circles on right (50% width)
- Full viewport height minus header

**Mobile (Web & App):**
- Stacked vertical layout
- Text content at top
- Image with circles below
- Touch-optimized spacing

### 4. **Visual Hierarchy (Z-Index Layers)**
```
Layer 1 (Bottom): Sun glow effect (z-index: 1)
Layer 2: Inner rotating circle (z-index: 2)
Layer 3: Hero image (z-index: 3)
Layer 4: Middle rotating circle (z-index: 4)
Layer 5 (Top): Outer rotating circle (z-index: 5)
```

## Usage

### Web Component
```jsx
import HeroSection from '../components/hero/HeroSection';

<HeroSection height="calc(100vh - 64px)" />
```

### Mobile Component
```jsx
import HeroSection from '../../components/HeroSection';

<HeroSection onFindAcharya={() => navigation.navigate('Search')} />
```

## Customization

### Changing Sanskrit Text
Edit the `sanskritTexts` object in the component:

**Web (`HeroSection.jsx`):**
```javascript
const sanskritTexts = {
  inner: 'Your text here',
  middle: 'Your text here',
  outer: 'Your text here',
};
```

**Mobile (`HeroSection.js`):**
Edit the `text` prop in each `RotatingCircle` component.

### Adjusting Rotation Speeds
**Web:**
```javascript
<RotatingCircle radius={220} duration={30} /> // 30 seconds per rotation
<RotatingCircle radius={320} duration={45} /> // 45 seconds per rotation
<RotatingCircle radius={420} duration={60} /> // 60 seconds per rotation
```

**Mobile:**
```javascript
<RotatingCircle radius={180} duration={30} /> // Same pattern
```

### Changing Colors
Update these color values:
- **Kesari Orange:** `#FF8C00` (Sanskrit text)
- **Saddle Brown:** `#8B4513` (Company name)
- **Brown:** `#5D4037` (Description text)
- **Background Gradient:** `#FFF8E7` to `#FFE4B5`

## Image Requirements

### Recommended Specifications
- **Format:** JPG or PNG
- **Size:** 280x280 pixels (square)
- **Subject:** Centered, portrait-oriented
- **Background:** Clean, preferably single color
- **Style:** Professional, spiritual theme

### File Paths
- **Web:** Place in `public/assets/images/hero-image.jpg`
- **Mobile:** Place in `assets/images/hero/hero-image.jpg`

### Fallback Behavior
- **Web:** Falls back to placeholder from via.placeholder.com
- **Mobile:** Falls back to app icon

## Dependencies

### Web (Already Installed)
- `@mui/material` - Material-UI components
- `@emotion/react` & `@emotion/styled` - Styling system

### Mobile (Already Installed)
- `react-native-svg` - SVG rendering
- `expo-linear-gradient` - Gradient backgrounds
- `react-native-reanimated` - Smooth animations

### New Font (Optional Enhancement)
To properly render Sanskrit text, add Noto Sans Devanagari font:

**Web:**
```html
<!-- In public/index.html -->
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;500;700&display=swap" rel="stylesheet">
```

**Mobile:**
```bash
npx expo install expo-font @expo-google-fonts/noto-sans-devanagari
```

## Testing Checklist

### Web Application
- [ ] Hero section loads without errors
- [ ] Sanskrit circles rotate smoothly
- [ ] Sun glow pulses correctly
- [ ] Image displays (or fallback shows)
- [ ] Responsive on mobile viewport
- [ ] Text is readable on light background
- [ ] "Find an Acharya" button works

### Mobile Application
- [ ] Component renders without crashes
- [ ] Animations run smoothly (60fps)
- [ ] Image loads from assets folder
- [ ] Button navigates to Search screen
- [ ] Layout adjusts for different screen sizes
- [ ] Sanskrit text renders properly
- [ ] No overflow or layout issues

## Performance Considerations

### Web
- CSS animations use GPU acceleration (`transform` property)
- SVG paths are static (only rotation animated)
- Images lazy-load with error handling
- Responsive breakpoints use Material-UI's system

### Mobile
- Animated.View uses native driver
- SVG components are memoized
- Image optimization with proper resizeMode
- Platform-specific optimizations included

## Troubleshooting

### Issue: Sanskrit text not showing
**Solution:** Ensure Noto Sans Devanagari font is loaded (see Dependencies section)

### Issue: Circles not rotating
**Web:** Check browser console for animation errors
**Mobile:** Verify react-native-reanimated is properly configured

### Issue: Image not displaying
**Web:** Check `public/assets/images/hero-image.jpg` exists
**Mobile:** Check `assets/images/hero/hero-image.jpg` exists and is properly linked

### Issue: Layout broken on mobile
**Web:** Clear browser cache and test with DevTools mobile view
**Mobile:** Restart Expo dev server and clear Metro bundler cache

## Browser/Device Support

### Web
- **Chrome/Edge:** Full support
- **Firefox:** Full support
- **Safari:** Full support (iOS 12+)
- **IE11:** Not supported (uses modern CSS features)

### Mobile
- **iOS:** 12.0+
- **Android:** 6.0+ (API level 23)
- **Expo SDK:** Compatible with current version

## Future Enhancements

Potential improvements to consider:
1. Add parallax effect on scroll
2. Include user testimonials overlay
3. Implement dark mode support
4. Add micro-interactions on hover/tap
5. Include accessibility enhancements (ARIA labels)
6. Add analytics tracking for button clicks

## Files Reference

```
savitara-web/
├── public/
│   └── assets/
│       └── images/
│           └── hero-image.jpg (ADD THIS)
└── src/
    ├── components/
    │   └── hero/
    │       └── HeroSection.jsx (NEW)
    └── pages/
        └── Home.jsx (MODIFIED)

savitara-app/
├── assets/
│   └── images/
│       └── hero/
│           └── hero-image.jpg (ADD THIS)
└── src/
    ├── components/
    │   └── HeroSection.js (NEW)
    └── screens/
        └── grihasta/
            └── HomeScreen.js (MODIFIED)
```

## Notes

- All carousel components have been completely removed
- No backward compatibility with old carousel
- Components are self-contained with inline styles
- Animations start automatically on mount
- Sanskrit text can be customized per deployment

---

**Created:** 2025-02-14
**Last Updated:** 2025-02-14
**Version:** 1.0.0
