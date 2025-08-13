# 🚀 OpenAI API Setup Guide for IndicBERT v2

## 🎯 **What You'll Get After Setup:**

✅ **Real AI responses** instead of basic fallback messages  
✅ **Intelligent answers** to your questions  
✅ **Multilingual support** with cultural awareness  
✅ **Interactive chat** like ChatGPT but specialized for Indic languages  

## 🔑 **Step 1: Get Your OpenAI API Key**

### **Option A: Free Trial (Recommended for testing)**
1. Go to [OpenAI Platform](https://platform.openai.com/)
2. Click "Sign Up" and create an account
3. Verify your email
4. Go to [API Keys](https://platform.openai.com/api-keys)
5. Click "Create new secret key"
6. **Copy the key** (it starts with `sk-...`)

### **Option B: Paid Account**
1. Add payment method to your OpenAI account
2. Get higher rate limits and access to more models

## ⚙️ **Step 2: Set Up Your Environment**

### **Windows (Command Prompt)**
```cmd
set OPENAI_API_KEY=sk-your-actual-api-key-here
```

### **Windows (PowerShell)**
```powershell
$env:OPENAI_API_KEY="sk-your-actual-api-key-here"
```

### **Create .env file (Recommended)**
1. Create a file named `.env` in your project folder
2. Add this line:
```
OPENAI_API_KEY=sk-your-actual-api-key-here
```

## 🚀 **Step 3: Install OpenAI Package**

```cmd
pip install openai
```

## 🎯 **Step 4: Test Your Setup**

### **Stop the current system** (Ctrl+C in your terminal)

### **Start the new working version:**
```cmd
python working_web_demo.py
```

### **You should see:**
```
🚀 Starting Working IndicBERT v2 Web Demo...
This version provides real AI responses!
✅ OpenAI API integration enabled
🌐 Open http://localhost:5000 in your browser
💬 Start chatting with real AI responses!
```

## 🧪 **Step 5: Test Real AI Responses**

### **Try these questions:**
- "When is the next ekadashi?" → Should get detailed Hindu calendar info
- "What is Chaturmasya?" → Should get spiritual explanation
- "Today's date?" → Should get current date
- "ನಮಸ್ಕಾರ" (Kannada) → Should get proper response

## 🔍 **Expected Results:**

### **Before (Basic Mode):**
```
AI: I understand you said: 'when is the next ekadashi' in english. 
     This is a basic response from the minimal system...
```

### **After (OpenAI Mode):**
```
AI: Ekadashi is the eleventh lunar day in the Hindu calendar. 
     The next Ekadashi typically occurs every 15 days. 
     For the exact date, you can check a Hindu calendar or Panchang.
```

## 🆘 **Troubleshooting:**

### **"No OpenAI API key found"**
- Check if you set the environment variable correctly
- Restart your terminal after setting the variable
- Use the `.env` file method instead

### **"OpenAI API failed"**
- Check your internet connection
- Verify your API key is correct
- Check if you have credits in your OpenAI account

### **"Module not found: openai"**
- Run: `pip install openai`

## 💰 **Cost Information:**

- **Free trial**: $5 credit (usually lasts for testing)
- **Paid**: Pay per use (very cheap for chat)
- **Typical cost**: $0.002 per 1K tokens (very affordable)

## 🎉 **You're Ready!**

After setup, your chat will:
- ✅ Give intelligent responses to any question
- ✅ Understand context and provide helpful answers
- ✅ Support multiple languages with cultural awareness
- ✅ Work like a professional AI assistant

**Start with the free trial and upgrade when you're ready!** 🚀✨
