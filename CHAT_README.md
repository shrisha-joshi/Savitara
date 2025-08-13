# IndicBERT v2 AI Chat Assistant

A complete multilingual AI chat application similar to ChatGPT or Gemini, built with IndicBERT v2 models and featuring fine-tuning capabilities.

## 🚀 Features

### 💬 **AI Chat Interface**
- **Real-time Chat**: Interactive chat interface with AI responses
- **Multilingual Support**: Chat in 23+ Indic languages and English
- **Voice Input**: Record voice messages (microphone required)
- **Text-to-Speech**: AI responses converted to speech in selected language
- **Smart Responses**: Context-aware AI responses using IndicBERT v2 models

### 🎯 **Model Management**
- **Multiple Models**: Choose from 4 different IndicBERT v2 variants
- **Dynamic Loading**: Load/unload models on-the-fly
- **Model Selection**: Easy switching between different model types
- **Performance Monitoring**: Real-time model status and performance

### 🌐 **Language Support**
- **Primary Languages**: Hindi, English, Bengali, Tamil, Telugu, Marathi
- **Extended Support**: Gujarati, Kannada, Malayalam, Punjabi, Odia, Assamese
- **Language Switching**: Seamless language switching during chat
- **Localized UI**: Interface adapts to selected language

### 🔧 **Fine-tuning Capabilities**
- **File Upload**: Drag & drop or click to upload training data
- **Supported Formats**: JSON, CSV, TXT files
- **Training Progress**: Real-time training progress monitoring
- **Model Export**: Save and deploy fine-tuned models
- **Background Processing**: Non-blocking training operations

## 🏃‍♂️ Quick Start

### 1. **Installation**
```bash
# Clone the repository
git clone <repository-url>
cd IndicBERTv2

# Install dependencies
pip install -r enhanced_requirements.txt
```

### 2. **Start the Chat Assistant**
```bash
# Start the chat interface
python start_chat.py

# Or start the web demo directly
python web_demo.py
```

### 3. **Access the Interface**
- **Main Chat**: http://localhost:5000 (New chat interface)
- **Original Demo**: http://localhost:5000/demo (Legacy interface)

## 💻 Usage Guide

### **Starting a Chat**
1. **Select Model**: Choose your preferred IndicBERT v2 model from the sidebar
2. **Choose Language**: Select your preferred language for interaction
3. **Type Message**: Enter your message in the chat input box
4. **Send**: Click send button or press Enter
5. **Get Response**: AI will respond in the selected language

### **Voice Features**
1. **Voice Input**: Click the microphone button to record voice
2. **Speak**: Record your message
3. **Stop Recording**: Click the stop button
4. **Auto-Transcription**: Voice is automatically converted to text
5. **Text-to-Speech**: AI responses can be converted to speech

### **Fine-tuning Process**
1. **Upload Data**: Drag & drop your training data file
2. **Configure**: Set training parameters (epochs, learning rate)
3. **Start Training**: Click "Start Fine-tuning" button
4. **Monitor Progress**: Watch real-time training progress
5. **Use Model**: Fine-tuned model becomes available for chat

## 🎨 Interface Layout

### **Left Sidebar**
- **Model Selection**: Choose from available IndicBERT v2 models
- **Language Picker**: Select your preferred language
- **Fine-tuning Panel**: Upload data and start training

### **Main Chat Area**
- **Chat Header**: Application title and description
- **Message Thread**: Scrollable chat history
- **Input Area**: Text input, voice button, and send button
- **Language Buttons**: Quick language switching

### **Responsive Design**
- **Desktop**: Full sidebar + chat layout
- **Mobile**: Collapsible sidebar for mobile devices
- **Tablet**: Adaptive layout for medium screens

## 🔌 API Endpoints

### **Chat & Inference**
- `POST /api/inference` - Run AI inference on text
- `POST /api/load_model` - Load specific model
- `GET /api/models` - List available models

### **Fine-tuning**
- `POST /api/fine_tune` - Start fine-tuning process
- `GET /api/training_status/<id>` - Check training progress

### **Utilities**
- `GET /api/languages` - List supported languages
- `GET /api/tasks` - List available NLP tasks

## 📁 File Structure

```
IndicBERTv2/
├── templates/
│   ├── chat_interface.html    # New chat interface
│   └── index.html             # Original demo interface
├── web_demo.py                # Enhanced Flask application
├── start_chat.py              # Chat startup script
├── train_indicbert.py         # Command-line training script
├── enhanced_requirements.txt  # Python dependencies
└── CHAT_README.md            # This file
```

## 🌟 Key Benefits

### **For Users**
- **Natural Conversation**: Chat naturally in your preferred language
- **Voice Interaction**: Use voice for hands-free operation
- **Multilingual**: Switch between languages seamlessly
- **Real-time**: Instant AI responses

### **For Developers**
- **Fine-tuning**: Customize models for specific tasks
- **API Access**: RESTful API for integration
- **Extensible**: Easy to add new features
- **Open Source**: Full access to source code

### **For Researchers**
- **Model Comparison**: Test different IndicBERT v2 variants
- **Performance Analysis**: Monitor model performance
- **Custom Training**: Fine-tune on domain-specific data
- **Experiment Tracking**: Monitor training progress

## 🚨 Troubleshooting

### **Common Issues**

1. **Model Loading Errors**
   - Check internet connection
   - Verify model names in AVAILABLE_MODELS
   - Clear browser cache if needed

2. **Voice Recording Issues**
   - Check microphone permissions
   - Ensure browser supports MediaRecorder API
   - Try refreshing the page

3. **Fine-tuning Failures**
   - Verify data format (JSON/CSV)
   - Check file size and content
   - Monitor system resources

4. **Performance Issues**
   - Use smaller models for faster responses
   - Enable GPU acceleration if available
   - Monitor memory usage

### **Getting Help**
- Check browser console for error messages
- Verify all dependencies are installed
- Check network connectivity
- Review log files for detailed errors

## 🔮 Future Enhancements

### **Planned Features**
- **Advanced Voice Recognition**: Better speech-to-text accuracy
- **Multi-modal Support**: Image and document understanding
- **Conversation Memory**: Remember chat context
- **User Authentication**: Personalized chat experiences
- **Model Sharing**: Share fine-tuned models

### **Integration Possibilities**
- **Slack/Discord Bots**: Chat platform integration
- **Mobile Apps**: Native mobile applications
- **Enterprise Features**: Team collaboration tools
- **API Services**: Cloud-based API endpoints

## 📚 Additional Resources

### **Documentation**
- [IndicBERT v2 Paper](https://arxiv.org/abs/2103.07402)
- [Hugging Face Models](https://huggingface.co/ai4bharat)
- [Flask Documentation](https://flask.palletsprojects.com/)
- [Transformers Library](https://huggingface.co/docs/transformers/)

### **Community**
- [AI4Bharat GitHub](https://github.com/ai4bharat)
- [Indic NLP Library](https://github.com/ai4bharat/indic_nlp_library)
- [Discord Community](https://discord.gg/ai4bharat)

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- **AI4Bharat** for the IndicBERT v2 models
- **Hugging Face** for the transformers library
- **Flask** for the web framework
- **Open Source Community** for contributions

---

**🎉 Ready to chat with IndicBERT v2? Start the application and begin your multilingual AI conversation!**

For questions and support, please open an issue on GitHub or join our community discussions.
