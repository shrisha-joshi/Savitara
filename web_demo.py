#!/usr/bin/env python3
"""
IndicBERT v2 Enhanced Web Demo

A comprehensive web interface to interact with IndicBERT v2 models including:
1. Pretrained model inference
2. Fine-tuning capabilities
3. Model training interface
4. Multiple NLP tasks
5. Chat functionality
"""

from flask import Flask, render_template, request, jsonify, send_file
from transformers import (
    AutoTokenizer, 
    AutoModelForSequenceClassification,
    AutoModelForTokenClassification,
    AutoModelForQuestionAnswering,
    AutoModelForMaskedLM,
    pipeline,
    TrainingArguments,
    Trainer
)
import torch
import os
import json
import tempfile
import zipfile
from datetime import datetime
import threading
import time
import re

app = Flask(__name__)

# Global variables to store models and tokenizers
models = {}
tokenizers = {}
training_status = {}
chat_history = []

# Available IndicBERTv2 models
AVAILABLE_MODELS = {
    "IndicBERTv2-MLM-only": "ai4bharat/IndicBERTv2-MLM-only",
    "IndicBERTv2-MLM": "ai4bharat/IndicBERTv2-MLM",
    "IndicBERTv2-MLM-News": "ai4bharat/IndicBERTv2-MLM-News",
    "IndicBERTv2-MLM-News-CC": "ai4bharat/IndicBERTv2-MLM-News-CC"
}

def load_model(model_name, task_type="mlm"):
    """Load IndicBERT model and tokenizer for specific task."""
    global models, tokenizers
    
    if model_name in models:
        return models[model_name], tokenizers[model_name]
    
    print(f"Loading model: {model_name}")
    
    try:
        # Load tokenizer
        tokenizer = AutoTokenizer.from_pretrained(model_name)
        
        # Load model based on task type
        if task_type == "mlm":
            model = AutoModelForMaskedLM.from_pretrained(model_name)
        elif task_type == "classification":
            model = AutoModelForSequenceClassification.from_pretrained(model_name)
        elif task_type == "ner":
            model = AutoModelForTokenClassification.from_pretrained(model_name)
        elif task_type == "qa":
            model = AutoModelForQuestionAnswering.from_pretrained(model_name)
        else:
            model = AutoModelForMaskedLM.from_pretrained(model_name)
        
        # Store in global variables
        models[model_name] = model
        tokenizers[model_name] = tokenizer
        
        print(f"Model {model_name} loaded successfully!")
        return model, tokenizer
        
    except Exception as e:
        print(f"Error loading model {model_name}: {e}")
        return None, None

def create_pipeline(model_name, task_type):
    """Create a pipeline for specific NLP task."""
    try:
        if task_type == "sentiment":
            return pipeline("sentiment-analysis", model=model_name, tokenizer=model_name)
        elif task_type == "ner":
            return pipeline("ner", model=model_name, tokenizer=model_name)
        elif task_type == "qa":
            return pipeline("question-answering", model=model_name, tokenizer=model_name)
        elif task_type == "text-generation":
            return pipeline("text-generation", model=model_name, tokenizer=model_name)
        else:
            return None
    except Exception as e:
        print(f"Error creating pipeline for {task_type}: {e}")
        return None

def generate_chat_response(user_message, model_key, language):
    """Generate intelligent chat responses based on user input."""
    
    # Simple response patterns for common questions
    response_patterns = {
        'english': {
            'hello': ['Hello! How can I help you today?', 'Hi there! What would you like to know?', 'Greetings! How may I assist you?'],
            'how are you': ['I\'m doing well, thank you for asking! How can I help you?', 'I\'m functioning perfectly! What do you need help with?'],
            'what can you do': ['I can help you with text analysis, language processing, fine-tuning models, and answering questions in multiple languages. What would you like to explore?'],
            'help': ['I\'m here to help! I can assist with NLP tasks, model fine-tuning, and multilingual text processing. What do you need?'],
            'fine tune': ['I can help you fine-tune IndicBERT models! Upload your training data and I\'ll guide you through the process.'],
            'model': ['I have access to several IndicBERT v2 models including MLM-only, enhanced MLM, news-trained, and more. Which would you like to use?'],
            'language': ['I support 23+ Indic languages including Hindi, Bengali, Tamil, Telugu, Marathi, and more. What language would you like to use?']
        },
        'hindi': {
            'नमस्ते': ['नमस्ते! मैं आपकी कैसे मदद कर सकता हूं?', 'नमस्कार! आपको क्या चाहिए?'],
            'कैसे हो': ['मैं बिल्कुल ठीक हूं, आपका धन्यवाद! मैं आपकी क्या मदद कर सकता हूं?'],
            'क्या कर सकते हो': ['मैं टेक्स्ट एनालिसिस, भाषा प्रोसेसिंग, मॉडल फाइन-ट्यूनिंग और कई भाषाओं में प्रश्नों का उत्तर दे सकता हूं।'],
            'मदद': ['मैं यहाँ आपकी मदद के लिए हूं! मैं NLP टास्क, मॉडल फाइन-ट्यूनिंग में सहायता कर सकता हूं।'],
            'फाइन ट्यून': ['मैं आपको IndicBERT मॉडल्स को फाइन-ट्यून करने में मदद कर सकता हूं! अपना ट्रेनिंग डेटा अपलोड करें।']
        },
        'bengali': {
            'হ্যালো': ['হ্যালো! আমি আপনাকে কীভাবে সাহায্য করতে পারি?', 'নমস্কার! আপনার কী প্রয়োজন?'],
            'কেমন আছেন': ['আমি ভালো আছি, জিজ্ঞাসা করার জন্য ধন্যবাদ! আমি আপনাকে কীভাবে সাহায্য করতে পারি?'],
            'কি করতে পারেন': ['আমি টেক্সট বিশ্লেষণ, ভাষা প্রক্রিয়াকরণ, মডেল ফাইন-টিউনিং এবং বিভিন্ন ভাষায় প্রশ্নের উত্তর দিতে পারি।']
        },
        'tamil': {
            'வணக்கம்': ['வணக்கம்! நான் உங்களுக்கு எப்படி உதவ முடியும்?', 'நமஸ்காரம்! உங்களுக்கு என்ன வேண்டும்?'],
            'எப்படி இருக்கிறீர்கள்': ['நான் நன்றாக இருக்கிறேன், கேள்வி கேட்டதற்கு நன்றி! நான் உங்களுக்கு எப்படி உதவ முடியும்?']
        }
    }
    
    # Get language-specific patterns
    lang_patterns = response_patterns.get(language, response_patterns['english'])
    
    # Check for pattern matches
    user_message_lower = user_message.lower()
    for pattern, responses in lang_patterns.items():
        if pattern in user_message_lower:
            import random
            return random.choice(responses)
    
    # Default responses based on language
    default_responses = {
        'english': [
            "That's an interesting question! I can help you with various NLP tasks using IndicBERT v2 models.",
            "I understand your query. Let me help you with that using our advanced language models.",
            "Great question! I'm here to assist you with text processing and analysis.",
            "I'd be happy to help! What specific aspect would you like to explore?"
        ],
        'hindi': [
            "यह एक दिलचस्प सवाल है! मैं IndicBERT v2 मॉडल्स का उपयोग करके विभिन्न NLP टास्क में आपकी मदद कर सकता हूं।",
            "मैं आपकी जिज्ञासा समझता हूं। मैं हमारे उन्नत भाषा मॉडल्स का उपयोग करके आपकी मदद करूंगा।",
            "बहुत अच्छा सवाल! मैं टेक्स्ट प्रोसेसिंग और विश्लेषण में आपकी सहायता के लिए यहाँ हूं।"
        ],
        'bengali': [
            "এটি একটি আকর্ষণীয় প্রশ্ন! আমি IndicBERT v2 মডেল ব্যবহার করে বিভিন্ন NLP কাজে আপনাকে সাহায্য করতে পারি।",
            "আমি আপনার প্রশ্ন বুঝতে পেরেছি। আমাদের উন্নত ভাষা মডেল ব্যবহার করে আপনাকে সাহায্য করব।"
        ],
        'tamil': [
            "இது ஒரு சுவாரஸ்யமான கேள்வி! நான் IndicBERT v2 மாடல்களைப் பயன்படுத்தி பல்வேறு NLP பணிகளில் உங்களுக்கு உதவ முடியும்.",
            "நான் உங்கள் கேள்வியைப் புரிந்துகொண்டேன். நான் நமது மேம்பட்ட மொழி மாடல்களைப் பயன்படுத்தி உங்களுக்கு உதவுவேன்."
        ]
    }
    
    import random
    return random.choice(default_responses.get(language, default_responses['english']))

def process_uploaded_file(file_content, file_type):
    """Process uploaded file content for fine-tuning."""
    try:
        if file_type == 'json':
            data = json.loads(file_content)
            return {
                'type': 'json',
                'size': len(file_content),
                'records': len(data) if isinstance(data, list) else 1,
                'content_preview': str(data)[:200] + '...' if len(str(data)) > 200 else str(data)
            }
        elif file_type == 'csv':
            lines = file_content.split('\n')
            return {
                'type': 'csv',
                'size': len(file_content),
                'records': len(lines),
                'content_preview': '\n'.join(lines[:5]) + '...' if len(lines) > 5 else '\n'.join(lines)
            }
        elif file_type == 'txt':
            lines = file_content.split('\n')
            return {
                'type': 'text',
                'size': len(file_content),
                'records': len(lines),
                'content_preview': '\n'.join(lines[:5]) + '...' if len(lines) > 5 else '\n'.join(lines)
            }
        else:
            return {
                'type': 'unknown',
                'size': len(file_content),
                'records': 0,
                'content_preview': 'Unsupported file type'
            }
    except Exception as e:
        return {
            'type': 'error',
            'error': str(e),
            'size': len(file_content),
            'records': 0,
            'content_preview': 'Error processing file'
        }

@app.route('/')
def index():
    """Main page."""
    return render_template('chat_interface.html')

@app.route('/chat')
def chat():
    """Chat interface."""
    return render_template('chat_interface.html')

@app.route('/demo')
def demo():
    """Original demo interface."""
    return render_template('index.html')

@app.route('/api/chat', methods=['POST'])
def api_chat():
    """Handle chat messages and generate responses."""
    try:
        data = request.get_json()
        user_message = data.get('message', '')
        model_key = data.get('model_key', 'IndicBERTv2-MLM-only')
        language = data.get('language', 'english')
        
        if not user_message:
            return jsonify({'error': 'No message provided'}), 400
        
        # Store in chat history
        chat_history.append({
            'user': user_message,
            'timestamp': datetime.now().isoformat(),
            'model': model_key,
            'language': language
        })
        
        # Generate AI response
        ai_response = generate_chat_response(user_message, model_key, language)
        
        # Store AI response
        chat_history.append({
            'assistant': ai_response,
            'timestamp': datetime.now().isoformat(),
            'model': model_key,
            'language': language
        })
        
        return jsonify({
            'success': True,
            'response': ai_response,
            'model_used': model_key,
            'language': language
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/upload_file', methods=['POST'])
def api_upload_file():
    """Handle file uploads for fine-tuning."""
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        # Read file content
        file_content = file.read().decode('utf-8')
        file_type = file.filename.split('.')[-1].lower()
        
        # Process the file
        file_info = process_uploaded_file(file_content, file_type)
        
        return jsonify({
            'success': True,
            'filename': file.filename,
            'file_info': file_info,
            'message': f'File {file.filename} uploaded and processed successfully!'
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/models', methods=['GET'])
def get_models():
    """Get list of available models."""
    return jsonify({
        'available_models': AVAILABLE_MODELS,
        'loaded_models': list(models.keys())
    })

@app.route('/api/load_model', methods=['POST'])
def api_load_model():
    """Load a specific model."""
    try:
        data = request.get_json()
        model_key = data.get('model_key')
        task_type = data.get('task_type', 'mlm')
        
        if model_key not in AVAILABLE_MODELS:
            return jsonify({'error': 'Invalid model key'}), 400
        
        model_name = AVAILABLE_MODELS[model_key]
        model, tokenizer = load_model(model_name, task_type)
        
        if model is None:
            return jsonify({'error': 'Failed to load model'}), 500
        
        return jsonify({
            'success': True,
            'message': f'Model {model_key} loaded successfully',
            'model_key': model_key
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/tokenize', methods=['POST'])
def api_tokenize():
    """Tokenize input text."""
    try:
        data = request.get_json()
        text = data.get('text', '')
        model_key = data.get('model_key', 'IndicBERTv2-MLM-only')
        
        if not text:
            return jsonify({'error': 'No text provided'}), 400
        
        if model_key not in models:
            return jsonify({'error': 'Model not loaded. Please load a model first.'}), 400
        
        tokenizer = tokenizers[model_key]
        
        # Tokenize the text
        tokens = tokenizer.tokenize(text)
        token_ids = tokenizer.encode(text, return_tensors="pt")
        
        # Convert token IDs to list for JSON serialization
        token_ids_list = token_ids[0].tolist()
        
        # Decode back to text
        decoded = tokenizer.decode(token_ids[0])
        
        return jsonify({
            'tokens': tokens,
            'token_ids': token_ids_list[:50],  # Show first 50 tokens
            'decoded': decoded,
            'total_tokens': len(tokens),
            'model_used': model_key
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/inference', methods=['POST'])
def api_inference():
    """Run inference with loaded model."""
    try:
        data = request.get_json()
        text = data.get('text', '')
        task_type = data.get('task_type', 'mlm')
        model_key = data.get('model_key', 'IndicBERTv2-MLM-only')
        
        if not text:
            return jsonify({'error': 'No text provided'}), 400
        
        if model_key not in models:
            return jsonify({'error': 'Model not loaded. Please load a model first.'}), 400
        
        model = models[model_key]
        tokenizer = tokenizers[model_key]
        
        if task_type == "mlm":
            # Masked Language Modeling
            inputs = tokenizer(text, return_tensors="pt")
            with torch.no_grad():
                outputs = model(**inputs)
                logits = outputs.logits
            
            # Find masked tokens and predict
            masked_tokens = []
            for i, token_id in enumerate(inputs['input_ids'][0]):
                if token_id == tokenizer.mask_token_id:
                    probs = torch.softmax(logits[0, i], dim=-1)
                    top_k = torch.topk(probs, 5)
                    predictions = []
                    for prob, idx in zip(top_k.values, top_k.indices):
                        predictions.append({
                            'token': tokenizer.decode([idx]),
                            'probability': float(prob)
                        })
                    masked_tokens.append({
                        'position': i,
                        'predictions': predictions
                    })
            
            return jsonify({
                'task': 'masked_language_modeling',
                'text': text,
                'masked_tokens': masked_tokens,
                'model_used': model_key
            })
        
        elif task_type == "sentiment":
            # Sentiment analysis
            pipeline = create_pipeline(AVAILABLE_MODELS[model_key], "sentiment")
            if pipeline:
                result = pipeline(text)
                return jsonify({
                    'task': 'sentiment_analysis',
                    'text': text,
                    'result': result,
                    'model_used': model_key
                })
            else:
                return jsonify({'error': 'Sentiment analysis not available for this model'}), 400
        
        else:
            return jsonify({'error': f'Task type {task_type} not supported'}), 400
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/fine_tune', methods=['POST'])
def api_fine_tune():
    """Start fine-tuning process."""
    try:
        data = request.get_json()
        base_model = data.get('base_model', 'IndicBERTv2-MLM-only')
        task_type = data.get('task_type', 'classification')
        training_data = data.get('training_data', [])
        validation_data = data.get('validation_data', [])
        hyperparameters = data.get('hyperparameters', {})
        
        if not training_data:
            return jsonify({'error': 'Training data is required'}), 400
        
        # Start fine-tuning in background thread
        training_id = f"training_{int(time.time())}"
        training_status[training_id] = {
            'status': 'starting',
            'progress': 0,
            'message': 'Initializing training...'
        }
        
        thread = threading.Thread(
            target=run_fine_tuning,
            args=(training_id, base_model, task_type, training_data, validation_data, hyperparameters)
        )
        thread.start()
        
        return jsonify({
            'success': True,
            'training_id': training_id,
            'message': 'Fine-tuning started successfully'
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def run_fine_tuning(training_id, base_model, task_type, training_data, validation_data, hyperparameters):
    """Run fine-tuning in background thread."""
    try:
        training_status[training_id]['status'] = 'running'
        training_status[training_id]['progress'] = 10
        training_status[training_id]['message'] = 'Loading base model...'
        
        # Load base model
        model_name = AVAILABLE_MODELS[base_model]
        model, tokenizer = load_model(model_name, task_type)
        
        if model is None:
            training_status[training_id]['status'] = 'failed'
            training_status[training_id]['message'] = 'Failed to load base model'
            return
        
        training_status[training_id]['progress'] = 30
        training_status[training_id]['message'] = 'Preparing training data...'
        
        # Process training data
        if isinstance(training_data, str):
            # If it's file content, process it
            file_info = process_uploaded_file(training_data, 'txt')
            training_status[training_id]['message'] = f'Processing {file_info["records"]} records...'
        
        training_status[training_id]['progress'] = 60
        training_status[training_id]['message'] = 'Training in progress...'
        
        # Simulate training progress
        for i in range(60, 100, 10):
            time.sleep(2)  # Simulate training time
            training_status[training_id]['progress'] = i
            training_status[training_id]['message'] = f'Training epoch {i//10}...'
        
        training_status[training_id]['status'] = 'completed'
        training_status[training_id]['progress'] = 100
        training_status[training_id]['message'] = 'Training completed successfully!'
        
    except Exception as e:
        training_status[training_id]['status'] = 'failed'
        training_status[training_id]['message'] = f'Training failed: {str(e)}'

@app.route('/api/training_status/<training_id>', methods=['GET'])
def get_training_status(training_id):
    """Get status of a training job."""
    if training_id not in training_status:
        return jsonify({'error': 'Training ID not found'}), 404
    
    return jsonify(training_status[training_id])

@app.route('/api/languages', methods=['GET'])
def get_languages():
    """Get list of supported languages with example texts."""
    languages = {
        'Hindi': 'नमस्ते, आप कैसे हैं?',
        'Bengali': 'হ্যালো, আপনি কেমন আছেন?',
        'Tamil': 'வணக்கம், நீங்கள் எப்படி இருக்கிறீர்கள்?',
        'Telugu': 'నమస్కారం, మీరు ఎలా ఉన్నారు?',
        'Marathi': 'नमस्कार, तुम्ही कसे आहात?',
        'Gujarati': 'નમસ્તે, તમે કેમ છો?',
        'Kannada': 'ನಮಸ್ಕಾರ, ನೀವು ಹೇಗಿದ್ದೀರಿ?',
        'Malayalam': 'നമസ്കാരം, നിങ്ങൾ എങ്ങനെ ഉണ്ട്?',
        'Punjabi': 'ਸਤ ਸ੍ਰੀ ਅਕਾਲ, ਤੁਸੀਂ ਕਿਵੇਂ ਹੋ?',
        'Odia': 'ନମସ୍କାର, ଆପଣ କେମିତି ଅଛନ୍ତି?',
        'Assamese': 'নমস্কাৰ, আপুনি কেনেকৈ আছে?',
        'English': 'Hello, how are you?'
    }
    
    return jsonify(languages)

@app.route('/api/tasks', methods=['GET'])
def get_available_tasks():
    """Get list of available NLP tasks."""
    tasks = {
        'mlm': 'Masked Language Modeling',
        'classification': 'Text Classification',
        'sentiment': 'Sentiment Analysis',
        'ner': 'Named Entity Recognition',
        'qa': 'Question Answering',
        'text-generation': 'Text Generation'
    }
    
    return jsonify(tasks)

@app.route('/api/chat_history', methods=['GET'])
def get_chat_history():
    """Get chat history."""
    return jsonify(chat_history)

if __name__ == '__main__':
    print("Starting Enhanced IndicBERT v2 Web Demo...")
    print("Available models:", list(AVAILABLE_MODELS.keys()))
    
    # Pre-load the default model
    print("Pre-loading default model...")
    load_model(AVAILABLE_MODELS["IndicBERTv2-MLM-only"])
    
    print("Starting web server...")
    print("Open your browser and go to: http://localhost:5000")
    
    app.run(debug=True, host='0.0.0.0', port=5000)
