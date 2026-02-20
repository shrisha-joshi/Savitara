"""
Standalone Voice Transcoding Worker Runner
Runs as a separate process to handle voice message transcoding jobs

Usage:
    python -m app.workers.run_transcode_worker

Environment Variables:
    VOICE_STORAGE_BACKEND: 'local' or 's3'
    S3_VOICE_BUCKET: S3 bucket name (if using S3)
    AWS_REGION: AWS region
    MONGODB_URL: MongoDB connection string
    REDIS_URL: Redis connection string

For Production:
    - Use process manager like systemd, supervisord, or PM2
    - Run multiple workers for parallel processing
    - Use Redis queue (Bull/BullMQ) or AWS SQS for job management
"""
import asyncio
import signal
import sys
import logging
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from app.workers.voice_transcode_worker import transcoding_worker
from app.db.connection import get_database, close_database_connection


# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('logs/transcode_worker.log')
    ]
)
logger = logging.getLogger(__name__)


class TranscodeWorkerRunner:
    """
    Worker runner that processes transcoding jobs
    
    In production, replace this with:
    - Redis queue (Bull/BullMQ)
    - AWS SQS
    - RabbitMQ
    - Celery
    
    For now, this worker polls MongoDB for pending jobs
    """
    
    def __init__(self):
        self.running = False
        self.poll_interval = 5  # seconds
    
    async def process_pending_jobs(self):
        """
        Find and process pending transcoding jobs from MongoDB
        
        Jobs are stored in messages collection with transcoding_status = 'pending'
        """
        try:
            db = await get_database()
            
            # Find messages with pending transcoding
            pending_messages = await db.messages.find({
                'message_type': 'voice',
                'transcoding_status': {'$in': [None, 'pending']},
                'media_mime': {'$nin': ['audio/ogg; codecs=opus', 'audio/ogg']},
                'deleted_at': None
            }).limit(10).to_list(length=10)
            
            if not pending_messages:
                return 0
            
            logger.info(f"Found {len(pending_messages)} pending transcoding jobs")
            
            # Process each job
            jobs_processed = 0
            for message in pending_messages:
                message_id = str(message['_id'])
                
                # Mark as processing to prevent duplicate processing
                await db.messages.update_one(
                    {'_id': message['_id']},
                    {'$set': {'transcoding_status': 'processing'}}
                )
                
                try:
                    # Extract storage key from media_url
                    media_url = message.get('media_url', '')
                    
                    # Infer storage key and backend
                    if media_url.startswith('http'):
                        # S3 URL - extract key from URL
                        # Format: https://bucket.s3.region.amazonaws.com/key
                        # or https://cdn.example.com/key
                        storage_key = media_url.split('/')[-3:]  # Get last 3 parts (user/date/file)
                        storage_key = '/'.join(storage_key)
                        storage_backend = 's3'
                    else:
                        # Local path - remove /uploads/voice/ prefix
                        storage_key = media_url.replace('/uploads/voice/', '')
                        storage_backend = 'local'
                    
                    # Process the job
                    await transcoding_worker.transcode_voice_message(
                        message_id=message_id,
                        storage_key=storage_key,
                        storage_backend=storage_backend
                    )
                    
                    jobs_processed += 1
                    logger.info(f"Successfully transcoded message {message_id}")
                    
                except Exception as e:
                    logger.error(f"Failed to transcode message {message_id}: {e}")
                    # Error is already marked in database by worker
            
            return jobs_processed
            
        except Exception as e:
            logger.error(f"Error processing pending jobs: {e}")
            return 0
    
    async def run(self):
        """Main worker loop"""
        self.running = True
        logger.info("Voice transcoding worker started")
        logger.info(f"Polling interval: {self.poll_interval} seconds")
        
        try:
            while self.running:
                try:
                    jobs_processed = await self.process_pending_jobs()
                    
                    if jobs_processed > 0:
                        logger.info(f"Processed {jobs_processed} jobs")
                    
                    # Wait before next poll
                    await asyncio.sleep(self.poll_interval)
                    
                except KeyboardInterrupt:
                    logger.info("Received interrupt signal")
                    break
                except Exception as e:
                    logger.error(f"Worker loop error: {e}")
                    # Wait before retrying
                    await asyncio.sleep(self.poll_interval)
        
        finally:
            logger.info("Shutting down worker...")
            await close_database_connection()
            logger.info("Worker stopped")
    
    def stop(self):
        """Stop the worker gracefully"""
        logger.info("Stopping worker...")
        self.running = False


# Global worker instance
worker_runner = TranscodeWorkerRunner()


def signal_handler(signum, frame):
    """Handle shutdown signals"""
    logger.info(f"Received signal {signum}")
    worker_runner.stop()


async def main():
    """Main entry point"""
    # Register signal handlers
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    # Run worker
    await worker_runner.run()


if __name__ == '__main__':
    logger.info("Starting voice transcoding worker...")
    
    # Check ffmpeg installation
    import subprocess
    try:
        result = subprocess.run(
            ['ffmpeg', '-version'],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=5
        )
        if result.returncode == 0:
            logger.info("ffmpeg is installed and available")
        else:
            logger.error("ffmpeg is not working properly")
            sys.exit(1)
    except (subprocess.TimeoutExpired, FileNotFoundError):
        logger.error("ffmpeg not found - please install ffmpeg")
        logger.error("Ubuntu/Debian: sudo apt-get install ffmpeg")
        logger.error("MacOS: brew install ffmpeg")
        logger.error("Windows: Download from https://ffmpeg.org/download.html")
        sys.exit(1)
    
    # Run the worker
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Worker stopped by user")
    except Exception as e:
        logger.error(f"Worker failed: {e}")
        sys.exit(1)
