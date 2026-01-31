# Image Setup Guide for Savitara Carousel

## Overview
The carousel has been configured to display 4 beautiful Hindu wedding ceremony images. Follow these steps to add the actual images.

## Required Images

### 1. wedding-couple-outdoor.jpg
- **Source**: The second image showing couple outdoors at sunset
- **Recommended Size**: 1920x1080px (16:9 ratio)
- **Optimization**: Compress to ~200-300KB for web, ~150KB for mobile
- **Description**: Wedding couple in traditional attire with sunset bokeh effect

### 2. wedding-ceremony.jpg
- **Source**: The third image showing indoor ceremony
- **Recommended Size**: 1920x1080px (16:9 ratio)
- **Optimization**: Compress to ~200-300KB for web, ~150KB for mobile
- **Description**: Couple sitting during wedding ceremony in traditional setup

### 3. wedding-hands.jpg
- **Source**: The first image with henna hands and bangles
- **Recommended Size**: 1920x1080px (16:9 ratio)
- **Optimization**: Compress to ~200-300KB for web, ~150KB for mobile
- **Description**: Close-up of bride's hands with mehndi and colorful bangles

### 4. wedding-entrance.jpg
- **Source**: The fourth image with decorated doorway
- **Recommended Size**: 1920x1080px (16:9 ratio)
- **Optimization**: Compress to ~200-300KB for web, ~150KB for mobile
- **Description**: Traditional temple entrance with rangoli and decorations

## Installation Steps

### For Web App (savitara-web):

1. **Save images** to: `savitara-web/public/images/carousel/`
   - Ensure exact filenames match: `wedding-couple-outdoor.jpg`, `wedding-ceremony.jpg`, etc.

2. **Optimize images** using tools like:
   - TinyPNG (https://tinypng.com/)
   - ImageOptim (Mac)
   - Squoosh (https://squoosh.app/)

3. **Verify** by opening: `http://localhost:3000/images/carousel/wedding-couple-outdoor.jpg`

### For Mobile App (savitara-app):

1. **Save images** to: `savitara-app/assets/images/carousel/`
   - Use same filenames as web

2. **For best mobile performance**, create multiple resolutions:
   ```
   wedding-couple-outdoor.jpg       (1920x1080 - for tablets)
   wedding-couple-outdoor@2x.jpg    (1280x720 - for phones)
   wedding-couple-outdoor@1x.jpg    (960x540 - for older devices)
   ```

3. **Rebuild app** after adding images:
   ```bash
   cd savitara-app
   npx expo start --clear
   ```

## Image Optimization Tips

### Compression Settings:
- **Quality**: 80-85% (good balance of quality and size)
- **Format**: JPEG for photos (better compression than PNG)
- **Progressive**: Enable progressive JPEG for faster perceived loading

### Responsive Considerations:
- **Mobile**: Load smaller versions on slow connections
- **Tablet**: Medium-sized images
- **Desktop**: Full HD (1920x1080)

## Fallback Strategy

If images fail to load, the carousel will:
- **Web**: Show gradient background with overlay
- **Mobile**: Display placeholder color with icons

## Testing Checklist

After adding images:

### Web:
- [ ] Images load on homepage carousel
- [ ] Auto-rotation works (5 second intervals)
- [ ] Navigation arrows function properly
- [ ] Pagination dots show correctly
- [ ] Images are sharp on retina displays
- [ ] Loading is smooth without layout shift

### Mobile:
- [ ] Images render in carousel
- [ ] Swipe gestures work
- [ ] Auto-advance functions
- [ ] Images fit screen properly
- [ ] No memory issues on low-end devices

## Current Implementation

### Web Component:
- File: `savitara-web/src/components/carousel/HeroCarousel.jsx`
- Uses: react-slick for carousel functionality
- Features: Auto-play, arrows, dots, pause on hover

### Mobile Component:
- File: `savitara-app/src/components/HeroCarousel.js`
- Uses: React Native Animated & Reanimated
- Features: Auto-play, swipe gestures, pagination dots

### Integration:
- **Web**: Used in `savitara-web/src/pages/Home.jsx`
- **Mobile**: Used in `savitara-app/src/screens/grihasta/HomeScreen.js`

## Troubleshooting

### Images not showing on Web:
1. Check file path: `/public/images/carousel/`
2. Verify filename spelling exactly matches
3. Clear browser cache (Ctrl+Shift+R / Cmd+Shift+R)
4. Check browser console for 404 errors

### Images not showing on Mobile:
1. Verify files in `assets/images/carousel/`
2. Restart Metro bundler: `npx expo start --clear`
3. Check `require()` paths in HeroCarousel.js
4. Rebuild app if needed

### Performance Issues:
1. Reduce image file sizes (<200KB each)
2. Use lazy loading for non-visible slides
3. Implement image caching
4. Consider WebP format for modern browsers

## Alternative Image Sources

If you need to replace these images later:
- Use royalty-free images from Unsplash/Pexels
- Ensure cultural authenticity and sensitivity
- Maintain 16:9 aspect ratio
- Keep consistent color tones across all images

## Contact

For issues or questions about image setup, refer to:
- Main README.md
- Image optimization guide in documentation/
