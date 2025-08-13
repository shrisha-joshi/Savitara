#!/usr/bin/env python3
"""
Enhanced IndicBERT v2 System Startup Script

This script initializes and starts the enhanced system with:
1. MongoDB connection
2. Fine-tuning manager
3. OpenAI integration
4. Web interface
"""

import os
import sys
import logging
from pathlib import Path

# Add current directory to Python path
sys.path.append(str(Path(__file__).parent))

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('indicbert_v2.log'),
        logging.StreamHandler(sys.stdout)
    ]
)

logger = logging.getLogger(__name__)

def check_dependencies():
    """Check if all required dependencies are available."""
    required_deps = ['flask', 'transformers', 'torch']
    optional_deps = ['pymongo', 'openai', 'indicnlp']
    
    missing_required = []
    missing_optional = []
    
    # Check required dependencies
    for dep in required_deps:
        try:
            __import__(dep)
            logger.info(f"✅ {dep} - Available")
        except ImportError:
            missing_required.append(dep)
            logger.error(f"❌ {dep} - Missing (REQUIRED)")
    
    # Check optional dependencies
    for dep in optional_deps:
        try:
            __import__(dep)
            logger.info(f"✅ {dep} - Available")
        except ImportError:
            missing_optional.append(dep)
            logger.warning(f"⚠️  {dep} - Missing (Optional)")
    
    # If required dependencies are missing, fail
    if missing_required:
        logger.error("❌ Missing required dependencies:")
        for dep in missing_required:
            logger.error(f"  - {dep}")
        logger.error("Please install using: pip install -r enhanced_requirements.txt")
        return False
    
    # If optional dependencies are missing, warn but continue
    if missing_optional:
        logger.warning("⚠️  Some optional dependencies are missing:")
        for dep in missing_optional:
            logger.warning(f"  - {dep}")
        logger.warning("The system will work with limited functionality")
        logger.warning("Install using: pip install -r enhanced_requirements.txt")
    
    logger.info("✅ All required dependencies are available")
    return True

def check_mongodb():
    """Check MongoDB connection."""
    try:
        # Try to import pymongo first
        import pymongo
        from pymongo import MongoClient
        from pymongo.errors import ConnectionFailure
        
        # Try to connect to MongoDB
        client = MongoClient('mongodb://localhost:27017/', serverSelectionTimeoutMS=5000)
        client.admin.command('ping')
        logger.info("✅ MongoDB connection successful")
        client.close()
        return True
    except ImportError:
        logger.warning("⚠️  pymongo not available - MongoDB features will be disabled")
        logger.warning("Install using: pip install pymongo")
        return False
    except ConnectionFailure:
        logger.warning("⚠️  MongoDB connection failed - MongoDB features will be disabled")
        logger.warning("Installation instructions:")
        logger.warning("  Ubuntu/Debian: sudo apt-get install mongodb")
        logger.warning("  macOS: brew install mongodb-community")
        logger.warning("  Windows: Download from https://www.mongodb.com/try/download/community")
        return False
    except Exception as e:
        logger.warning(f"⚠️  MongoDB check failed: {e} - MongoDB features will be disabled")
        return False

def check_openai():
    """Check OpenAI API key availability."""
    api_key = os.getenv('OPENAI_API_KEY')
    if api_key:
        logger.info("OpenAI API key found")
        return True
    else:
        logger.warning("OpenAI API key not found. OpenAI integration will be disabled.")
        logger.warning("To enable OpenAI integration, set OPENAI_API_KEY environment variable")
        return False

def create_directories():
    """Create necessary directories."""
    directories = [
        './fine_tuned_models',
        './training_logs',
        './uploads',
        './cache'
    ]
    
    for directory in directories:
        Path(directory).mkdir(exist_ok=True)
        logger.info(f"Created directory: {directory}")

def validate_configuration():
    """Validate system configuration."""
    from config import get_config
    
    try:
        config = get_config()
        if config.validate_config():
            logger.info("Configuration validation successful")
            return True
        else:
            logger.error("Configuration validation failed")
            return False
    except Exception as e:
        logger.error(f"Configuration validation error: {e}")
        return False

def start_system():
    """Start the enhanced system."""
    try:
        logger.info("Starting Enhanced IndicBERT v2 System...")
        
        # Check dependencies
        if not check_dependencies():
            return False
        
        # Check MongoDB (optional for basic functionality)
        mongo_available = check_mongodb()
        if not mongo_available:
            logger.warning("⚠️  Starting system with limited functionality (no MongoDB)")
        
        # Check OpenAI (optional)
        check_openai()
        
        # Create directories
        create_directories()
        
        # Validate configuration (skip if MongoDB not available)
        if mongo_available and not validate_configuration():
            logger.warning("⚠️  Configuration validation failed, but continuing...")
        
        # Import and start the web demo
        from enhanced_web_demo import app, initialize_system
        
        # Initialize system components
        try:
            initialize_system()
        except Exception as e:
            logger.warning(f"⚠️  System initialization had issues: {e}")
            logger.warning("⚠️  Starting with basic functionality")
        
        # Get configuration
        try:
            from config import get_config
            config = get_config()
            host = config.FLASK_HOST
            port = config.FLASK_PORT
            debug = config.FLASK_DEBUG
            threaded = config.FLASK_THREADED
        except:
            # Fallback configuration
            host = '127.0.0.1'
            port = 5000
            debug = True
            threaded = True
            logger.warning("⚠️  Using fallback configuration")
        
        logger.info("System initialization completed!")
        logger.info(f"Starting web server on {host}:{port}")
        logger.info(f"Open your browser and navigate to: http://{host}:{port}")
        
        # Start the Flask application
        app.run(
            host=host,
            port=port,
            debug=debug,
            threaded=threaded
        )
        
        return True
        
    except KeyboardInterrupt:
        logger.info("System shutdown requested by user")
        return True
    except Exception as e:
        logger.error(f"Failed to start system: {e}")
        return False

def main():
    """Main entry point."""
    print("=" * 60)
    print("Enhanced IndicBERT v2 System")
    print("=" * 60)
    print()
    
    # Check Python version
    if sys.version_info < (3, 8):
        print("Error: Python 3.8 or higher is required")
        print(f"Current version: {sys.version}")
        sys.exit(1)
    
    print(f"Python version: {sys.version}")
    print(f"Working directory: {os.getcwd()}")
    print()
    
    # Start the system
    success = start_system()
    
    if success:
        print("System started successfully!")
    else:
        print("Failed to start system. Check the logs for details.")
        sys.exit(1)

if __name__ == "__main__":
    main()
