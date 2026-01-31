# Quick Image Setup - Savitara Carousel

## 🚀 Quick Start (5 Minutes)

### Step 1: Get the 4 Images Ready
You have these images:
1. Couple hands with henna → Save as `wedding-hands.jpg`
2. Couple outdoors at sunset → Save as `wedding-couple-outdoor.jpg`
3. Couple sitting in ceremony → Save as `wedding-ceremony.jpg`
4. Decorated entrance with rangoli → Save as `wedding-entrance.jpg`

### Step 2: Optimize Images (Optional but Recommended)
- Go to https://tinypng.com/
- Upload all 4 images
- Download compressed versions
- Target: <300KB per image

### Step 3: Add to Web App
```bash
# Copy images to this folder:
D:\Savitara\savitara-web\public\images\carousel\

# You should have:
wedding-hands.jpg
wedding-couple-outdoor.jpg
wedding-ceremony.jpg
wedding-entrance.jpg
```

### Step 4: Add to Mobile App
```bash
# Copy same images to:
D:\Savitara\savitara-app\assets\images\carousel\

# Same 4 files with same names
```

### Step 5: Test Web App
```bash
# If web server running:
# Open browser to http://localhost:3000
# You should see carousel on homepage

# If not running, start it:
cd savitara-web
npm run dev
```

### Step 6: Test Mobile App
```bash
# Restart Metro bundler:
cd savitara-app
npx expo start --clear

# Scan QR code with Expo Go app
# Check carousel on home screen
```

## ✅ Done!

The carousel should now display your beautiful wedding ceremony images!

---

## 🎯 Image Specifications

| Property | Value |
|----------|-------|
| Dimensions | 1920x1080px (16:9) |
| Format | JPEG |
| Quality | 80-85% |
| File Size | <300KB |
| Color Space | sRGB |

---

## 📁 Exact File Locations

### Web:
```
D:\Savitara\savitara-web\public\images\carousel\
├── wedding-hands.jpg
├── wedding-couple-outdoor.jpg
├── wedding-ceremony.jpg
└── wedding-entrance.jpg
```

### Mobile:
```
D:\Savitara\savitara-app\assets\images\carousel\
├── wedding-hands.jpg
├── wedding-couple-outdoor.jpg
├── wedding-ceremony.jpg
└── wedding-entrance.jpg
```

---

## 🔥 Pro Tips

1. **Filenames Matter**: Must match exactly (case-sensitive on Linux/Mac)
2. **Don't Worry Yet**: Web has fallback images, so carousel works without local files
3. **Optimize Later**: Can add images now, optimize later if needed
4. **Backup**: Keep originals in case you need to re-compress
5. **Test Both**: Make sure to test on both web and mobile

---

## ❓ Quick Troubleshooting

**Images not showing on web?**
→ Check filenames exactly match
→ Clear browser cache (Ctrl+Shift+R)
→ Fallback Unsplash images should still work

**Images not showing on mobile?**
→ Restart Metro: `npx expo start --clear`
→ Check files are in assets/images/carousel/
→ Rebuild app

**Need help?**
→ See IMAGE_SETUP_GUIDE.md for detailed instructions
→ See CAROUSEL_IMPLEMENTATION.md for complete documentation

---

That's it! Just copy the 4 images to those 2 folders and you're done! 🎉
