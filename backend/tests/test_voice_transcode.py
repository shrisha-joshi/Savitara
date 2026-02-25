"""
Tests for Voice Transcoding Worker
Tests the background transcoding functionality
"""
import pytest
import asyncio
from pathlib import Path
from unittest.mock import Mock, patch, AsyncMock
from datetime import datetime, timezone

from app.workers.voice_transcode_worker import (
    VoiceTranscodingWorker,
    start_transcode_job,
    TARGET_CODEC,
    TARGET_BITRATE,
    TARGET_FORMAT,
    TARGET_MIME_TYPE
)


@pytest.fixture
def transcode_worker():
    """Create a transcoding worker instance"""
    return VoiceTranscodingWorker()


@pytest.fixture
def sample_audio_file(tmp_path):
    """Create a sample audio file for testing"""
    # Create a minimal valid WebM file (just header)
    file_path = tmp_path / "test_audio.webm"
    # WebM file signature
    webm_header = bytes.fromhex('1a45dfa3')
    file_path.write_bytes(webm_header + b'\x00' * 1000)
    return str(file_path)


class TestVoiceTranscodingWorker:
    """Test suite for voice transcoding worker"""
    
    def test_worker_initialization(self, transcode_worker):
        """Test worker initializes correctly"""
        assert transcode_worker.storage_backend in ['local', 's3']
        assert transcode_worker.s3_bucket is not None
    
    def test_get_transcoded_key(self, transcode_worker):
        """Test transcoded key generation"""
        # Test with various input formats
        assert transcode_worker._get_transcoded_key(
            'user123/2024/01/audio.webm'
        ) == f'user123/2024/01/audio_transcoded.{TARGET_FORMAT}'
        
        assert transcode_worker._get_transcoded_key(
            'user456/2024/02/voice.m4a'
        ) == f'user456/2024/02/voice_transcoded.{TARGET_FORMAT}'
    
    @pytest.mark.asyncio
    async def test_download_source_file_local(self, transcode_worker, sample_audio_file, tmp_path):
        """Test downloading source file from local storage"""
        # Create source file in uploads directory
        uploads_dir = tmp_path / 'uploads' / 'voice'
        uploads_dir.mkdir(parents=True, exist_ok=True)
        source_file = uploads_dir / 'test.webm'
        source_file.write_bytes(b'test audio data')
        
        # Patch UPLOADS_DIR
        with patch('app.workers.voice_transcode_worker.Path') as mock_path:
            mock_path.return_value.parent.parent.parent = tmp_path
            
            # Download file
            temp_file = await transcode_worker._download_source_file(
                storage_key='test.webm',
                storage_backend='local'
            )
            
            # Verify temp file was created
            assert Path(temp_file).exists()
            assert Path(temp_file).read_bytes() == b'test audio data'
            
            # Cleanup
            Path(temp_file).unlink()
    
    @pytest.mark.asyncio
    async def test_transcode_audio_validation(self, transcode_worker, sample_audio_file):
        """Test audio transcoding validation"""
        # Test with invalid input should raise exception
        with pytest.raises(Exception):
            await transcode_worker._transcode_audio('/nonexistent/file.webm')
    
    @pytest.mark.asyncio
    @patch('app.workers.voice_transcode_worker.asyncio.create_subprocess_exec')
    async def test_transcode_audio_success(self, mock_subprocess, transcode_worker, sample_audio_file):
        """Test successful audio transcoding"""
        # Mock ffmpeg subprocess
        mock_process = AsyncMock()
        mock_process.returncode = 0
        mock_process.communicate.return_value = (b'output', b'')
        mock_subprocess.return_value = mock_process
        
        # Create a dummy output file that ffmpeg would create
        with patch('pathlib.Path.exists', return_value=True):
            with patch('pathlib.Path.stat') as mock_stat:
                mock_stat.return_value.st_size = 1000
                
                output_file = await transcode_worker._transcode_audio(sample_audio_file)
                
                # Verify ffmpeg was called with correct parameters
                mock_subprocess.assert_called_once()
                call_args = mock_subprocess.call_args[0]
                assert 'ffmpeg' in call_args[0]
                assert '-c:a' in call_args
                assert TARGET_CODEC in call_args
                assert '-b:a' in call_args
                assert TARGET_BITRATE in call_args
    
    @pytest.mark.asyncio
    @patch('app.workers.voice_transcode_worker.asyncio.create_subprocess_exec')
    async def test_transcode_audio_ffmpeg_failure(self, mock_subprocess, transcode_worker, sample_audio_file):
        """Test ffmpeg failure handling"""
        # Mock ffmpeg subprocess with failure
        mock_process = AsyncMock()
        mock_process.returncode = 1
        mock_process.communicate.return_value = (b'', b'ffmpeg error')
        mock_subprocess.return_value = mock_process
        
        with pytest.raises(Exception) as exc_info:
            await transcode_worker._transcode_audio(sample_audio_file)
        
        assert 'Transcoding failed' in str(exc_info.value)
    
    @pytest.mark.asyncio
    @patch('app.workers.voice_transcode_worker.asyncio.create_subprocess_exec')
    async def test_transcode_audio_timeout(self, mock_subprocess, transcode_worker, sample_audio_file):
        """Test ffmpeg timeout handling"""
        # Mock ffmpeg subprocess that times out
        mock_process = AsyncMock()
        mock_process.communicate.side_effect = asyncio.TimeoutError()
        mock_subprocess.return_value = mock_process
        
        with pytest.raises(Exception) as exc_info:
            await transcode_worker._transcode_audio(sample_audio_file)
        
        assert 'timeout' in str(exc_info.value).lower()
    
    @pytest.mark.asyncio
    async def test_update_message_record(self, transcode_worker, test_db):
        """Test updating message record after transcoding"""
        # Create a test message
        message_data = {
            'conversation_id': None,
            'sender_id': 'user123',
            'receiver_id': 'user456',
            'content': '[Voice message]',
            'message_type': 'voice',
            'media_url': '/uploads/voice/test.webm',
            'media_mime': 'audio/webm',
            'created_at': datetime.now(timezone.utc)
        }
        result = await test_db.messages.insert_one(message_data)
        message_id = str(result.inserted_id)
        
        # Update the message
        await transcode_worker._update_message_record(
            message_id=message_id,
            media_url='/uploads/voice/test_transcoded.ogg',
            media_mime=TARGET_MIME_TYPE
        )
        
        # Verify update
        updated_message = await test_db.messages.find_one({'_id': result.inserted_id})
        assert updated_message['media_url'] == '/uploads/voice/test_transcoded.ogg'
        assert updated_message['media_mime'] == TARGET_MIME_TYPE
        assert updated_message['transcoding_status'] == 'completed'
    
    @pytest.mark.asyncio
    async def test_mark_transcode_failed(self, transcode_worker, test_db):
        """Test marking message as failed transcoding"""
        # Create a test message
        message_data = {
            'conversation_id': None,
            'sender_id': 'user123',
            'receiver_id': 'user456',
            'content': '[Voice message]',
            'message_type': 'voice',
            'created_at': datetime.now(timezone.utc)
        }
        result = await test_db.messages.insert_one(message_data)
        message_id = str(result.inserted_id)
        
        # Mark as failed
        error_msg = "ffmpeg failed: invalid codec"
        await transcode_worker._mark_transcode_failed(message_id, error_msg)
        
        # Verify update
        updated_message = await test_db.messages.find_one({'_id': result.inserted_id})
        assert updated_message['transcoding_status'] == 'failed'
        assert updated_message['transcoding_error'] == error_msg
    
    def test_cleanup_temp_files(self, transcode_worker, tmp_path):
        """Test temporary file cleanup"""
        # Create temp files
        file1 = tmp_path / 'temp1.webm'
        file2 = tmp_path / 'temp2.ogg'
        file1.write_bytes(b'test')
        file2.write_bytes(b'test')
        
        # Cleanup
        transcode_worker._cleanup_temp_files(str(file1), str(file2))
        
        # Verify files deleted
        assert not file1.exists()
        assert not file2.exists()
    
    def test_cleanup_nonexistent_files(self, transcode_worker):
        """Test cleanup handles nonexistent files gracefully"""
        # Should not raise exception
        transcode_worker._cleanup_temp_files(
            '/nonexistent/file1.webm',
            '/nonexistent/file2.ogg',
            None
        )
    
    @pytest.mark.asyncio
    @patch('app.workers.voice_transcode_worker.transcoding_worker.transcode_voice_message')
    async def test_start_transcode_job(self, mock_transcode):
        """Test starting a transcode job"""
        mock_transcode.return_value = {
            'success': True,
            'message_id': 'msg123',
            'storage_key': 'test_transcoded.ogg',
            'media_url': '/uploads/voice/test_transcoded.ogg'
        }
        
        await start_transcode_job(
            message_id='msg123',
            storage_key='test.webm',
            storage_backend='local'
        )
        
        mock_transcode.assert_called_once_with(
            message_id='msg123',
            storage_key='test.webm',
            storage_backend='local'
        )


@pytest.mark.asyncio
class TestTranscodeIntegration:
    """Integration tests for full transcode flow"""
    
    @pytest.mark.skip(reason="Requires ffmpeg installation")
    async def test_full_transcode_flow_local(self, transcode_worker, test_db, tmp_path):
        """
        Test full transcode flow with local storage
        
        This test is skipped by default as it requires:
        - ffmpeg installed
        - Valid audio file
        
        To run: pytest -v -k test_full_transcode_flow_local
        """
        # Create a valid audio file (would need actual audio data)
        # Process transcoding
        # Verify output
        pass
