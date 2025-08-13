# Enhanced IndicBERT v2 System with MongoDB & OpenAI Integration

## Overview

This enhanced version of the IndicBERT v2 system provides a comprehensive AI chat assistant with the following capabilities:

1. **MongoDB-based File Storage**: Permanent storage of uploaded files for lifelong fine-tuning
2. **Automatic Fine-tuning**: Continuous model improvement using uploaded data
3. **OpenAI API Integration**: Fallback responses when fine-tuned model cannot answer
4. **Multilingual Support**: 23+ Indic languages with automatic language detection
5. **Hybrid Response System**: Intelligent routing between fine-tuned and OpenAI models
6. **Real-time Training**: Live monitoring of fine-tuning processes

## Features

### 🗄️ MongoDB Integration
- **GridFS Storage**: Large files stored efficiently in MongoDB
- **Metadata Management**: Comprehensive file information tracking
- **Fine-tuning Data**: Processed training data stored for model improvement
- **Training History**: Complete record of all fine-tuning sessions
- **Chat Sessions**: Persistent conversation history for analysis

### 🤖 Fine-tuning Capabilities
- **Automatic Processing**: Upload files and automatically prepare for training
- **Multilingual Support**: Handle text in multiple Indic languages
- **Language Detection**: Automatic identification of text language
- **Text Normalization**: Language-specific text preprocessing
- **Model Versioning**: Track different versions of fine-tuned models

### 🔄 OpenAI Integration
- **Smart Routing**: Automatically decide when to use OpenAI vs fine-tuned model
- **Cost Management**: Track and control API usage costs
- **Rate Limiting**: Prevent API quota exhaustion
- **Response Caching**: Reduce API calls for repeated queries
- **Fallback System**: Ensure responses even when fine-tuned model fails

### 🌐 Multilingual Support
- **23+ Languages**: Hindi, Bengali, Tamil, Telugu, Marathi, and more
- **Script Recognition**: Automatic detection of Indic scripts
- **Language-specific Processing**: Optimized handling for each language
- **Cultural Sensitivity**: Appropriate responses for different cultures

## System Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web Interface │    │   Flask Server  │    │   MongoDB      │
│   (HTML/JS)    │◄──►│   (Python)      │◄──►│   Database     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │ Fine-tuning     │
                       │ Manager         │
                       └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │ IndicBERT v2    │    │   OpenAI API    │
                       │ Models          │    │   (Fallback)    │
                       └─────────────────┘    └─────────────────┘
```

## Installation

### Prerequisites

1. **Python 3.8+**
2. **MongoDB 4.4+**
3. **OpenAI API Key** (optional but recommended)
4. **Git**

### Step 1: Clone the Repository

```bash
git clone <repository-url>
cd IndicBERTv2
```

### Step 2: Install Dependencies

```bash
pip install -r enhanced_requirements.txt
```

### Step 3: Set Up MongoDB

1. **Install MongoDB** (if not already installed):
   ```bash
   # Ubuntu/Debian
   sudo apt-get install mongodb
   
   # macOS
   brew install mongodb-community
   
   # Windows
   # Download from https://www.mongodb.com/try/download/community
   ```

2. **Start MongoDB Service**:
   ```bash
   # Ubuntu/Debian
   sudo systemctl start mongodb
   
   # macOS
   brew services start mongodb-community
   
   # Windows
   # Start MongoDB service from Services
   ```

3. **Verify Connection**:
   ```bash
   mongosh
   # Should connect to MongoDB shell
   ```

### Step 4: Environment Configuration

Create a `.env` file in the project root:

```bash
# MongoDB Configuration
MONGO_URI=mongodb://localhost:27017/
MONGO_DB_NAME=indicbert_v2

# OpenAI Configuration (Optional)
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-3.5-turbo

# Flask Configuration
FLASK_SECRET_KEY=your_secret_key_here
FLASK_ENV=development

# Fine-tuning Configuration
TRAINING_OUTPUT_DIR=./fine_tuned_models
MAX_FILE_SIZE=10485760
```

### Step 5: Initialize the System

```bash
python enhanced_web_demo.py
```

The system will automatically:
- Connect to MongoDB
- Create necessary collections and indexes
- Initialize fine-tuning manager
- Set up OpenAI integration (if API key provided)

## Usage

### 1. Web Interface

Open your browser and navigate to `http://localhost:5000`

The interface has four main tabs:

#### Chat Tab
- Select IndicBERT v2 model variant
- Choose preferred language
- Chat with the AI assistant

#### Files Tab
- Upload training data files (TXT, CSV, JSON)
- View uploaded files and their processing status
- Start fine-tuning processes

#### Training Tab
- Monitor active fine-tuning sessions
- View training progress and status
- Control training processes

#### OpenAI Tab
- Monitor OpenAI API connection status
- View cost usage and statistics
- Manage API settings

### 2. File Upload for Fine-tuning

#### Supported File Types
- **TXT**: Plain text files with one sentence per line
- **CSV**: Comma-separated files with text and optional language columns
- **JSON**: Structured data with text and metadata

#### File Format Examples

**TXT File**:
```
नमस्ते, कैसे हो आप?
Hello, how are you?
வணக்கம், நீங்கள் எப்படி இருக்கிறீர்கள்?
```

**CSV File**:
```csv
text,language
नमस्ते, कैसे हो आप?,hindi
Hello, how are you?,english
வணக்கம், நீங்கள் எப்படி இருக்கிறீர்கள்?,tamil
```

**JSON File**:
```json
[
  {
    "text": "नमस्ते, कैसे हो आप?",
    "language": "hindi",
    "category": "greeting"
  },
  {
    "text": "Hello, how are you?",
    "language": "english",
    "category": "greeting"
  }
]
```

### 3. Fine-tuning Process

1. **Upload Files**: Drag and drop or click to upload training data
2. **Automatic Processing**: System processes and normalizes text
3. **Language Detection**: Identifies language for each text segment
4. **Start Training**: Click "Start Fine-tuning" button
5. **Monitor Progress**: Watch real-time training status
6. **Model Ready**: Fine-tuned model becomes available for chat

### 4. Chat with AI

The system intelligently routes queries:

1. **First Priority**: Fine-tuned model (if available and confident)
2. **Second Priority**: OpenAI API (for complex queries or when fine-tuned model lacks confidence)
3. **Fallback**: Fine-tuned model (even if low confidence, as last resort)

#### Response Sources
- **Fine-tuned**: Responses from your custom-trained model
- **OpenAI**: Responses from OpenAI's GPT models
- **Hybrid**: Combination of both models for enhanced responses

## API Endpoints

### File Management
- `POST /api/upload_file` - Upload training data files
- `GET /api/files` - List uploaded files
- `GET /api/fine_tuning_data` - List processed training data

### Fine-tuning
- `POST /api/start_fine_tuning` - Start fine-tuning process
- `GET /api/training_status/<id>` - Get training status
- `GET /api/models` - List available models

### Chat
- `POST /api/chat` - Send chat message
- `GET /api/chat_history/<session_id>` - Get chat history
- `POST /api/search_knowledge` - Search fine-tuned knowledge base

### OpenAI Integration
- `GET /api/openai/cost_summary` - Get cost usage
- `POST /api/openai/reset_daily_cost` - Reset daily cost counter

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MONGO_URI` | MongoDB connection string | `mongodb://localhost:27017/` |
| `MONGO_DB_NAME` | Database name | `indicbert_v2` |
| `OPENAI_API_KEY` | OpenAI API key | None |
| `OPENAI_MODEL` | OpenAI model to use | `gpt-3.5-turbo` |
| `FLASK_SECRET_KEY` | Flask secret key | Auto-generated |
| `FLASK_ENV` | Environment (dev/prod/test) | `development` |
| `MAX_FILE_SIZE` | Maximum file size in bytes | `10485760` (10MB) |

### Fine-tuning Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| `epochs` | Training epochs | 3 |
| `batch_size` | Batch size | 8 |
| `learning_rate` | Learning rate | 5e-5 |
| `max_length` | Maximum sequence length | 512 |
| `mlm_probability` | Masked language modeling probability | 0.15 |

## Monitoring and Maintenance

### MongoDB Maintenance
```bash
# Check database size
mongosh indicbert_v2 --eval "db.stats()"

# Clean up old files
mongosh indicbert_v2 --eval "db.files.deleteMany({upload_date: {\$lt: new Date(Date.now() - 30*24*60*60*1000)}})"

# Optimize collections
mongosh indicbert_v2 --eval "db.files.reIndex()"
```

### Log Files
- **Application Logs**: `indicbert_v2.log`
- **Training Logs**: `./training_logs/`
- **Model Outputs**: `./fine_tuned_models/`

### Performance Monitoring
- Monitor MongoDB connection pool usage
- Track OpenAI API rate limits
- Watch fine-tuning progress and resource usage

## Troubleshooting

### Common Issues

1. **MongoDB Connection Failed**
   - Verify MongoDB service is running
   - Check connection string in `.env` file
   - Ensure network access to MongoDB port

2. **OpenAI API Errors**
   - Verify API key is correct
   - Check API quota and rate limits
   - Ensure internet connectivity

3. **Fine-tuning Fails**
   - Check file format and content
   - Verify sufficient disk space
   - Monitor system resources (CPU/RAM)

4. **Model Loading Issues**
   - Ensure sufficient RAM for model loading
   - Check model file integrity
   - Verify transformers library version

### Debug Mode

Enable debug mode for detailed logging:

```bash
export FLASK_ENV=development
export LOG_LEVEL=DEBUG
python enhanced_web_demo.py
```

## Security Considerations

1. **API Keys**: Never commit API keys to version control
2. **Database Access**: Restrict MongoDB access to application only
3. **File Uploads**: Validate file types and sizes
4. **Rate Limiting**: Implement proper rate limiting for production use
5. **HTTPS**: Use HTTPS in production environments

## Production Deployment

### Docker Deployment

```dockerfile
FROM python:3.9-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .
EXPOSE 5000

CMD ["python", "enhanced_web_demo.py"]
```

### Environment Setup
```bash
# Production environment
export FLASK_ENV=production
export FLASK_SECRET_KEY=your_secure_secret_key
export MONGO_URI=mongodb://your_mongo_host:27017/
export OPENAI_API_KEY=your_openai_key
```

### Load Balancing
- Use Nginx as reverse proxy
- Implement multiple Flask instances
- Use MongoDB replica sets for high availability

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For issues and questions:
1. Check the troubleshooting section
2. Review existing GitHub issues
3. Create a new issue with detailed information
4. Contact the development team

## Acknowledgments

- **AI4Bharat** for the IndicBERT v2 models
- **OpenAI** for the GPT API integration
- **MongoDB** for the database technology
- **Transformers** library for model handling

---

**Note**: This system is designed for research and development purposes. For production use, ensure proper security measures, monitoring, and backup strategies are in place.
