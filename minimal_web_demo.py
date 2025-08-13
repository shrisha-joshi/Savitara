#!/usr/bin/env python3
"""
Minimal Working Web Demo for IndicBERT v2

This is a simplified version that works without complex dependencies.
"""

import os
import json
import logging
import uuid
from datetime import datetime
from flask import Flask, render_template, request, jsonify, session

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.secret_key = 'indicbert-v2-secret-key-2024'

# Simple in-memory storage
chat_sessions = {}
uploaded_files = []
file_counter = 0

@app.route('/')
def index():
    """Main page."""
    return render_template('index.html')

@app.route('/api/chat', methods=['POST'])
def chat():
    """Handle chat requests."""
    try:
        data = request.get_json()
        user_message = data.get('message', '').strip()
        model_name = data.get('model_name', 'IndicBERTv2-MLM-only')
        language = data.get('language', 'english')
        
        if not user_message:
            return jsonify({'success': False, 'error': 'No message provided'})
        
        # Generate session ID if not exists
        if 'session_id' not in session:
            session['session_id'] = str(uuid.uuid4())
        
        session_id = session['session_id']
        
        # Generate a simple response
        if "hello" in user_message.lower():
            ai_response = f"Hello! I'm your IndicBERT v2 AI Assistant. How can I help you today in {language}?"
        elif "bye" in user_message.lower():
            ai_response = f"Goodbye! Have a great day in {language}!"
        elif "namaskar" in user_message.lower():
            ai_response = f"Namaskar! 🙏 I'm here to help you with IndicBERT v2. How can I assist you today?"
        else:
            ai_response = f"I understand you said: '{user_message}' in {language}. This is a basic response from the minimal system. For enhanced responses, you can add OpenAI integration or fine-tuned models."
        
        # Store chat session
        if session_id not in chat_sessions:
            chat_sessions[session_id] = []
        
        chat_sessions[session_id].append({
            'timestamp': datetime.now().isoformat(),
            'user_message': user_message,
            'ai_response': ai_response,
            'model_used': model_name,
            'response_source': 'basic'
        })
        
        return jsonify({
            'success': True,
            'response': {
                'routing_decision': 'basic_only',
                'response_source': 'basic',
                'content': ai_response
            },
            'session_id': session_id
        })
        
    except Exception as e:
        logger.error(f"Chat error: {e}")
        return jsonify({'success': False, 'error': str(e)})

@app.route('/api/upload_file', methods=['POST'])
def upload_file():
    """Handle file upload."""
    try:
        if 'file' not in request.files:
            return jsonify({'success': False, 'error': 'No file provided'})
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'success': False, 'error': 'No file selected'})
        
        # Read file data
        file_data = file.read()
        filename = file.filename
        
        global file_counter
        file_counter += 1
        file_id = f"file_{file_counter}"
        
        # Store file info
        file_info = {
            'id': file_id,
            'filename': filename,
            'size': len(file_data),
            'upload_date': datetime.now().isoformat(),
            'status': 'uploaded'
        }
        
        uploaded_files.append(file_info)
        
        return jsonify({
            'success': True,
            'file_id': file_id,
            'message': 'File uploaded successfully (basic mode)'
        })
        
    except Exception as e:
        logger.error(f"File upload error: {e}")
        return jsonify({'success': False, 'error': str(e)})

@app.route('/api/files')
def list_files():
    """List uploaded files."""
    try:
        return jsonify({
            'success': True,
            'files': uploaded_files
        })
    except Exception as e:
        logger.error(f"File listing error: {e}")
        return jsonify({'success': False, 'error': str(e)})

@app.route('/api/models')
def list_models():
    """List available models."""
    try:
        basic_models = [
            {
                'version': 'IndicBERTv2-MLM-only',
                'status': 'available',
                'created_date': datetime.now().isoformat(),
                'description': 'Base MLM Model (Basic Mode)'
            },
            {
                'version': 'IndicBERTv2-MLM',
                'status': 'available',
                'created_date': datetime.now().isoformat(),
                'description': 'Enhanced MLM Model (Basic Mode)'
            }
        ]
        
        return jsonify({
            'success': True,
            'models': basic_models,
            'message': 'Showing basic models (minimal mode)'
        })
        
    except Exception as e:
        logger.error(f"Model listing error: {e}")
        return jsonify({'success': False, 'error': str(e)})

@app.route('/api/fine_tuning_data')
def list_fine_tuning_data():
    """List fine-tuning data."""
    try:
        # Return empty list for basic mode
        return jsonify({
            'success': True,
            'data': [],
            'message': 'Fine-tuning not available in basic mode'
        })
    except Exception as e:
        logger.error(f"Fine-tuning data listing error: {e}")
        return jsonify({'success': False, 'error': str(e)})

@app.route('/api/chat_history/<session_id>')
def get_chat_history(session_id):
    """Get chat history for a session."""
    try:
        if session_id in chat_sessions:
            return jsonify({
                'success': True,
                'history': chat_sessions[session_id]
            })
        else:
            return jsonify({
                'success': True,
                'history': []
            })
    except Exception as e:
        logger.error(f"Chat history error: {e}")
        return jsonify({'success': False, 'error': str(e)})

@app.errorhandler(404)
def not_found(error):
    return jsonify({'success': False, 'error': 'Endpoint not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'success': False, 'error': 'Internal server error'}), 500

if __name__ == '__main__':
    print("🚀 Starting Minimal IndicBERT v2 Web Demo...")
    print("This is a basic working version without complex dependencies.")
    print("Open http://localhost:5000 in your browser")
    
    app.run(
        host='127.0.0.1',
        port=5000,
        debug=True,
        threaded=True
    )
