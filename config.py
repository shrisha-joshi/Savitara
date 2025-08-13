#!/usr/bin/env python3
"""
Configuration file for Enhanced IndicBERT v2 System

This file contains all configuration settings for:
1. MongoDB connection
2. OpenAI API settings
3. Model configurations
4. Fine-tuning parameters
5. System settings
"""

import os
from typing import Dict, Any

class Config:
    """Configuration class for the enhanced IndicBERT v2 system."""
    
    # MongoDB Configuration
    MONGO_URI = os.getenv('MONGO_URI', 'mongodb://localhost:27017/')
    MONGO_DB_NAME = os.getenv('MONGO_DB_NAME', 'indicbert_v2')
    MONGO_MAX_POOL_SIZE = int(os.getenv('MONGO_MAX_POOL_SIZE', '100'))
    MONGO_CONNECT_TIMEOUT_MS = int(os.getenv('MONGO_CONNECT_TIMEOUT_MS', '5000'))
    
    # OpenAI Configuration
    OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')
    OPENAI_MODEL = os.getenv('OPENAI_MODEL', 'gpt-3.5-turbo')
    OPENAI_MAX_TOKENS = int(os.getenv('OPENAI_MAX_TOKENS', '1000'))
    OPENAI_TEMPERATURE = float(os.getenv('OPENAI_TEMPERATURE', '0.7'))
    OPENAI_TOP_P = float(os.getenv('OPENAI_TOP_P', '0.9'))
    
    # Rate Limiting
    OPENAI_REQUESTS_PER_MINUTE = int(os.getenv('OPENAI_REQUESTS_PER_MINUTE', '60'))
    OPENAI_TOKENS_PER_MINUTE = int(os.getenv('OPENAI_TOKENS_PER_MINUTE', '90000'))
    
    # IndicBERT v2 Models
    AVAILABLE_MODELS = {
        "IndicBERTv2-MLM-only": "ai4bharat/IndicBERTv2-MLM-only",
        "IndicBERTv2-MLM": "ai4bharat/IndicBERTv2-MLM",
        "IndicBERTv2-MLM-News": "ai4bharat/IndicBERTv2-MLM-News",
        "IndicBERTv2-MLM-News-CC": "ai4bharat/IndicBERTv2-MLM-News-CC"
    }
    
    DEFAULT_MODEL = "IndicBERTv2-MLM-only"
    
    # Fine-tuning Configuration
    FINE_TUNING_CONFIG = {
        'default_epochs': 3,
        'default_batch_size': 8,
        'default_learning_rate': 5e-5,
        'default_warmup_steps': 500,
        'default_weight_decay': 0.01,
        'max_sequence_length': 512,
        'mlm_probability': 0.15,
        'gradient_accumulation_steps': 1,
        'save_steps': 1000,
        'eval_steps': 1000,
        'logging_steps': 100
    }
    
    # File Processing Configuration
    SUPPORTED_FILE_TYPES = {
        'text/plain': ['.txt'],
        'text/csv': ['.csv'],
        'application/json': ['.json']
    }
    
    MAX_FILE_SIZE = int(os.getenv('MAX_FILE_SIZE', '10485760'))  # 10MB
    MIN_TEXT_LENGTH = int(os.getenv('MIN_TEXT_LENGTH', '10'))
    
    # Language Support
    SUPPORTED_LANGUAGES = {
        'hi': 'hindi', 'en': 'english', 'bn': 'bengali', 'ta': 'tamil',
        'te': 'telugu', 'mr': 'marathi', 'gu': 'gujarati', 'kn': 'kannada',
        'ml': 'malayalam', 'pa': 'punjabi', 'or': 'odia', 'as': 'assamese'
    }
    
    # Language-specific processing rules
    LANGUAGE_RULES = {
        'hindi': {'script': 'devanagari', 'normalize': True},
        'bengali': {'script': 'bengali', 'normalize': True},
        'tamil': {'script': 'tamil', 'normalize': True},
        'telugu': {'script': 'telugu', 'normalize': True},
        'marathi': {'script': 'devanagari', 'normalize': True},
        'gujarati': {'script': 'gujarati', 'normalize': True},
        'kannada': {'script': 'kannada', 'normalize': True},
        'malayalam': {'script': 'malayalam', 'normalize': True},
        'punjabi': {'script': 'gurmukhi', 'normalize': True},
        'odia': {'script': 'odia', 'normalize': True},
        'assamese': {'script': 'bengali', 'normalize': True},
        'english': {'script': 'latin', 'normalize': False}
    }
    
    # Web Application Configuration
    FLASK_SECRET_KEY = os.getenv('FLASK_SECRET_KEY', 'indicbert-v2-secret-key-2024')
    FLASK_HOST = os.getenv('FLASK_HOST', '0.0.0.0')
    FLASK_PORT = int(os.getenv('FLASK_PORT', '5000'))
    FLASK_DEBUG = os.getenv('FLASK_DEBUG', 'True').lower() == 'true'
    FLASK_THREADED = os.getenv('FLASK_THREADED', 'True').lower() == 'true'
    
    # Logging Configuration
    LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO')
    LOG_FORMAT = '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    LOG_FILE = os.getenv('LOG_FILE', 'indicbert_v2.log')
    
    # Cache Configuration
    RESPONSE_CACHE_TTL = int(os.getenv('RESPONSE_CACHE_TTL', '3600'))  # 1 hour
    MAX_CACHE_SIZE = int(os.getenv('MAX_CACHE_SIZE', '1000'))
    
    # Training Configuration
    TRAINING_OUTPUT_DIR = os.getenv('TRAINING_OUTPUT_DIR', './fine_tuned_models')
    TRAINING_LOG_DIR = os.getenv('TRAINING_LOG_DIR', './training_logs')
    
    # Model Evaluation
    EVALUATION_METRICS = ['accuracy', 'f1', 'precision', 'recall', 'loss']
    
    # Security Configuration
    ENABLE_CORS = os.getenv('ENABLE_CORS', 'True').lower() == 'true'
    ALLOWED_ORIGINS = os.getenv('ALLOWED_ORIGINS', '*').split(',')
    
    # Performance Configuration
    MAX_CONCURRENT_TRAINING = int(os.getenv('MAX_CONCURRENT_TRAINING', '3'))
    TRAINING_TIMEOUT = int(os.getenv('TRAINING_TIMEOUT', '3600'))  # 1 hour
    
    @classmethod
    def get_mongo_config(cls) -> Dict[str, Any]:
        """Get MongoDB configuration."""
        return {
            'uri': cls.MONGO_URI,
            'db_name': cls.MONGO_DB_NAME,
            'max_pool_size': cls.MONGO_MAX_POOL_SIZE,
            'connect_timeout_ms': cls.MONGO_CONNECT_TIMEOUT_MS
        }
    
    @classmethod
    def get_openai_config(cls) -> Dict[str, Any]:
        """Get OpenAI configuration."""
        return {
            'api_key': cls.OPENAI_API_KEY,
            'model': cls.OPENAI_MODEL,
            'max_tokens': cls.OPENAI_MAX_TOKENS,
            'temperature': cls.OPENAI_TEMPERATURE,
            'top_p': cls.OPENAI_TOP_P,
            'requests_per_minute': cls.OPENAI_REQUESTS_PER_MINUTE,
            'tokens_per_minute': cls.OPENAI_TOKENS_PER_MINUTE
        }
    
    @classmethod
    def get_fine_tuning_config(cls) -> Dict[str, Any]:
        """Get fine-tuning configuration."""
        return cls.FINE_TUNING_CONFIG.copy()
    
    @classmethod
    def get_web_config(cls) -> Dict[str, Any]:
        """Get web application configuration."""
        return {
            'secret_key': cls.FLASK_SECRET_KEY,
            'host': cls.FLASK_HOST,
            'port': cls.FLASK_PORT,
            'debug': cls.FLASK_DEBUG,
            'threaded': cls.FLASK_THREADED
        }
    
    @classmethod
    def validate_config(cls) -> bool:
        """Validate configuration settings."""
        errors = []
        
        # Check MongoDB connection
        if not cls.MONGO_URI:
            errors.append("MongoDB URI is required")
        
        # Check OpenAI API key (optional but recommended)
        if not cls.OPENAI_API_KEY:
            print("Warning: OpenAI API key not provided. OpenAI integration will be disabled.")
        
        # Check file size limits
        if cls.MAX_FILE_SIZE <= 0:
            errors.append("MAX_FILE_SIZE must be positive")
        
        # Check training parameters
        if cls.FINE_TUNING_CONFIG['default_epochs'] <= 0:
            errors.append("Default epochs must be positive")
        
        if cls.FINE_TUNING_CONFIG['default_batch_size'] <= 0:
            errors.append("Default batch size must be positive")
        
        if len(errors) > 0:
            print("Configuration validation errors:")
            for error in errors:
                print(f"  - {error}")
            return False
        
        return True

# Environment-specific configurations
class DevelopmentConfig(Config):
    """Development environment configuration."""
    FLASK_DEBUG = True
    LOG_LEVEL = 'DEBUG'

class ProductionConfig(Config):
    """Production environment configuration."""
    FLASK_DEBUG = False
    LOG_LEVEL = 'WARNING'
    FLASK_SECRET_KEY = os.getenv('FLASK_SECRET_KEY')  # Must be set in production

class TestingConfig(Config):
    """Testing environment configuration."""
    FLASK_DEBUG = True
    MONGO_DB_NAME = 'indicbert_v2_test'
    LOG_LEVEL = 'DEBUG'

# Configuration mapping
config_map = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig
}

def get_config(environment: str = None) -> Config:
    """Get configuration for the specified environment."""
    if environment is None:
        environment = os.getenv('FLASK_ENV', 'development')
    
    config_class = config_map.get(environment, DevelopmentConfig)
    return config_class()

# Default configuration
config = get_config()
