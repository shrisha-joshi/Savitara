#!/usr/bin/env python3
"""
Enhanced IndicBERT v2 Web Demo with MongoDB and OpenAI Integration

This enhanced version includes:
1. MongoDB-based file storage and fine-tuning data management
2. Automatic fine-tuning of IndicBERT v2 models
3. OpenAI API integration for fallback responses
4. Multilingual support with language detection
5. Real-time fine-tuning status updates
6. Chat interface with hybrid response system
"""

import os
import json
import logging
import uuid
from datetime import datetime
from typing import Dict, List, Optional, Any
from flask import Flask, render_template, request, jsonify, send_file, session
from werkzeug.utils import secure_filename
import threading
import time

# Import our custom modules
from database import get_database, init_database
from fine_tuning_processor import get_fine_tuning_manager
from openai_integration import get_openai_handler, get_query_router

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.secret_key = os.getenv('FLASK_SECRET_KEY', 'indicbert-v2-secret-key-2024')

# Global variables
models = {}
tokenizers = {}
fine_tuning_manager = None
openai_handler = None
query_router = None

# Available IndicBERTv2 models
AVAILABLE_MODELS = {
    "IndicBERTv2-MLM-only": "ai4bharat/IndicBERTv2-MLM-only",
    "IndicBERTv2-MLM": "ai4bharat/IndicBERTv2-MLM",
    "IndicBERTv2-MLM-News": "ai4bharat/IndicBERTv2-MLM-News",
    "IndicBERTv2-MLM-News-CC": "ai4bharat/IndicBERTv2-MLM-News-CC"
}

# Supported file types for fine-tuning
SUPPORTED_FILE_TYPES = {
    'text/plain': ['.txt'],
    'text/csv': ['.csv'],
    'application/json': ['.json']
}

def initialize_system():
    """Initialize the system components."""
    global fine_tuning_manager, openai_handler, query_router
    
    try:
        # Initialize database
        try:
            db = init_database()
            logger.info("Database initialized successfully")
        except Exception as e:
            logger.warning(f"Database initialization failed: {e}")
            db = None
        
        # Initialize fine-tuning manager
        if db:
            try:
                fine_tuning_manager = get_fine_tuning_manager(db)
                logger.info("Fine-tuning manager initialized successfully")
            except Exception as e:
                logger.warning(f"Fine-tuning manager initialization failed: {e}")
                fine_tuning_manager = None
        else:
            fine_tuning_manager = None
            logger.warning("Fine-tuning manager disabled (no database)")
        
        # Initialize OpenAI handler (will fail gracefully if no API key)
        try:
            openai_handler = get_openai_handler()
            query_router = get_query_router(openai_handler)
            logger.info("OpenAI integration initialized successfully")
        except Exception as e:
            logger.warning(f"OpenAI integration failed: {e}")
            openai_handler = None
            query_router = None
        
        logger.info("System initialization completed")
        
    except Exception as e:
        logger.error(f"System initialization failed: {e}")
        # Don't raise, just log the error and continue with basic functionality
        fine_tuning_manager = None
        openai_handler = None
        query_router = None

@app.route('/')
def index():
    """Main page."""
    return render_template('index.html')

@app.route('/api/upload_file', methods=['POST'])
def upload_file():
    """Handle file upload for fine-tuning."""
    try:
        if 'file' not in request.files:
            return jsonify({'success': False, 'error': 'No file provided'})
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'success': False, 'error': 'No file selected'})
        
        # Validate file type
        if not is_valid_file_type(file.filename):
            return jsonify({'success': False, 'error': 'Unsupported file type'})
        
        # Read file data
        file_data = file.read()
        filename = secure_filename(file.filename)
        
        # Try to store file in database
        file_id = None
        try:
            db = get_database()
            file_id = db.store_file(
                file_data=file_data,
                filename=filename,
                file_type=file.content_type or 'text/plain',
                language='multilingual'
            )
            logger.info(f"File stored in database with ID: {file_id}")
        except Exception as db_error:
            logger.warning(f"Database not available for file storage: {db_error}")
            # Generate a temporary file ID
            file_id = f"temp_{int(time.time())}_{hash(filename)}"
            logger.info(f"Using temporary file ID: {file_id}")
        
        # Process file for fine-tuning if manager is available
        if fine_tuning_manager and file_id:
            try:
                processing_result = fine_tuning_manager.process_uploaded_file(
                    file_id=file_id,
                    file_data=file_data,
                    filename=filename,
                    file_type=file.content_type or 'text/plain'
                )
                
                if processing_result['success']:
                    return jsonify({
                        'success': True,
                        'file_id': file_id,
                        'ft_data_id': processing_result['ft_data_id'],
                        'processed_samples': processing_result['processed_samples'],
                        'languages': processing_result['languages'],
                        'message': 'File uploaded and processed successfully'
                    })
                else:
                    return jsonify({
                        'success': False,
                        'error': processing_result['error']
                    })
            except Exception as ft_error:
                logger.warning(f"Fine-tuning processing failed: {ft_error}")
                # Continue without fine-tuning processing
        
        # Return success even without fine-tuning
        return jsonify({
            'success': True,
            'file_id': file_id,
            'message': 'File uploaded successfully (fine-tuning not available)'
        })
        
    except Exception as e:
        logger.error(f"File upload error: {e}")
        return jsonify({'success': False, 'error': str(e)})

@app.route('/api/start_fine_tuning', methods=['POST'])
def start_fine_tuning():
    """Start fine-tuning process."""
    try:
        data = request.get_json()
        model_name = data.get('model_name', 'IndicBERTv2-MLM-only')
        ft_data_ids = data.get('ft_data_ids', [])
        training_args = data.get('training_args', {})
        
        if not ft_data_ids:
            return jsonify({'success': False, 'error': 'No fine-tuning data provided'})
        
        if not fine_tuning_manager:
            return jsonify({'success': False, 'error': 'Fine-tuning manager not available'})
        
        # Start fine-tuning
        training_id = fine_tuning_manager.start_fine_tuning(
            model_name=model_name,
            ft_data_ids=ft_data_ids,
            training_args=training_args
        )
        
        return jsonify({
            'success': True,
            'training_id': training_id,
            'message': 'Fine-tuning started successfully'
        })
        
    except Exception as e:
        logger.error(f"Fine-tuning start error: {e}")
        return jsonify({'success': False, 'error': str(e)})

@app.route('/api/training_status/<training_id>')
def get_training_status(training_id):
    """Get training status."""
    try:
        if not fine_tuning_manager:
            return jsonify({'success': False, 'error': 'Fine-tuning manager not available'})
        
        status = fine_tuning_manager.get_training_status(training_id)
        
        if 'error' in status:
            return jsonify({'success': False, 'error': status['error']})
        
        return jsonify({
            'success': True,
            'status': status
        })
        
    except Exception as e:
        logger.error(f"Training status error: {e}")
        return jsonify({'success': False, 'error': str(e)})

@app.route('/api/chat', methods=['POST'])
def chat():
    """Handle chat requests with hybrid response system."""
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
        
        # First, try to get response from fine-tuned model
        fine_tuned_response = None
        fine_tuned_confidence = None
        
        try:
            # This would be your existing IndicBERT inference logic
            # For now, we'll simulate it
            fine_tuned_response = f"Fine-tuned response for: {user_message}"
            fine_tuned_confidence = 0.6
        except Exception as e:
            logger.warning(f"Fine-tuned model inference failed: {e}")
            fine_tuned_response = None
        
        # Route the query using our hybrid system
        if query_router and fine_tuned_response:
            try:
                routing_result = query_router.route_query(
                    query=user_message,
                    fine_tuned_response=fine_tuned_response,
                    fine_tuned_confidence=fine_tuned_confidence
                )
                
                # Try to store chat session in database
                try:
                    db = get_database()
                    db.store_chat_session(
                        session_id=session_id,
                        user_message=user_message,
                        ai_response=str(routing_result),
                        model_used=model_name,
                        response_source=routing_result.get('response_source', 'unknown')
                    )
                except Exception as db_error:
                    logger.warning(f"Could not store chat session: {db_error}")
                
                return jsonify({
                    'success': True,
                    'response': routing_result,
                    'session_id': session_id
                })
            except Exception as routing_error:
                logger.warning(f"Query routing failed: {routing_error}")
                # Fall through to other options
        
        # Fallback to OpenAI if available
        elif openai_handler:
            try:
                openai_result = openai_handler.query_openai(user_message)
                
                if openai_result['success']:
                    # Try to store chat session in database
                    try:
                        db = get_database()
                        db.store_chat_session(
                            session_id=session_id,
                            user_message=user_message,
                            ai_response=openai_result['response'],
                            model_used=model_name,
                            response_source='openai'
                        )
                    except Exception as db_error:
                        logger.warning(f"Could not store chat session: {db_error}")
                    
                    return jsonify({
                        'success': True,
                        'response': {
                            'routing_decision': 'openai_only',
                            'response_source': 'openai',
                            'content': openai_result['response'],
                            'model': openai_result['model']
                        },
                        'session_id': session_id
                    })
                else:
                    return jsonify({
                        'success': False,
                        'error': openai_result.get('error', 'OpenAI API failed'),
                        'fallback_response': fine_tuned_response
                    })
            except Exception as openai_error:
                logger.warning(f"OpenAI query failed: {openai_error}")
                # Fall through to other options
        
        # Last resort - return fine-tuned response if available
        elif fine_tuned_response:
            # Try to store in database if available
            try:
                db = get_database()
                db.store_chat_session(
                    session_id=session_id,
                    user_message=user_message,
                    ai_response=fine_tuned_response,
                    model_used=model_name,
                    response_source='fine_tuned'
                )
            except Exception as db_error:
                logger.warning(f"Could not store chat session: {db_error}")
            
            return jsonify({
                'success': True,
                'response': {
                    'routing_decision': 'fine_tuned_only',
                    'response_source': 'fine_tuned',
                    'content': fine_tuned_response
                },
                'session_id': session_id
            })
        
        # Ultimate fallback - simple response system
        else:
            fallback_response = generate_fallback_response(user_message, language)
            
            # Try to store in database if available
            try:
                db = get_database()
                db.store_chat_session(
                    session_id=session_id,
                    user_message=user_message,
                    ai_response=fallback_response,
                    model_used=model_name,
                    response_source='fallback'
                )
            except Exception as db_error:
                logger.warning(f"Could not store chat session: {db_error}")
            
            return jsonify({
                'success': True,
                'response': {
                    'routing_decision': 'fallback_only',
                    'response_source': 'fallback',
                    'content': fallback_response
                },
                'session_id': session_id
            })
        
    except Exception as e:
        logger.error(f"Chat error: {e}")
        return jsonify({'success': False, 'error': str(e)})

@app.route('/api/files')
def list_files():
    """List uploaded files."""
    try:
        # Check if database is available
        try:
            db = get_database()
            language = request.args.get('language')
            file_type = request.args.get('file_type')
            
            files = db.list_files(language=language, file_type=file_type)
            
            return jsonify({
                'success': True,
                'files': files
            })
        except Exception as db_error:
            logger.warning(f"Database not available for file listing: {db_error}")
            # Return empty list when database is not available
            return jsonify({
                'success': True,
                'files': [],
                'message': 'Database not available - showing empty file list'
            })
        
    except Exception as e:
        logger.error(f"File listing error: {e}")
        return jsonify({'success': False, 'error': str(e)})

@app.route('/api/fine_tuning_data')
def list_fine_tuning_data():
    """List fine-tuning data."""
    try:
        # Check if database is available
        try:
            db = get_database()
            language = request.args.get('language')
            task_type = request.args.get('task_type')
            
            data = db.get_fine_tuning_data(language=language, task_type=task_type)
            
            return jsonify({
                'success': True,
                'data': data
            })
        except Exception as db_error:
            logger.warning(f"Database not available for fine-tuning data: {db_error}")
            # Return empty list when database is not available
            return jsonify({
                'success': True,
                'data': [],
                'message': 'Database not available - showing empty fine-tuning data list'
            })
        
    except Exception as e:
        logger.error(f"Fine-tuning data listing error: {e}")
        return jsonify({'success': False, 'error': str(e)})

@app.route('/api/models')
def list_models():
    """List available models."""
    try:
        if not fine_tuning_manager:
            # Return basic model list when fine-tuning manager is not available
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
                'message': 'Showing basic models (fine-tuning manager not available)'
            })
        
        models = fine_tuning_manager.list_available_models()
        
        return jsonify({
            'success': True,
            'models': models
        })
        
    except Exception as e:
        logger.error(f"Model listing error: {e}")
        return jsonify({'success': False, 'error': str(e)})

@app.route('/api/openai/cost_summary')
def get_openai_cost_summary():
    """Get OpenAI cost summary."""
    try:
        if not openai_handler:
            return jsonify({'success': False, 'error': 'OpenAI handler not available'})
        
        cost_summary = openai_handler.get_cost_summary()
        
        return jsonify({
            'success': True,
            'cost_summary': cost_summary
        })
        
    except Exception as e:
        logger.error(f"Cost summary error: {e}")
        return jsonify({'success': False, 'error': str(e)})

@app.route('/api/openai/reset_daily_cost', methods=['POST'])
def reset_openai_daily_cost():
    """Reset OpenAI daily cost counter."""
    try:
        if not openai_handler:
            return jsonify({'success': False, 'error': 'OpenAI handler not available'})
        
        openai_handler.reset_daily_cost()
        
        return jsonify({
            'success': True,
            'message': 'Daily cost counter reset successfully'
        })
        
    except Exception as e:
        logger.error(f"Daily cost reset error: {e}")
        return jsonify({'success': False, 'error': str(e)})

@app.route('/api/chat_history/<session_id>')
def get_chat_history(session_id):
    """Get chat history for a session."""
    try:
        # Check if database is available
        try:
            db = get_database()
            limit = request.args.get('limit', 50, type=int)
            
            history = db.get_chat_history(session_id, limit=limit)
            
            return jsonify({
                'success': True,
                'history': history
            })
        except Exception as db_error:
            logger.warning(f"Database not available for chat history: {db_error}")
            # Return empty history when database is not available
            return jsonify({
                'success': True,
                'history': [],
                'message': 'Database not available - showing empty chat history'
            })
        
    except Exception as e:
        logger.error(f"Chat history error: {e}")
        return jsonify({'success': False, 'error': str(e)})

@app.route('/api/search_knowledge', methods=['POST'])
def search_knowledge():
    """Search through fine-tuned knowledge base."""
    try:
        data = request.get_json()
        query = data.get('query', '').strip()
        language = data.get('language')
        limit = data.get('limit', 10)
        
        if not query:
            return jsonify({'success': False, 'error': 'No query provided'})
        
        # Check if database is available
        try:
            db = get_database()
            results = db.search_fine_tuned_knowledge(
                query=query,
                language=language,
                limit=limit
            )
            
            return jsonify({
                'success': True,
                'results': results,
                'query': query
            })
        except Exception as db_error:
            logger.warning(f"Database not available for knowledge search: {db_error}")
            # Return empty results when database is not available
            return jsonify({
                'success': True,
                'results': [],
                'query': query,
                'message': 'Database not available - showing empty search results'
            })
        
    except Exception as e:
        logger.error(f"Knowledge search error: {e}")
        return jsonify({'success': False, 'error': str(e)})

def is_valid_file_type(filename):
    """Check if file type is supported."""
    if not filename:
        return False
    
    file_ext = os.path.splitext(filename)[1].lower()
    
    for mime_type, extensions in SUPPORTED_FILE_TYPES.items():
        if file_ext in extensions:
            return True
    
    return False

def generate_fallback_response(message: str, language: str) -> str:
    """
    Generates a simple fallback response for the chat interface.
    This is a placeholder and can be expanded with more sophisticated logic.
    """
    if "hello" in message.lower():
        return f"Hello! I'm your friendly assistant. How can I help you today in {language}?"
    elif "bye" in message.lower():
        return f"Goodbye! Have a great day in {language}!"
    else:
        return f"I'm sorry, I don't have a direct response for that in {language}. How can I assist you further?"

@app.errorhandler(404)
def not_found(error):
    return jsonify({'success': False, 'error': 'Endpoint not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'success': False, 'error': 'Internal server error'}), 500

if __name__ == '__main__':
    try:
        # Initialize system
        initialize_system()
        
        # Run the app
        app.run(
            host='0.0.0.0',
            port=5000,
            debug=True,
            threaded=True
        )
        
    except Exception as e:
        logger.error(f"Failed to start application: {e}")
        exit(1)
