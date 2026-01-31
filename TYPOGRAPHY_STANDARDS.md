# Savitara Platform - Typography Standards

## 🎨 Overview

This document defines the official typography standards for the Savitara platform. Consistent typography is **critical** for brand recognition and professional appearance.

---

## 📐 The Typography Stack

### Font Roles

| Role | Font | Use Case | Weights |
|------|------|----------|---------|
| **Brand** | Samarkan | ONLY "Savitara" name | Regular |
| **Headings** | Poppins | Section titles, headers | 500, 600, 700 |
| **Body** | Inter | All other text, UI elements | 300, 400, 500, 600, 700 |

### Why These Fonts?

1. **Samarkan** - Indo-calligraphic style creates instant brand recognition. The Sanskrit-style letterforms connect to Hindu spiritual aesthetics.

2. **Inter** - Designed specifically for screens by Rasmus Andersson. Industry gold standard for SaaS/apps. Extremely readable at small sizes (14-16px).

3. **Poppins** - Geometric sans-serif adds visual interest to headings without sacrificing readability. Modern, professional feel.

---

## ⚠️ Critical Rules

### DO ✅

- Use Samarkan **ONLY** for the "Savitara" brand name
- Use Inter for all body text and UI elements
- Use Poppins for section titles and headers
- Test readability at 14px minimum
- Use font weights (400/500/600/700) for hierarchy instead of different fonts

### DON'T ❌

- Never use Samarkan for body text (readability collapses)
- Never use more than 2 fonts on a single page (excluding brand)
- Never use decorative fonts for buttons, labels, or paragraphs
- Never use font sizes below 12px

---

## 💻 Implementation by Platform

### Web (savitara-web, admin-savitara-web)

```css
/* Font imports */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Poppins:wght@400;500;600;700&display=swap');
@import url('https://fonts.cdnfonts.com/css/samarkan');

/* Body default */
body {
  font-family: 'Inter', -apple-system, sans-serif;
}

/* Headings */
h1, h2, h3, h4 {
  font-family: 'Poppins', sans-serif;
}

/* Brand name ONLY */
.brand-name {
  font-family: 'Samarkan', serif;
  letter-spacing: 2px;
}
```

### Mobile (savitara-app, admin-savitara-app)

```javascript
// Load in App.js using expo-font
const [fontsLoaded] = useFonts({
  Samarkan: require('./assets/fonts/Samarkan.otf'),
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
});
```

Required packages:
```bash
npx expo install expo-font @expo-google-fonts/inter @expo-google-fonts/poppins expo-splash-screen
```

---

## 📏 Typography Scale

| Name | Size | Use Case |
|------|------|----------|
| xs | 12px | Captions, labels |
| sm | 14px | Secondary text, descriptions |
| base | 16px | Body text (default) |
| lg | 18px | Emphasized body |
| xl | 20px | Small headings |
| 2xl | 24px | H4 headings |
| 3xl | 30px | H3 headings |
| 4xl | 36px | H2 headings |
| 5xl | 48px | H1 headings |
| 6xl | 60px | Hero text |

---

## 🎯 Font Pairing Examples

### Hero Section
```
Heading: Poppins 700 (48px)
Subheading: Inter 400 (18px)
Brand: Samarkan (custom size)
```

### Card Component
```
Title: Poppins 600 (20px)
Body: Inter 400 (16px)
Caption: Inter 400 (14px)
```

### Navigation
```
Logo: Samarkan (brand)
Links: Inter 500 (16px)
Active: Inter 600 (16px)
```

---

## 🔧 Component Reference

### SavitaraBrand Component

Both web and mobile apps have a `SavitaraBrand` component:

**Web:** `savitara-web/src/components/branding/SavitaraBrand.jsx`
**Mobile:** `savitara-app/src/components/SavitaraBrand.js`

Props:
- `variant`: 'default' | 'white' | 'gold'
- `size`: 'small' | 'medium' | 'large' | 'xlarge'
- `withOm`: boolean - Show ॐ symbol
- `withTagline`: boolean - Show tagline

---

## 📦 Font Files

The Samarkan font file needs to be placed in:
- `savitara-app/assets/fonts/Samarkan.otf`
- `admin-savitara-app/assets/fonts/Samarkan.otf`

Download from: https://www.cdnfonts.com/samarkan.font

---

## 🚀 Performance Tips

1. Use `font-display: swap` for web fonts
2. Preconnect to font servers in HTML head
3. Limit font weights to those actually used
4. Use woff2 format when available

---

## 📚 Resources

- [Inter Font](https://rsms.me/inter/)
- [Poppins on Google Fonts](https://fonts.google.com/specimen/Poppins)
- [Samarkan Font](https://www.cdnfonts.com/samarkan.font)
- [Font Pairing Guide](https://fontpair.co/)

---

*Last updated: January 2026*
