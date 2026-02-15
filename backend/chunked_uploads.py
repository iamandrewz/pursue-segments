# Chunked File Upload Routes for Flask
# Add these routes to your existing app.py

import os
import uuid
import json
import hashlib
from datetime import datetime
from flask import Blueprint, request, jsonify, send_from_directory

# Create a blueprint for chunked uploads
chunked_bp = Blueprint('chunked', __name__, url_prefix='/api/chunked')

# Get the directory where this file is located
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))

# Configuration - use app's data directory
CHUNKED_UPLOAD_DIR = os.path.join(BACKEND_DIR, 'data', 'chunked_uploads')
CHUNK_SIZE = 10 * 1024 * 1024  # 10MB chunks (adjust as needed)

os.makedirs(CHUNKED_UPLOAD_DIR, exist_ok=True)

def get_upload_session(session_id):
    """Load upload session data"""
    session_file = os.path.join(CHUNKED_UPLOAD_DIR, f"session_{session_id}.json")
    if os.path.exists(session_file):
        with open(session_file, 'r') as f:
            return json.load(f)
    return None

def save_upload_session(session_data):
    """Save upload session data"""
    session_file = os.path.join(CHUNKED_UPLOAD_DIR, f"session_{session_data['id']}.json")
    with open(session_file, 'w') as f:
        json.dump(session_data, f, indent=2)

def calculate_file_hash(filepath):
    """Calculate SHA256 hash of file"""
    sha256 = hashlib.sha256()
    with open(filepath, 'rb') as f:
        for chunk in iter(lambda: f.read(8192), b''):
            sha256.update(chunk)
    return sha256.hexdigest()

# ============================================================================
# API ROUTES - CHUNKED UPLOAD
# ============================================================================

@chunked_bp.route('/initiate', methods=['POST'])
def initiate_upload():
    """
    Start a new chunked upload.
    Request: { "filename": "video.mp4", "fileSize": 2147483648, "chunkSize": 10485760 }
    Response: { "uploadId": "uuid", "chunkSize": 10485760, "totalChunks": 215 }
    """
    try:
        data = request.json
        filename = data.get('filename')
        file_size = data.get('fileSize')
        chunk_size = data.get('chunkSize', CHUNK_SIZE)
        
        if not filename or not file_size:
            return jsonify({'error': 'filename and fileSize are required'}), 400
        
        # Generate unique upload ID
        upload_id = str(uuid.uuid4())
        
        # Calculate total chunks
        total_chunks = (file_size + chunk_size - 1) // chunk_size
        
        # Create upload session
        session_data = {
            'id': upload_id,
            'filename': filename,
            'fileSize': file_size,
            'chunkSize': chunk_size,
            'totalChunks': total_chunks,
            'uploadedChunks': [],
            'status': 'in_progress',
            'createdAt': datetime.now().isoformat(),
            'updatedAt': datetime.now().isoformat()
        }
        
        # Create directory for this upload
        upload_dir = os.path.join(CHUNKED_UPLOAD_DIR, upload_id)
        os.makedirs(upload_dir, exist_ok=True)
        
        # Save session
        save_upload_session(session_data)
        
        return jsonify({
            'uploadId': upload_id,
            'chunkSize': chunk_size,
            'totalChunks': total_chunks,
            'status': 'in_progress'
        }), 202
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@chunked_bp.route('/upload', methods=['POST'])
def upload_chunk():
    """
    Upload a single chunk.
    Request: FormData with 'chunk' (file), 'uploadId', 'chunkIndex'
    Response: { "chunkIndex": 0, "chunksUploaded": 1, "progress": 0.5 }
    """
    try:
        # Get form data
        upload_id = request.form.get('uploadId')
        chunk_index = int(request.form.get('chunkIndex', 0))
        
        if not upload_id:
            return jsonify({'error': 'uploadId is required'}), 400
        
        # Check if chunk file exists
        if 'chunk' not in request.files:
            return jsonify({'error': 'No chunk file provided'}), 400
        
        chunk_file = request.files['chunk']
        
        # Load session
        session = get_upload_session(upload_id)
        if not session:
            return jsonify({'error': 'Upload session not found. Start a new upload.'}), 404
        
        if session['status'] != 'in_progress':
            return jsonify({'error': f'Upload already completed or failed: {session["status"]}'}), 400
        
        # Validate chunk index
        if chunk_index in session['uploadedChunks']:
            # Chunk already uploaded - return success
            return jsonify({
                'chunkIndex': chunk_index,
                'chunksUploaded': len(session['uploadedChunks']),
                'progress': len(session['uploadedChunks']) / session['totalChunks'] * 100,
                'message': 'Chunk already uploaded'
            }), 200
        
        # Save chunk
        upload_dir = os.path.join(CHUNKED_UPLOAD_DIR, upload_id)
        chunk_path = os.path.join(upload_dir, f"chunk_{chunk_index:05d}")
        chunk_file.save(chunk_path)
        
        # Update session
        session['uploadedChunks'].append(chunk_index)
        session['updatedAt'] = datetime.now().isoformat()
        save_upload_session(session)
        
        # Calculate progress
        progress = len(session['uploadedChunks']) / session['totalChunks'] * 100
        
        return jsonify({
            'chunkIndex': chunk_index,
            'chunksUploaded': len(session['uploadedChunks']),
            'totalChunks': session['totalChunks'],
            'progress': progress
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@chunked_bp.route('/status/<upload_id>', methods=['GET'])
def get_upload_status(upload_id):
    """
    Get upload progress/status.
    Response: { "status": "in_progress", "chunksUploaded": 5, "totalChunks": 215, "progress": 2.3 }
    """
    try:
        session = get_upload_session(upload_id)
        
        if not session:
            return jsonify({'error': 'Upload session not found'}), 404
        
        return jsonify({
            'status': session['status'],
            'filename': session['filename'],
            'fileSize': session['fileSize'],
            'chunksUploaded': len(session['uploadedChunks']),
            'totalChunks': session['totalChunks'],
            'progress': len(session['uploadedChunks']) / session['totalChunks'] * 100
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@chunked_bp.route('/complete', methods=['POST'])
def complete_upload(upload_id=None):
    """
    Finalize upload - reassemble all chunks.
    Request: { "uploadId": "uuid" }
    Response: { "filePath": "/path/to/final/file.mp4", "fileSize": 2147483648 }
    """
    try:
        # Handle both URL param and JSON body
        if upload_id is None:
            data = request.json
            upload_id = data.get('uploadId') if data else None
        
        if not upload_id:
            return jsonify({'error': 'uploadId is required'}), 400
        
        # Load session
        session = get_upload_session(upload_id)
        if not session:
            return jsonify({'error': 'Upload session not found'}), 404
        
        if session['status'] == 'completed':
            return jsonify({
                'status': 'completed',
                'filePath': session.get('finalPath'),
                'message': 'Upload already completed'
            }), 200
        
        # Check if all chunks uploaded
        expected_chunks = set(range(session['totalChunks']))
        uploaded_chunks = set(session['uploadedChunks'])
        missing_chunks = expected_chunks - uploaded_chunks
        
        if missing_chunks:
            return jsonify({
                'error': f'Missing chunks: {sorted(missing_chunks)[:10]}...',
                'missingCount': len(missing_chunks),
                'totalChunks': session['totalChunks'],
                'uploadedChunks': len(session['uploadedChunks'])
            }), 400
        
        # Reassemble chunks
        upload_dir = os.path.join(CHUNKED_UPLOAD_DIR, upload_id)
        
        # Create final file path
        final_dir = os.path.join(os.path.dirname(__file__), 'data', 'uploads')
        os.makedirs(final_dir, exist_ok=True)
        
        final_filename = f"{upload_id}_{session['filename']}"
        final_path = os.path.join(final_dir, final_filename)
        
        # Combine chunks
        with open(final_path, 'wb') as outfile:
            for i in range(session['totalChunks']):
                chunk_path = os.path.join(upload_dir, f"chunk_{i:05d}")
                with open(chunk_path, 'rb') as infile:
                    outfile.write(infile.read())
        
        # Verify file size
        actual_size = os.path.getsize(final_path)
        
        # Calculate hash
        file_hash = calculate_file_hash(final_path)
        
        # Update session
        session['status'] = 'completed'
        session['finalPath'] = final_path
        session['finalSize'] = actual_size
        session['fileHash'] = file_hash
        session['completedAt'] = datetime.now().isoformat()
        save_upload_session(session)
        
        # Cleanup chunks (optional - comment out to keep for debugging)
        # import shutil
        # shutil.rmtree(upload_dir)
        
        return jsonify({
            'status': 'completed',
            'filePath': final_path,
            'filename': session['filename'],
            'fileSize': actual_size,
            'fileHash': file_hash,
            'message': 'File reassembled successfully'
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@chunked_bp.route('/abort', methods=['POST'])
def abort_upload():
    """
    Cancel/cleanup an upload session.
    Request: { "uploadId": "uuid" }
    """
    try:
        data = request.json
        upload_id = data.get('uploadId')
        
        if not upload_id:
            return jsonify({'error': 'uploadId is required'}), 400
        
        session = get_upload_session(upload_id)
        if not session:
            return jsonify({'error': 'Upload session not found'}), 404
        
        # Cleanup files
        import shutil
        upload_dir = os.path.join(CHUNKED_UPLOAD_DIR, upload_id)
        if os.path.exists(upload_dir):
            shutil.rmtree(upload_dir)
        
        # Remove session file
        session_file = os.path.join(CHUNKED_UPLOAD_DIR, f"session_{upload_id}.json")
        if os.path.exists(session_file):
            os.remove(session_file)
        
        return jsonify({'status': 'aborted', 'uploadId': upload_id}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ============================================================================
# REGISTER BLUEPRINT (Add to your app.py)
# ============================================================================

# In your app.py, add this line:
# from chunked_uploads import chunked_bp
# app.register_blueprint(chunked_bp)
