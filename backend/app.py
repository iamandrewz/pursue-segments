# Pursue Segments - Backend API
# Flask API with Gemini 2.0 Flash integration for target audience generation
# YouTube processing with yt-dlp, Whisper, and clip analysis

from flask import Flask, request, jsonify, send_from_directory, render_template, send_file, Response
from flask_cors import CORS
from werkzeug.middleware.proxy_fix import ProxyFix
import os
import json
import uuid
import re
import threading
import time
import hashlib
import subprocess
from datetime import datetime
from dotenv import load_dotenv

# Optional imports - don't crash if missing
try:
    import google.generativeai as genai
    GOOGLE_AI_AVAILABLE = True
except ImportError:
    GOOGLE_AI_AVAILABLE = False
    print("[WARN] google.generativeai not available")

try:
    from openai import OpenAI
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False
    print("[WARN] openai not available")

# Load environment variables
load_dotenv()

# Import word-level transcript module
from word_level_transcript import (
    WordLevelTranscriptParser,
    ClipWordEditor,
    get_cached_word_transcript,
    cache_word_transcript,
    create_word_transcript_from_job,
    format_timestamp,
    parse_timestamp
)

# =============================================================================
# HELPER FUNCTION: Parse transcript text to words
# =============================================================================

def parse_transcript_to_words(transcript_text, start_time, end_time):
    """
    Split transcript text into individual words with estimated timestamps.
    
    Args:
        transcript_text: Plain text transcript string
        start_time: Start time in seconds (float) or timestamp string (MM:SS or HH:MM:SS)
        end_time: End time in seconds (float) or timestamp string
    
    Returns:
        List of word dictionaries with format:
        [{text: "word", start: 0.0, end: 0.5, index: 0}, ...]
    """
    import re
    
    # Handle timestamp string inputs
    def to_seconds(ts):
        if isinstance(ts, (int, float)):
            return float(ts)
        ts = str(ts).strip()
        parts = ts.split(':')
        if len(parts) == 3:
            return int(parts[0]) * 3600 + int(parts[1]) * 60 + float(parts[2])
        elif len(parts) == 2:
            return int(parts[0]) * 60 + float(parts[1])
        return float(ts)
    
    start_sec = to_seconds(start_time)
    end_sec = to_seconds(end_time)
    duration = end_sec - start_sec
    
    # Clean and split text into words
    cleaned_text = re.sub(r'\[[^\]]*\]', '', transcript_text)  # Remove [timestamp] style
    cleaned_text = re.sub(r'\d+:\d+\.?\d*', '', cleaned_text)   # Remove time codes
    cleaned_text = re.sub(r'[^\w\s\'-]', '', cleaned_text)     # Keep apostrophes and hyphens
    cleaned_text = re.sub(r'\s+', ' ', cleaned_text).strip()   # Normalize whitespace
    
    word_list = cleaned_text.split()
    
    if not word_list:
        return []
    
    # Estimate ~0.3 seconds per word on average
    avg_word_duration = 0.3
    
    # Adjust duration if needed to avoid empty clips
    if duration <= 0:
        duration = len(word_list) * avg_word_duration
        end_sec = start_sec + duration
    
    # Calculate duration per word using actual segment duration
    words = []
    current_time = start_sec
    
    for i, word in enumerate(word_list):
        # Calculate word duration - proportionally based on word length
        word_duration = (len(word) / max(len(cleaned_text), 1)) * duration
        # Ensure minimum duration of 0.1 seconds
        word_duration = max(word_duration, 0.1)
        
        words.append({
            'text': word,
            'start': round(current_time, 2),
            'end': round(current_time + word_duration, 2),
            'index': i
        })
        
        current_time += word_duration
    
    return words


# Get the directory where this file is located
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
app = Flask(__name__, template_folder=os.path.join(BACKEND_DIR, 'templates'), static_folder=os.path.join(BACKEND_DIR, 'static'), static_url_path='/static')

# =============================================================================
# NGROK/PRODUCTION CONFIGURATION
# =============================================================================

# Trust proxy headers (ngrok, Cloudflare, etc.) - MUST be before any request handling
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1, x_prefix=1)

# Configure max content length for file uploads (2GB for ngrok/production)
app.config['MAX_CONTENT_LENGTH'] = 2 * 1024 * 1024 * 1024  # 2GB in bytes

# Increase Flask default timeout for long uploads (ngrok has 5min timeout by default)
# Note: ngrok HTTP tunnels have a 5-minute default timeout. For longer uploads,
# either use the ngrok paid plan or implement chunked uploads (already in place).
# We set Flask's internal timeout here but ngrok still needs configuration.
import socket
socket.setdefaulttimeout(600)  # 10 minutes for socket operations

# Request timeout - Flask will wait longer before killing connections
app.config['REQUEST_TIMEOUT'] = 600
app.config['RESPONSE_TIMEOUT'] = 600

# Production settings (disable debug)
app.config['DEBUG'] = False
app.config['TESTING'] = False

# Parse CORS origins from env var (comma-separated) or use defaults
cors_origins_env = os.getenv('CORS_ORIGINS')
if cors_origins_env:
    cors_origins = [origin.strip() for origin in cors_origins_env.split(',') if origin.strip()]
else:
    # Default origins for development and production (including ngrok)
    cors_origins = [
        'http://localhost:3000',
        'https://segments.pursuepodcasting.com',
        'https://pursue-segments-v5.vercel.app',
        # ngrok domains (wildcard pattern won't work with CORS, user must set CORS_ORIGINS)
    ]

# Get ngrok domain from environment if available (ngrok sets NGROK_URL or similar)
ngrok_url = os.getenv('NGROK_URL') or os.getenv('NGROK_DOMAIN')
if ngrok_url:
    # Extract origin from ngrok URL
    if ngrok_url.startswith('http'):
        from urllib.parse import urlparse
        parsed = urlparse(ngrok_url)
        ngrok_origin = f"{parsed.scheme}://{parsed.netloc}"
        cors_origins.append(ngrok_origin)
        print(f"[STARTUP] Added ngrok origin: {ngrok_origin}")

# Apply CORS to all /api/* routes
CORS(app, resources={
    r"/api/*": {
        "origins": cors_origins,
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization", "X-Requested-With"],
        "expose_headers": ["Content-Disposition"],  # For file downloads
        "supports_credentials": True if not any('*' in o for o in cors_origins) else False,
        "max_age": 3600  # Cache preflight for 1 hour
    }
})

# NUCLEAR CORS FIX: Manually add CORS headers to ALL responses (including ngrok)
@app.after_request
def after_request(response):
    # Get the request's origin for dynamic CORS
    request_origin = request.headers.get('Origin', '*')
    
    # Use configured origins or allow all if in development
    allowed_origins = cors_origins if cors_origins else ['*']
    
    # If origin is in allowed list, use it; otherwise use first allowed or *
    if request_origin in allowed_origins:
        response.headers.add('Access-Control-Allow-Origin', request_origin)
    elif '*' in allowed_origins:
        response.headers.add('Access-Control-Allow-Origin', '*')
    elif allowed_origins:
        response.headers.add('Access-Control-Allow-Origin', allowed_origins[0])
    else:
        response.headers.add('Access-Control-Allow-Origin', '*')
    
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Requested-With')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    response.headers.add('Access-Control-Expose-Headers', 'Content-Disposition')
    response.headers.add('Access-Control-Max-Age', '3600')
    
    # Handle ngrok-specific headers
    # ngrok adds these headers - we pass them through but don't need special handling
    # ngrok-skip-browser-warning is sometimes sent by clients
    
    return response

# Chunked upload routes added below after DATA_DIR definition
    """Save upload session data"""
    session_file = os.path.join(CHUNKED_UPLOAD_DIR, f"session_{session_data['id']}.json")
    with open(session_file, 'w') as f:
        json.dump(session_data, f, indent=2)

# Serve chunked-uploader.js from templates folder
@app.route('/chunked-uploader.js')
def serve_chunked_uploader():
    return send_from_directory(os.path.join(BACKEND_DIR, 'templates'), 'chunked-uploader.js')

# CHUNKED UPLOAD ROUTES (inline for Render compatibility)
@app.route('/api/chunked/initiate', methods=['POST'])
def initiate_chunked_upload():
    """Start a new chunked upload"""
    try:
        data = request.json
        filename = data.get('filename')
        file_size = data.get('fileSize')
        chunk_size = data.get('chunkSize', CHUNK_SIZE)

        if not filename or not file_size:
            return jsonify({'error': 'filename and fileSize are required'}), 400

        upload_id = str(uuid.uuid4())
        total_chunks = (file_size + chunk_size - 1) // chunk_size

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

        upload_dir = os.path.join(CHUNKED_UPLOAD_DIR, upload_id)
        os.makedirs(upload_dir, exist_ok=True)
        save_upload_session(session_data)

        return jsonify({
            'uploadId': upload_id,
            'chunkSize': chunk_size,
            'totalChunks': total_chunks,
            'status': 'in_progress'
        }), 202
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/chunked/upload', methods=['POST'])
def upload_chunk():
    """Upload a single chunk"""
    try:
        upload_id = request.form.get('uploadId')
        chunk_index = int(request.form.get('chunkIndex', 0))

        if not upload_id:
            return jsonify({'error': 'uploadId is required'}), 400

        if 'chunk' not in request.files:
            return jsonify({'error': 'No chunk file provided'}), 400

        chunk_file = request.files['chunk']
        session = get_upload_session(upload_id)

        if not session:
            return jsonify({'error': 'Upload session not found'}), 404

        if session['status'] != 'in_progress':
            return jsonify({'error': f'Upload already completed or failed'}), 400

        if chunk_index in session['uploadedChunks']:
            return jsonify({
                'chunkIndex': chunk_index,
                'chunksUploaded': len(session['uploadedChunks']),
                'progress': len(session['uploadedChunks']) / session['totalChunks'] * 100
            }), 200

        upload_dir = os.path.join(CHUNKED_UPLOAD_DIR, upload_id)
        chunk_path = os.path.join(upload_dir, f"chunk_{chunk_index:05d}")
        chunk_file.save(chunk_path)

        session['uploadedChunks'].append(chunk_index)
        session['updatedAt'] = datetime.now().isoformat()
        save_upload_session(session)

        progress = len(session['uploadedChunks']) / session['totalChunks'] * 100

        return jsonify({
            'chunkIndex': chunk_index,
            'chunksUploaded': len(session['uploadedChunks']),
            'totalChunks': session['totalChunks'],
            'progress': progress
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/chunked/status/<upload_id>', methods=['GET'])
def get_chunked_status(upload_id):
    """Get upload progress/status"""
    try:
        session = get_upload_session(upload_id)
        if not session:
            return jsonify({'error': 'Upload session not found'}), 404

        response = {
            'status': session['status'],
            'filename': session['filename'],
            'fileSize': session['fileSize'],
            'chunksUploaded': len(session['uploadedChunks']),
            'totalChunks': session['totalChunks'],
            'progress': len(session['uploadedChunks']) / session['totalChunks'] * 100
        }
        
        # Include file path if completed
        if session['status'] == 'completed':
            response['finalPath'] = session.get('finalPath')
            response['finalSize'] = session.get('finalSize')
        
        # Include error if failed
        if session['status'] == 'error':
            response['error'] = session.get('error', 'Unknown error')
            
        return jsonify(response), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def reassemble_file_async(upload_id, session):
    """Background task to reassemble chunks"""
    print(f"[CHUNKED] Starting reassembly for {upload_id}, {session['totalChunks']} chunks")
    try:
        upload_dir = os.path.join(CHUNKED_UPLOAD_DIR, upload_id)
        final_dir = os.path.join(DATA_DIR, 'uploads')
        os.makedirs(final_dir, exist_ok=True)
        
        print(f"[CHUNKED] Upload dir: {upload_dir}")
        print(f"[CHUNKED] Final dir: {final_dir}")
        
        # Check disk space
        import shutil
        stat = shutil.disk_usage(final_dir)
        print(f"[CHUNKED] Disk space: {stat.free / (1024**3):.2f} GB free")

        final_filename = f"{upload_id}_{session['filename']}"
        final_path = os.path.join(final_dir, final_filename)
        
        print(f"[CHUNKED] Reassembling to: {final_path}")

        # Combine chunks (stream and delete to save disk space)
        with open(final_path, 'wb') as outfile:
            for i in range(session['totalChunks']):
                chunk_path = os.path.join(upload_dir, f"chunk_{i:05d}")
                if not os.path.exists(chunk_path):
                    raise Exception(f"Chunk {i} not found at {chunk_path}")
                with open(chunk_path, 'rb') as infile:
                    outfile.write(infile.read())
                # Delete chunk immediately after writing
                try:
                    os.remove(chunk_path)
                except:
                    pass
                
                if i % 50 == 0:
                    print(f"[CHUNKED] Processed {i}/{session['totalChunks']} chunks")

        actual_size = os.path.getsize(final_path)
        print(f"[CHUNKED] Final file size: {actual_size} bytes")
        
        # Clean up upload directory
        try:
            os.rmdir(upload_dir)
        except:
            pass

        # Update session
        session['status'] = 'completed'
        session['finalPath'] = final_path
        session['finalSize'] = actual_size
        session['completedAt'] = datetime.now().isoformat()
        save_upload_session(session)
        
        print(f"[CHUNKED] Reassembly complete: {final_path}")
    except Exception as e:
        print(f"[CHUNKED] Reassembly failed: {e}")
        import traceback
        traceback.print_exc()
        session['status'] = 'error'
        session['error'] = str(e)
        save_upload_session(session)

@app.route('/api/chunked/complete', methods=['POST'])
def complete_chunked_upload():
    """Finalize upload - start async reassembly"""
    try:
        data = request.json
        upload_id = data.get('uploadId') if data else None

        if not upload_id:
            return jsonify({'error': 'uploadId is required'}), 400

        session = get_upload_session(upload_id)
        if not session:
            return jsonify({'error': 'Upload session not found'}), 404

        if session['status'] == 'completed':
            return jsonify({
                'status': 'completed',
                'filePath': session.get('finalPath'),
                'message': 'Upload already completed'
            }), 200
            
        if session['status'] == 'processing':
            return jsonify({
                'status': 'processing',
                'message': 'File reassembly in progress...'
            }), 200

        # Check if all chunks uploaded
        expected_chunks = set(range(session['totalChunks']))
        uploaded_chunks = set(session['uploadedChunks'])
        missing_chunks = expected_chunks - uploaded_chunks

        if missing_chunks:
            return jsonify({
                'error': f'Missing chunks: {sorted(missing_chunks)[:10]}',
                'missingCount': len(missing_chunks)
            }), 400

        # Mark as processing and start background task
        session['status'] = 'processing'
        save_upload_session(session)
        
        thread = threading.Thread(
            target=reassemble_file_async,
            args=(upload_id, session)
        )
        thread.daemon = True
        thread.start()

        return jsonify({
            'status': 'processing',
            'message': 'File reassembly started. Poll /api/chunked/status to check progress.'
        }), 202
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

# Configure APIs - lazy loading with error handling
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')
openai_client = None

if GOOGLE_AI_AVAILABLE and GEMINI_API_KEY:
    try:
        genai.configure(api_key=GEMINI_API_KEY)
        print("[STARTUP] Gemini configured")
    except Exception as e:
        print(f"[STARTUP] Gemini config error: {e}")

if OPENAI_AVAILABLE and OPENAI_API_KEY:
    try:
        openai_client = OpenAI(api_key=OPENAI_API_KEY)
        print("[STARTUP] OpenAI client configured")
    except Exception as e:
        print(f"[STARTUP] OpenAI config error: {e}")

# Data storage directories
DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')
JOBS_DIR = os.path.join(DATA_DIR, 'jobs')
TRANSCRIPTS_DIR = os.path.join(DATA_DIR, 'transcripts')

os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(JOBS_DIR, exist_ok=True)
os.makedirs(TRANSCRIPTS_DIR, exist_ok=True)

# Chunked upload configuration
CHUNKED_UPLOAD_DIR = os.path.join(DATA_DIR, 'chunked_uploads')
CHUNK_SIZE = 10 * 1024 * 1024  # 10MB chunks
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

# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

def save_data(filename, data, directory=DATA_DIR):
    """Save data to JSON file"""
    filepath = os.path.join(directory, filename)
    with open(filepath, 'w') as f:
        json.dump(data, f, indent=2)
    return filepath

def load_data(filename, directory=DATA_DIR):
    """Load data from JSON file"""
    filepath = os.path.join(directory, filename)
    if os.path.exists(filepath):
        with open(filepath, 'r') as f:
            return json.load(f)
    return None

def extract_youtube_id(url):
    """Extract YouTube video ID from various URL formats"""
    patterns = [
        r'(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/)([^&\s?#]+)',
        r'^([a-zA-Z0-9_-]{11})$'  # Direct video ID
    ]

    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return None

def parse_timestamp_to_seconds(timestamp_str):
    """Convert timestamp string (HH:MM:SS or MM:SS) or integer to seconds"""
    # Handle both string and numeric inputs
    timestamp_str = str(timestamp_str).strip()
    parts = timestamp_str.split(':')
    if len(parts) == 3:
        return int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])
    elif len(parts) == 2:
        return int(parts[0]) * 60 + int(parts[1])
    return int(parts[0])

def format_seconds_to_timestamp(seconds):
    """Convert seconds to MM:SS or HH:MM:SS format"""
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)

    if hours > 0:
        return f"{hours}:{minutes:02d}:{secs:02d}"
    return f"{minutes}:{secs:02d}"

def calculate_duration(start_time, end_time):
    """Calculate duration between two timestamps in minutes"""
    start_seconds = parse_timestamp_to_seconds(start_time)
    end_seconds = parse_timestamp_to_seconds(end_time)
    duration_minutes = (end_seconds - start_seconds) / 60
    return round(duration_minutes, 1)

# ============================================================================
# PROMPT TEMPLATES
# ============================================================================

PROFILE_GENERATION_PROMPT = """You are an expert YouTube Podcast Content Strategist and audience persona specialist.
Write a short, punchy Target Audience & Responsibilities Outline for {podcast_name}, based on the questions and answers submitted by the Podcast Host below. The output must be no longer than 400-450 words and must follow the same structure, tone, and paragraph length.

Follow this structure EXACTLY:

1. Start with:
Hello,

2. Next line:
You are now the Head of Podcast Content Strategy for {podcast_name}. Your mission is to ensure every episode we publish-especially on YouTube and podcast platforms-is optimized to attract, engage, and convert our ideal audience.

3. Add a heading line:
Our target audience:

4. Then write 8-10 short paragraphs (1-2 sentences each) that:
   - Describe who they are (role, age, gender, location, income, education).
   - Describe their mindset and values.
   - Describe their interests and passions.
   - Describe their biggest pain points and frustrations.
   - Describe how and when they listen to podcasts.
   - Describe what other content creators/podcasts they follow.
   - Describe what platforms they're on and what they like to consume.

5. Each paragraph should be concise and written in the same style as this example:
Primarily [insert profession], mostly [insert gender], ages [insert age range], with a strong presence in [insert location].

6. After those audience paragraphs, add a heading line:
Your responsibilities:

7. Then write 5-7 bullet points that describe how to create and position content for this audience, including:
   - Titles, descriptions, and thumbnails.
   - Core challenges to address.
   - Types of stories, case studies, and "hot takes."
   - The specific CTAs (newsletter, courses, services, etc.).
   - The overall emotional tone and community feel we want to create.

8. End with one final sentence that starts with:
Your goal is to make The {podcast_name} the go-to resource for [target audience] who want to [insert three goals].

Now, here are the questionnaire answers for {podcast_name}. Use ONLY the format above to create the final outline:

Podcast Name: {podcast_name}
Host Name(s): {host_names}

SECTION 1: Audience Discovery
{section1}

SECTION 2: Demographic Basics
{section2}

SECTION 3: Professional Life
{section3}

SECTION 4: Personal Life
{section4}

SECTION 5: Media Consumption
{section5}

SECTION 6: Psychographics
{section6}

SECTION 7: Relationship to Your Podcast
{section7}
"""

CLIP_ANALYSIS_PROMPT = """You are a podcast clip expert with deep knowledge of viral content, storytelling, and audience engagement. Your task is to analyze the provided transcript and identify 3-5 segments that would make excellent long-form clips (8-20 minutes each).

TARGET AUDIENCE PROFILE:
%(target_audience_profile)s

TRANSCRIPT (with timestamps):
%(transcript)s

CRITICAL INSTRUCTIONS FOR TIMESTAMPS:
The transcript above contains timestamps in [MM:SS] or [HH:MM:SS] format.
You MUST use the EXACT timestamps from the transcript - do not invent or estimate times.

For each clip:
1. Find the hook/start point in the transcript and note its timestamp
2. Find the natural end point and note its timestamp  
3. Calculate duration from these exact timestamps
4. Use the EXACT format shown in the transcript (e.g., "02:28" not "2:28")

ANALYSIS CRITERIA:
For each clip, find segments that have:
1. Strong HOOK potential - Look for contrast statements, surprising revelations, or emotional reactions
2. COMPLETE STORY ARC - Clear beginning, middle, and satisfying conclusion (not just a fragment)
3. Specific moments with numbers, results, or concrete examples
4. Natural sentence boundaries (look for transitions like "Now," "So," "Anyways," "Here's the thing")
5. Content that resonates with the target audience's pain points and interests

MANDATORY LENGTH REQUIREMENT:
- MINIMUM 5 minutes per clip - NO EXCEPTIONS
- Target range: 5-15 minutes
- Ideal length: 7-10 minutes for maximum engagement
- Every clip MUST be at least 5 minutes long - if you find a great segment under 5 min, extend it to include the full context

IMPORTANT TIMING GUIDELINES:
- Find the HOOK 30-60 seconds BEFORE the main valuable content
- Ensure the clip ends at a natural stopping point (completes the thought/story)
- The clip must feel like a complete segment, not a snippet
- Do NOT suggest clips under 5 minutes - combine adjacent valuable content if needed

For each clip, provide:
1. start_timestamp - EXACT timestamp from transcript when hook begins (e.g., "02:28")
2. end_timestamp - EXACT timestamp from transcript when clip ends (e.g., "05:04")
3. duration_minutes - Calculated from timestamps above (e.g., 2.6)
4. title_options - THREE different title options
5. engaging_quote - Most compelling 1-2 sentence quote
6. transcript_excerpt - 200-300 words from the key part
7. why_it_works - Why this segment resonates

Return ONLY a valid JSON array:
[
  {
    "start_timestamp": "02:28",
    "end_timestamp": "05:04",
    "duration_minutes": 2.6,
    "title_options": {"punchy": "...", "benefit": "...", "curiosity": "..."},
    "engaging_quote": "...",
    "transcript_excerpt": "...",
    "why_it_works": "..."
  }
]

CRITICAL:
- Use ONLY timestamps that appear in the transcript
- Match the exact format: [MM:SS] or [HH:MM:SS]
- Return valid JSON only"""

# ============================================================================
# PROFILE GENERATION FUNCTIONS
# ============================================================================

def format_section_answers(answers, section_name):
    """Format answers for a specific section"""
    formatted = []
    for key, value in answers.items():
        if section_name in key:
            question_num = key.replace(section_name, '').replace('_', '. ')
            formatted.append(f"{question_num}. {value}")
    return '\n'.join(formatted) if formatted else "No answers provided."

def generate_profile_with_gemini(podcast_name, host_names, answers):
    """Generate target audience profile using Gemini 2.0 Flash"""

    print(f"[DEBUG] Starting profile generation for podcast: {podcast_name}")

    if not GEMINI_API_KEY:
        print("[ERROR] Gemini API key not configured")
        raise Exception("Gemini API key not configured. Please contact support.")

    try:
        # Format all sections
        section_map = {
            'section1': 'q1',
            'section2': 'q2',
            'section3': 'q3',
            'section4': 'q4',
            'section5': 'q5',
            'section6': 'q6',
            'section7': 'q7'
        }

        formatted_sections = {}
        for section_key, section_prefix in section_map.items():
            section_answers = {k: v for k, v in answers.items() if k.startswith(section_prefix)}
            formatted_lines = []
            for q_key, value in sorted(section_answers.items()):
                q_num = q_key.replace(section_prefix, '').strip('_')
                formatted_lines.append(f"{q_num}. {value}")
            formatted_sections[section_key] = '\n'.join(formatted_lines) if formatted_lines else "No answers provided."

        print(f"[DEBUG] Formatted sections: {list(formatted_sections.keys())}")

        # Build the prompt
        prompt = PROFILE_GENERATION_PROMPT.format(
            podcast_name=podcast_name,
            host_names=host_names,
            section1=formatted_sections['section1'],
            section2=formatted_sections['section2'],
            section3=formatted_sections['section3'],
            section4=formatted_sections['section4'],
            section5=formatted_sections['section5'],
            section6=formatted_sections['section6'],
            section7=formatted_sections['section7']
        )

        print(f"[DEBUG] Calling Gemini API...")

        # Call Gemini API
        model = genai.GenerativeModel('gemini-1.5-flash')
        response = model.generate_content(
            prompt,
            generation_config=genai.types.GenerationConfig(
                temperature=0.7,
                max_output_tokens=800,
            )
        )

        print(f"[DEBUG] Gemini API response received, length: {len(response.text) if response.text else 0}")

        if not response.text:
            raise Exception("Gemini returned empty response")

        return response.text

    except Exception as e:
        print(f"[ERROR] Error generating profile: {str(e)}")
        raise Exception(f"Failed to generate profile: {str(e)}")

# ============================================================================
# YOUTUBE PROCESSING FUNCTIONS
# ============================================================================

def update_job_status(job_id, status, progress_message=None, **kwargs):
    """Update job status and save to file"""
    job_file = os.path.join(JOBS_DIR, f"job_{job_id}.json")

    job_data = load_data(f"job_{job_id}.json", JOBS_DIR) or {}
    job_data['status'] = status
    job_data['updatedAt'] = datetime.now().isoformat()

    if progress_message:
        job_data['progressMessage'] = progress_message

    # Update any additional fields
    for key, value in kwargs.items():
        job_data[key] = value

    save_data(f"job_{job_id}.json", job_data, JOBS_DIR)
    return job_data

def download_youtube_audio(youtube_url, video_id, output_dir='/tmp'):
    """Download audio from YouTube video using yt-dlp"""
    import subprocess

    output_path = os.path.join(output_dir, f"{video_id}.mp3")

    # Path to cookies file (for YouTube authentication)
    cookies_path = os.path.join(DATA_DIR, 'youtube.txt')

    # yt-dlp command for audio-only download
    cmd = [
        'yt-dlp',
        '--format', 'bestaudio/best',
        '--extract-audio',
        '--audio-format', 'mp3',
        '--audio-quality', '0',
        '--output', output_path,
        '--no-playlist',
        '--quiet',
        '--no-warnings'
    ]

    # Add cookies if file exists
    if os.path.exists(cookies_path):
        cmd.extend(['--cookies', cookies_path])
        print(f"[DEBUG] Using cookies from {cookies_path}")

    cmd.append(youtube_url)

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
        if result.returncode != 0:
            raise Exception(f"yt-dlp failed: {result.stderr}")

        if not os.path.exists(output_path):
            # Try to find the file with possible suffix
            possible_files = [f for f in os.listdir(output_dir) if f.startswith(video_id) and f.endswith('.mp3')]
            if possible_files:
                output_path = os.path.join(output_dir, possible_files[0])
            else:
                raise Exception("Audio file not found after download")

        return output_path
    except subprocess.TimeoutExpired:
        raise Exception("Download timed out after 5 minutes")
    except Exception as e:
        raise Exception(f"Failed to download audio: {str(e)}")

def split_audio_for_whisper(audio_path, video_id, chunk_duration_minutes=10):
    """Split large audio file into chunks for Whisper (25MB limit)"""
    import subprocess
    import math

    # Get audio duration
    cmd = ['ffprobe', '-v', 'error', '-show_entries', 'format=duration',
           '-of', 'default=noprint_wrappers=1:nokey=1', audio_path]
    result = subprocess.run(cmd, capture_output=True, text=True)
    total_duration = float(result.stdout.strip())

    chunk_duration = chunk_duration_minutes * 60  # Convert to seconds
    num_chunks = math.ceil(total_duration / chunk_duration)

    chunks_dir = os.path.join(TRANSCRIPTS_DIR, f"chunks_{video_id}")
    os.makedirs(chunks_dir, exist_ok=True)

    chunk_files = []
    for i in range(num_chunks):
        start_time = i * chunk_duration
        chunk_path = os.path.join(chunks_dir, f"chunk_{i:03d}.mp3")

        # Extract chunk
        cmd = [
            'ffmpeg', '-y',
            '-i', audio_path,
            '-ss', str(start_time),
            '-t', str(chunk_duration),
            '-vn', '-acodec', 'libmp3lame',
            '-ar', '16000', '-ac', '1', '-b:a', '32k',
            chunk_path
        ]
        subprocess.run(cmd, capture_output=True)

        if os.path.exists(chunk_path):
            chunk_files.append((chunk_path, start_time))

    return chunk_files, total_duration

def transcribe_with_whisper(audio_path, video_id):
    """Transcribe audio using OpenAI Whisper API - splits large files"""
    if not openai_client:
        raise Exception("OpenAI API key not configured")

    # Check if transcript already exists (caching)
    transcript_file = os.path.join(TRANSCRIPTS_DIR, f"transcript_{video_id}.json")
    if os.path.exists(transcript_file):
        return load_data(f"transcript_{video_id}.json", TRANSCRIPTS_DIR)

    # Check file size
    file_size = os.path.getsize(audio_path)
    print(f"[WHISPER] Audio file size: {file_size / (1024*1024):.1f} MB")

    # If file is small enough, transcribe directly
    if file_size < 24 * 1024 * 1024:  # Under 24MB
        print(f"[WHISPER] Transcribing directly...")
        with open(audio_path, 'rb') as audio_file:
            response = openai_client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file,
                response_format="verbose_json",
                timestamp_granularities=["segment"]
            )

        segments = []
        full_text = ""
        for segment in response.segments:
            start_time = format_seconds_to_timestamp(segment.start)
            end_time = format_seconds_to_timestamp(segment.end)
            text = segment.text.strip()
            segments.append({
                'start': start_time, 'end': end_time, 'text': text,
                'start_seconds': segment.start, 'end_seconds': segment.end
            })
            full_text += f"[{start_time}] {text}\n"

        transcript_data = {
            'videoId': video_id, 'segments': segments, 'fullText': full_text,
            'duration': format_seconds_to_timestamp(response.duration),
            'createdAt': datetime.now().isoformat()
        }
        save_data(f"transcript_{video_id}.json", transcript_data, TRANSCRIPTS_DIR)
        return transcript_data

    # File too large - split into chunks
    print(f"[WHISPER] File too large, splitting into chunks...")
    chunk_files, total_duration = split_audio_for_whisper(audio_path, video_id)
    print(f"[WHISPER] Split into {len(chunk_files)} chunks")

    all_segments = []
    full_text = ""

    for idx, (chunk_path, chunk_offset) in enumerate(chunk_files):
        print(f"[WHISPER] Transcribing chunk {idx+1}/{len(chunk_files)}...")

        with open(chunk_path, 'rb') as audio_file:
            response = openai_client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file,
                response_format="verbose_json",
                timestamp_granularities=["segment"]
            )

        for segment in response.segments:
            # Adjust timestamps for chunk offset
            adjusted_start = segment.start + chunk_offset
            adjusted_end = segment.end + chunk_offset

            start_time = format_seconds_to_timestamp(adjusted_start)
            end_time = format_seconds_to_timestamp(adjusted_end)
            text = segment.text.strip()

            all_segments.append({
                'start': start_time, 'end': end_time, 'text': text,
                'start_seconds': adjusted_start, 'end_seconds': adjusted_end
            })
            full_text += f"[{start_time}] {text}\n"

        # Clean up chunk file
        try:
            os.remove(chunk_path)
        except:
            pass

    # Clean up chunks directory
    try:
        chunks_dir = os.path.join(TRANSCRIPTS_DIR, f"chunks_{video_id}")
        os.rmdir(chunks_dir)
    except:
        pass

    transcript_data = {
        'videoId': video_id,
        'segments': all_segments,
        'fullText': full_text,
        'duration': format_seconds_to_timestamp(total_duration),
        'createdAt': datetime.now().isoformat()
    }

    save_data(f"transcript_{video_id}.json", transcript_data, TRANSCRIPTS_DIR)
    print(f"[WHISPER] Transcription complete: {len(all_segments)} segments")
    return transcript_data

def analyze_clips_with_gemini(transcript_text, target_audience_profile):
    """Analyze transcript and suggest clips using OpenAI GPT (renamed for backwards compat)"""
    try:
        if not OPENAI_AVAILABLE or not openai_client:
            print("[WARN] OpenAI not available, returning fallback")
            return [{
                'start_timestamp': '00:00',
                'end_timestamp': '10:00',
                'duration_minutes': 10,
                'title_options': {
                    'punchy': 'OpenAI API not configured',
                    'benefit': 'Check API key',
                    'curiosity': 'Add OPENAI_API_KEY'
                },
                'engaging_quote': 'OpenAI API key is missing or invalid.',
                'transcript_excerpt': 'Transcript processed but clip analysis requires OpenAI API.',
                'why_it_works': 'Please configure OPENAI_API_KEY environment variable.'
            }]

        # Build the prompt
        prompt = CLIP_ANALYSIS_PROMPT % {
            'target_audience_profile': target_audience_profile,
            'transcript': transcript_text[:150000]
        }

        print("[INFO] Calling OpenAI GPT-4 for clip analysis...")

        # Call OpenAI API with JSON mode for guaranteed valid JSON
        response = openai_client.chat.completions.create(
            model="gpt-4o-mini",  # Fast and cheap
            messages=[
                {"role": "system", "content": "You are a podcast clip analysis expert. Always return valid JSON."},
                {"role": "user", "content": prompt}
            ],
            response_format={"type": "json_object"},
            temperature=0.7,
            max_tokens=2000
        )

        # Parse the JSON response
        response_text = response.choices[0].message.content
        print(f"[DEBUG] OpenAI response: {response_text[:500]}")

        # OpenAI returns an object, we need the array inside
        result = json.loads(response_text)

        # Handle both {clips: [...]} and [...] formats
        if isinstance(result, list):
            clips = result
        elif isinstance(result, dict):
            clips = result.get('clips', result.get('results', []))
        else:
            clips = []

        if not clips:
            print("[WARN] No clips returned from OpenAI")
            return [{
                'start_timestamp': '00:00',
                'end_timestamp': '10:00',
                'duration_minutes': 10,
                'title_options': {
                    'punchy': 'No clips found',
                    'benefit': 'Try longer video',
                    'curiosity': '8-20 min clips'
                },
                'engaging_quote': 'No suitable clips were found in this video.',
                'transcript_excerpt': 'The AI analyzed the transcript but could not identify strong clip candidates.',
                'why_it_works': 'Clips need strong hooks, complete stories, and valuable content.'
            }]

        # Validate and clean up clips
        validated_clips = []
        for i, clip in enumerate(clips):
            try:
                if not isinstance(clip, dict):
                    print(f"[WARN] Clip {i} is not a dict: {type(clip)}")
                    continue

                validated_clip = {
                    'start_timestamp': str(clip.get('start_timestamp', '00:00')),
                    'end_timestamp': str(clip.get('end_timestamp', '00:00')),
                    'duration_minutes': clip.get('duration_minutes', 10),
                    'title_options': clip.get('title_options', {
                        'punchy': 'Clip ' + str(i+1),
                        'benefit': 'Valuable Content',
                        'curiosity': 'Must Watch'
                    }),
                    'engaging_quote': str(clip.get('engaging_quote', '')),
                    'transcript_excerpt': str(clip.get('transcript_excerpt', '')),
                    'why_it_works': str(clip.get('why_it_works', ''))
                }
                validated_clips.append(validated_clip)
            except Exception as e:
                print(f"[WARN] Failed to validate clip {i}: {e}")
                continue

        print(f"[INFO] Successfully validated {len(validated_clips)} clips")
        return validated_clips if validated_clips else [{
            'start_timestamp': '00:00',
            'end_timestamp': '10:00',
            'duration_minutes': 10,
            'title_options': {'punchy': 'Processing Error', 'benefit': 'Try Again', 'curiosity': 'Check Logs'},
            'engaging_quote': 'Clip validation failed.',
            'transcript_excerpt': 'The AI returned clips but they could not be validated.',
            'why_it_works': 'Fallback response due to validation issues.'
        }]

    except Exception as e:
        import traceback
        print(f"[FATAL ERROR] analyze_clips failed: {e}")
        print(f"[FATAL ERROR] Traceback: {traceback.format_exc()}")
        return [{
            'start_timestamp': '00:00',
            'end_timestamp': '10:00',
            'duration_minutes': 10,
            'title_options': {'punchy': f'Error: {str(e)[:30]}', 'benefit': 'Check Logs', 'curiosity': 'See Console'},
            'engaging_quote': f'Analysis failed: {str(e)}',
            'transcript_excerpt': 'An error occurred during clip analysis.',
            'why_it_works': 'This is a fallback response due to a processing error.'
        }]

def process_episode_async(job_id, youtube_url, video_id, podcast_name, profile_id=None):
    """Process episode in background thread"""
    audio_path = None

    try:
        # Step 1: Download audio
        update_job_status(job_id, 'downloading', 'Downloading audio from YouTube...')
        audio_path = download_youtube_audio(youtube_url, video_id)

        # Step 2: Transcribe
        update_job_status(job_id, 'transcribing', 'Transcribing audio with Whisper...')
        transcript_data = transcribe_with_whisper(audio_path, video_id)

        # Step 3: Get target audience profile
        update_job_status(job_id, 'analyzing', 'Retrieving target audience profile...')

        target_audience_profile = ""
        if profile_id:
            profile_data = load_data(f"profile_{profile_id}.json", DATA_DIR)
            if profile_data:
                target_audience_profile = profile_data.get('profile', '')

        # If no profile, use a default
        if not target_audience_profile:
            target_audience_profile = f"Target audience for {podcast_name}. Engaged listeners interested in podcast content."

        # Step 4: Analyze clips
        update_job_status(job_id, 'analyzing', 'AI analyzing segments for clip opportunities...')
        clips = analyze_clips_with_gemini(transcript_data['fullText'], target_audience_profile)

        # Step 5: Complete
        update_job_status(
            job_id,
            'complete',
            'Analysis complete!',
            transcript=transcript_data,
            clips=clips,
            clipCount=len(clips)
        )

    except Exception as e:
        update_job_status(job_id, 'failed', f'Error: {str(e)}', error=str(e))
    finally:
        # Cleanup temp audio file
        if audio_path and os.path.exists(audio_path):
            try:
                os.remove(audio_path)
            except:
                pass

def process_file_async(job_id, file_path, video_id, podcast_name, profile_id=None):
    """Process uploaded file in background thread"""
    try:
        # Step 1: Extract audio from uploaded video
        update_job_status(job_id, 'downloading', 'Extracting audio from video...')
        audio_path = extract_audio_from_file(file_path, video_id)

        # Step 2: Transcribe
        update_job_status(job_id, 'transcribing', 'Transcribing audio with Whisper...')
        transcript_data = transcribe_with_whisper(audio_path, video_id)

        # Step 3: Get target audience profile
        update_job_status(job_id, 'analyzing', 'Retrieving target audience profile...')

        target_audience_profile = ""
        if profile_id:
            profile_data = load_data(f"profile_{profile_id}.json", DATA_DIR)
            if profile_data:
                target_audience_profile = profile_data.get('profile', '')

        # If no profile, use a default
        if not target_audience_profile:
            target_audience_profile = f"Target audience for {podcast_name}. Engaged listeners interested in podcast content."

        # Step 4: Analyze clips
        update_job_status(job_id, 'analyzing', 'AI analyzing segments for clip opportunities...')
        clips = analyze_clips_with_gemini(transcript_data['fullText'], target_audience_profile)

        # Step 5: Complete
        update_job_status(
            job_id,
            'complete',
            'Analysis complete!',
            transcript=transcript_data,
            clips=clips,
            clipCount=len(clips)
        )

    except Exception as e:
        update_job_status(job_id, 'failed', f'Error: {str(e)}', error=str(e))
    finally:
        # Cleanup temp audio file only (keep video for clip extraction)
        if audio_path and os.path.exists(audio_path):
            try:
                os.remove(audio_path)
            except:
                pass
        # NOTE: We keep file_path (original video) for clip download feature

def extract_audio_from_file(file_path, video_id, output_dir='/tmp'):
    """Extract audio from uploaded video file using ffmpeg - optimized for Whisper (25MB limit)"""
    import subprocess

    output_path = os.path.join(output_dir, f"{video_id}.mp3")

    # First pass: extract with good quality
    cmd = [
        'ffmpeg',
        '-i', file_path,
        '-vn',  # No video
        '-acodec', 'libmp3lame',
        '-ar', '16000',  # 16kHz is good for speech recognition
        '-ac', '1',  # Mono (smaller file)
        '-b:a', '24k',  # Lower bitrate for memory efficiency
        '-threads', '1',  # Limit threads for Render
        '-y',
        output_path
    ]

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
        if result.returncode != 0:
            raise Exception(f"ffmpeg failed: {result.stderr}")

        if not os.path.exists(output_path):
            raise Exception("Audio file not found after extraction")

        # Check file size - Whisper limit is 25MB
        file_size = os.path.getsize(output_path)
        print(f"[AUDIO] Extracted {file_size} bytes ({file_size / (1024*1024):.1f} MB)")

        if file_size > 24 * 1024 * 1024:  # If over 24MB, re-encode with lower quality
            print(f"[AUDIO] File too large ({file_size / (1024*1024):.1f} MB), re-encoding...")
            temp_path = output_path + '.tmp.mp3'

            # Re-encode at even lower bitrate
            cmd2 = [
                'ffmpeg',
                '-i', output_path,
                '-vn',
                '-acodec', 'libmp3lame',
                '-ar', '16000',
                '-ac', '1',
                '-b:a', '16k',  # Very low bitrate for speech
                '-y',
                temp_path
            ]

            result2 = subprocess.run(cmd2, capture_output=True, text=True, timeout=300)
            if result2.returncode == 0 and os.path.exists(temp_path):
                os.replace(temp_path, output_path)
                new_size = os.path.getsize(output_path)
                print(f"[AUDIO] Re-encoded to {new_size} bytes ({new_size / (1024*1024):.1f} MB)")

        return output_path
    except subprocess.TimeoutExpired:
        raise Exception("Audio extraction timed out after 10 minutes")
    except Exception as e:
        raise Exception(f"Failed to extract audio: {str(e)}")

# ============================================================================
# API ROUTES - PROFILE (EXISTING)
# ============================================================================

@app.route('/api/health', methods=['GET', 'OPTIONS'])
def health_check():
    """Health check endpoint - keep it simple to prevent Railway timeouts"""
    if request.method == 'OPTIONS':
        return '', 204
    try:
        return jsonify({'status': 'healthy'}), 200
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/api/questionnaire', methods=['POST', 'OPTIONS'])
def save_questionnaire():
    """Save questionnaire answers"""
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data = request.json

        if not data.get('podcastName'):
            return jsonify({'error': 'Podcast name is required'}), 400

        if not data.get('answers'):
            return jsonify({'error': 'Answers are required'}), 400

        questionnaire_id = str(uuid.uuid4())

        questionnaire_data = {
            'id': questionnaire_id,
            'podcastName': data['podcastName'],
            'hostNames': data.get('hostNames', ''),
            'answers': data['answers'],
            'createdAt': datetime.now().isoformat(),
            'status': 'completed'
        }

        filename = f"questionnaire_{questionnaire_id}.json"
        save_data(filename, questionnaire_data)

        return jsonify({
            'id': questionnaire_id,
            'status': 'success',
            'message': 'Questionnaire saved successfully'
        }), 201

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/questionnaire/<questionnaire_id>', methods=['GET', 'OPTIONS'])
def get_questionnaire(questionnaire_id):
    """Get questionnaire by ID"""
    if request.method == 'OPTIONS':
        return '', 204
    try:
        filename = f"questionnaire_{questionnaire_id}.json"
        data = load_data(filename)

        if not data:
            return jsonify({'error': 'Questionnaire not found'}), 404

        return jsonify(data), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/generate-profile', methods=['POST', 'OPTIONS'])
def generate_profile():
    """Generate target audience profile from questionnaire"""
    if request.method == 'OPTIONS':
        return '', 204
    print(f"[DEBUG] /api/generate-profile called")

    try:
        data = request.json
        print(f"[DEBUG] Request data: {data}")

        if not data:
            return jsonify({'error': 'No data provided'}), 400

        questionnaire_id = data.get('questionnaireId')

        if not questionnaire_id:
            print("[ERROR] Questionnaire ID missing")
            return jsonify({'error': 'Questionnaire ID is required'}), 400

        filename = f"questionnaire_{questionnaire_id}.json"
        questionnaire = load_data(filename)

        if not questionnaire:
            print(f"[ERROR] Questionnaire not found: {questionnaire_id}")
            return jsonify({'error': 'Questionnaire not found'}), 404

        print(f"[DEBUG] Generating profile for podcast: {questionnaire.get('podcastName')}")

        profile_text = generate_profile_with_gemini(
            podcast_name=questionnaire['podcastName'],
            host_names=questionnaire.get('hostNames', ''),
            answers=questionnaire['answers']
        )

        profile_id = str(uuid.uuid4())
        profile_data = {
            'id': profile_id,
            'questionnaireId': questionnaire_id,
            'podcastName': questionnaire['podcastName'],
            'profile': profile_text,
            'wordCount': len(profile_text.split()),
            'createdAt': datetime.now().isoformat()
        }

        profile_filename = f"profile_{profile_id}.json"
        save_data(profile_filename, profile_data)

        questionnaire['profileId'] = profile_id
        save_data(filename, questionnaire)

        print(f"[DEBUG] Profile generated successfully: {profile_id}")

        return jsonify({
            'id': profile_id,
            'profile': profile_text,
            'wordCount': profile_data['wordCount'],
            'status': 'success'
        }), 200

    except Exception as e:
        error_msg = str(e)
        print(f"[ERROR] Error in generate_profile: {error_msg}")

        # Return user-friendly error messages
        if "Gemini API key" in error_msg:
            return jsonify({'error': 'AI service temporarily unavailable. Please try again in a moment.'}), 503
        elif "quota" in error_msg.lower():
            return jsonify({'error': 'AI quota exceeded. Please try again later.'}), 429
        elif "timeout" in error_msg.lower():
            return jsonify({'error': 'Request timed out. Please try again.'}), 504
        else:
            return jsonify({'error': f'There was an issue generating your profile: {error_msg}'}), 500

@app.route('/api/profile/<profile_id>', methods=['GET', 'OPTIONS'])
def get_profile(profile_id):
    """Get generated profile by ID"""
    if request.method == 'OPTIONS':
        return '', 204
    try:
        filename = f"profile_{profile_id}.json"
        data = load_data(filename)

        if not data:
            return jsonify({'error': 'Profile not found'}), 404

        return jsonify(data), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/user/<user_id>/profiles', methods=['GET', 'OPTIONS'])
def get_user_profiles(user_id):
    """Get all profiles for a user"""
    if request.method == 'OPTIONS':
        return '', 204
    try:
        profiles = []
        for filename in os.listdir(DATA_DIR):
            if filename.startswith('profile_') and filename.endswith('.json'):
                data = load_data(filename)
                if data:
                    profiles.append({
                        'id': data['id'],
                        'podcastName': data['podcastName'],
                        'createdAt': data['createdAt'],
                        'wordCount': data.get('wordCount', 0)
                    })

        profiles.sort(key=lambda x: x['createdAt'], reverse=True)

        return jsonify({
            'profiles': profiles,
            'count': len(profiles)
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ============================================================================
# API ROUTES - YOUTUBE PROCESSING (NEW)
# ============================================================================

@app.route('/api/process-episode', methods=['POST', 'OPTIONS'])
def process_episode():
    """Start processing a YouTube episode, uploaded file, or server-side file path"""
    if request.method == 'OPTIONS':
        return '', 204
    try:
        # Check if this is a file upload
        if request.files and 'video' in request.files:
            return process_file_upload()

        # Otherwise, process as JSON request
        data = request.json or {}
        print(f"[DEBUG] /api/process-episode called with data: {data}")

        # Check if it's a server-side file path (from chunked upload)
        file_path = data.get('filePath')
        if file_path and os.path.exists(file_path):
            return process_server_file(file_path, data)

        # Otherwise, process as YouTube URL
        youtube_url = data.get('youtubeUrl')
        podcast_name = data.get('podcastName')
        profile_id = data.get('profileId')
        user_id = data.get('userId')
        print(f"[DEBUG] youtube_url: {youtube_url}, podcast_name: {podcast_name}, profile_id: {profile_id}")

        if not youtube_url:
            return jsonify({'error': 'YouTube URL is required'}), 400

        if not podcast_name:
            return jsonify({'error': 'Podcast name is required'}), 400

        # Extract YouTube video ID
        video_id = extract_youtube_id(youtube_url)
        if not video_id:
            return jsonify({'error': 'Invalid YouTube URL. Please provide a valid YouTube video URL.'}), 400

        # Generate job ID
        job_id = str(uuid.uuid4())

        # Create job record
        job_data = {
            'id': job_id,
            'youtubeUrl': youtube_url,
            'videoId': video_id,
            'podcastName': podcast_name,
            'profileId': profile_id,
            'filePath': file_path,
            'userId': user_id,
            'status': 'queued',
            'progressMessage': 'Queued for processing...',
            'createdAt': datetime.now().isoformat(),
            'updatedAt': datetime.now().isoformat()
        }

        save_data(f"job_{job_id}.json", job_data, JOBS_DIR)

        # Start async processing
        thread = threading.Thread(
            target=process_episode_async,
            args=(job_id, youtube_url, video_id, podcast_name, profile_id)
        )
        thread.daemon = True
        thread.start()

        return jsonify({
            'jobId': job_id,
            'status': 'queued',
            'message': 'Episode processing started'
        }), 202

    except Exception as e:
        return jsonify({'error': str(e)}), 500

def process_file_upload():
    """Handle file upload processing"""
    try:
        video_file = request.files['video']
        podcast_name = request.form.get('podcastName', 'My Podcast')
        profile_id = request.form.get('profileId')

        if not video_file:
            return jsonify({'error': 'Video file is required'}), 400

        # Validate file type
        allowed_extensions = {'.mp4', '.mov', '.avi', '.mkv', '.webm'}
        file_ext = os.path.splitext(video_file.filename)[1].lower()
        if file_ext not in allowed_extensions:
            return jsonify({'error': f'Invalid file type. Allowed: {", ".join(allowed_extensions)}'}), 400

        # Generate job ID and video ID
        job_id = str(uuid.uuid4())
        video_id = f"upload_{job_id[:8]}"

        # Save uploaded file
        upload_dir = os.path.join(DATA_DIR, 'uploads')
        os.makedirs(upload_dir, exist_ok=True)
        file_path = os.path.join(upload_dir, f"{video_id}{file_ext}")
        video_file.save(file_path)

        # Create job record
        job_data = {
            'id': job_id,
            'videoId': video_id,
            'podcastName': podcast_name,
            'profileId': profile_id,
            'filePath': file_path,
            'status': 'queued',
            'progressMessage': 'Queued for processing...',
            'createdAt': datetime.now().isoformat(),
            'updatedAt': datetime.now().isoformat()
        }

        save_data(f"job_{job_id}.json", job_data, JOBS_DIR)

        # Start async processing
        thread = threading.Thread(
            target=process_file_async,
            args=(job_id, file_path, video_id, podcast_name, profile_id)
        )
        thread.daemon = True
        thread.start()

        return jsonify({
            'jobId': job_id,
            'status': 'queued',
            'message': 'Episode processing started'
        }), 202

    except Exception as e:
        return jsonify({'error': str(e)}), 500

def process_server_file(file_path, data):
    """Handle processing of a server-side file (from chunked upload)"""
    try:
        podcast_name = data.get('podcastName', 'My Podcast')
        profile_id = data.get('profileId')
        
        if not os.path.exists(file_path):
            return jsonify({'error': 'File not found on server'}), 404
        
        # Generate job ID and video ID
        job_id = str(uuid.uuid4())
        video_id = f"chunked_{job_id[:8]}"
        
        # Create job record with file path for later clip extraction
        job_data = {
            'id': job_id,
            'videoId': video_id,
            'podcastName': podcast_name,
            'profileId': profile_id,
            'filePath': file_path,
            'filePath': file_path,
            'status': 'queued',
            'progressMessage': 'Queued for processing...',
            'createdAt': datetime.now().isoformat(),
            'updatedAt': datetime.now().isoformat()
        }
        
        save_data(f"job_{job_id}.json", job_data, JOBS_DIR)
        
        # Start async processing
        thread = threading.Thread(
            target=process_file_async,
            args=(job_id, file_path, video_id, podcast_name, profile_id)
        )
        thread.daemon = True
        thread.start()
        
        return jsonify({
            'jobId': job_id,
            'status': 'queued',
            'message': 'Episode processing started'
        }), 202

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/job/<job_id>', methods=['GET', 'OPTIONS'])
def get_job_status(job_id):
    """Get job status and results"""
    if request.method == 'OPTIONS':
        return '', 204
    try:
        job_data = load_data(f"job_{job_id}.json", JOBS_DIR)

        if not job_data:
            return jsonify({'error': 'Job not found'}), 404

        # Build response based on status
        response = {
            'jobId': job_data['id'],
            'status': job_data['status'],
            'progressMessage': job_data.get('progressMessage', ''),
            'podcastName': job_data.get('podcastName'),
            'createdAt': job_data.get('createdAt'),
            'updatedAt': job_data.get('updatedAt')
        }

        # Include transcript if available
        if 'transcript' in job_data:
            response['transcript'] = job_data['transcript']

        # Include clips if available
        if 'clips' in job_data:
            response['clips'] = job_data['clips']
            response['clipCount'] = job_data.get('clipCount', 0)

        # Include error if failed
        if 'error' in job_data:
            response['error'] = job_data['error']

        return jsonify(response), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/analyze-clips', methods=['POST', 'OPTIONS'])
def analyze_clips():
    """Analyze clips from a transcript"""
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data = request.json
        job_id = data.get('jobId')
        target_audience_profile = data.get('targetAudienceProfile')

        if not job_id:
            return jsonify({'error': 'Job ID is required'}), 400

        # Load job data
        job_data = load_data(f"job_{job_id}.json", JOBS_DIR)
        if not job_data:
            return jsonify({'error': 'Job not found'}), 404

        # Check if transcript exists
        if 'transcript' not in job_data:
            return jsonify({'error': 'Transcript not yet available. Please wait for transcription to complete.'}), 400

        # Get target audience profile
        if not target_audience_profile:
            # Try to load from profile_id
            profile_id = job_data.get('profileId')
            if profile_id:
                profile_data = load_data(f"profile_{profile_id}.json", DATA_DIR)
                if profile_data:
                    target_audience_profile = profile_data.get('profile', '')

        if not target_audience_profile:
            target_audience_profile = f"Target audience for {job_data.get('podcastName', 'podcast')}"

        # Analyze clips
        transcript_text = job_data['transcript']['fullText']
        clips = analyze_clips_with_gemini(transcript_text, target_audience_profile)

        # Update job with clips
        job_data['clips'] = clips
        job_data['clipCount'] = len(clips)
        job_data['updatedAt'] = datetime.now().isoformat()
        save_data(f"job_{job_id}.json", job_data, JOBS_DIR)

        return jsonify({
            'clips': clips,
            'clipCount': len(clips),
            'status': 'success'
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/transcript/<video_id>', methods=['GET', 'OPTIONS'])
def get_transcript(video_id):
    """Get cached transcript for a video"""
    if request.method == 'OPTIONS':
        return '', 204
    try:
        transcript_data = load_data(f"transcript_{video_id}.json", TRANSCRIPTS_DIR)

        if not transcript_data:
            return jsonify({'error': 'Transcript not found'}), 404

        return jsonify(transcript_data), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ============================================================================
# API ROUTES - TRANSCRIPT EDITOR (NEW)
# ============================================================================

@app.route('/api/job/<job_id>/full-transcript', methods=['GET', 'OPTIONS'])
def get_full_transcript(job_id):
    """Get full transcript with timestamps for the transcript editor"""
    if request.method == 'OPTIONS':
        return '', 204
    try:
        job_data = load_data(f"job_{job_id}.json", JOBS_DIR)

        if not job_data:
            return jsonify({'error': 'Job not found'}), 404

        # Check if transcript exists
        if 'transcript' not in job_data:
            return jsonify({'error': 'Transcript not yet available'}), 400

        transcript = job_data['transcript']
        segments = transcript.get('segments', [])

        # Build formatted transcript with text including timestamps
        formatted_segments = []
        for seg in segments:
            # Include timestamp in the text for display: [MM:SS] text
            timestamp_text = f"[{seg['start']}] {seg['text']}"
            formatted_segments.append({
                'id': seg.get('start_seconds', 0),
                'start': seg['start'],
                'end': seg['end'],
                'start_seconds': seg.get('start_seconds', 0),
                'end_seconds': seg.get('end_seconds', 0),
                'text': seg['text'],
                'timestamp_text': timestamp_text
            })

        # Get clips if available
        clips = job_data.get('clips', [])

        return jsonify({
            'jobId': job_id,
            'videoId': job_data.get('videoId'),
            'podcastName': job_data.get('podcastName'),
            'duration': transcript.get('duration'),
            'segments': formatted_segments,
            'clips': clips,
            'fullText': transcript.get('fullText', '')
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/job/<job_id>/save-clip', methods=['POST', 'OPTIONS'])
def save_clip(job_id):
    """Save adjusted clip timestamps"""
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data = request.json
        clip_index = data.get('clipIndex')
        start_timestamp = data.get('startTimestamp')
        end_timestamp = data.get('endTimestamp')
        transcript_excerpt = data.get('transcriptExcerpt', '')

        # Validate required fields
        if clip_index is None:
            return jsonify({'error': 'clipIndex is required'}), 400
        if not start_timestamp:
            return jsonify({'error': 'startTimestamp is required'}), 400
        if not end_timestamp:
            return jsonify({'error': 'endTimestamp is required'}), 400

        # Load job data
        job_data = load_data(f"job_{job_id}.json", JOBS_DIR)
        if not job_data:
            return jsonify({'error': 'Job not found'}), 404

        # Check if clips exist
        if 'clips' not in job_data or not job_data['clips']:
            return jsonify({'error': 'No clips found for this job'}), 404

        # Validate clip index
        clips = job_data['clips']
        if clip_index < 0 or clip_index >= len(clips):
            return jsonify({'error': f'Invalid clip index. Must be between 0 and {len(clips)-1}'}), 400

        # Calculate duration in minutes
        start_seconds = parse_timestamp_to_seconds(start_timestamp)
        end_seconds = parse_timestamp_to_seconds(end_timestamp)
        duration_minutes = round((end_seconds - start_seconds) / 60, 1)

        # Update the clip
        clips[clip_index]['start_timestamp'] = start_timestamp
        clips[clip_index]['end_timestamp'] = end_timestamp
        clips[clip_index]['duration_minutes'] = duration_minutes
        if transcript_excerpt:
            clips[clip_index]['transcript_excerpt'] = transcript_excerpt
        clips[clip_index]['updatedAt'] = datetime.now().isoformat()

        # Save updated job
        job_data['clips'] = clips
        job_data['updatedAt'] = datetime.now().isoformat()
        save_data(f"job_{job_id}.json", job_data, JOBS_DIR)

        return jsonify({
            'success': True,
            'clipIndex': clip_index,
            'startTimestamp': start_timestamp,
            'endTimestamp': end_timestamp,
            'durationMinutes': duration_minutes,
            'message': 'Clip saved successfully'
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/job/<job_id>/export-clips', methods=['GET', 'OPTIONS'])
def export_clips(job_id):
    """Export clip data for download"""
    if request.method == 'OPTIONS':
        return '', 204
    try:
        job_data = load_data(f"job_{job_id}.json", JOBS_DIR)

        if not job_data:
            return jsonify({'error': 'Job not found'}), 404

        if 'clips' not in job_data or not job_data['clips']:
            return jsonify({'error': 'No clips found for this job'}), 404

        clips = job_data['clips']

        # Build export data
        export_data = {
            'jobId': job_id,
            'videoId': job_data.get('videoId'),
            'podcastName': job_data.get('podcastName'),
            'exportedAt': datetime.now().isoformat(),
            'clips': []
        }

        for i, clip in enumerate(clips):
            export_clip = {
                'index': i,
                'start_timestamp': clip.get('start_timestamp'),
                'end_timestamp': clip.get('end_timestamp'),
                'duration_minutes': clip.get('duration_minutes'),
                'title_options': clip.get('title_options', {}),
                'engaging_quote': clip.get('engaging_quote'),
                'transcript_excerpt': clip.get('transcript_excerpt'),
                'why_it_works': clip.get('why_it_works')
            }
            export_data['clips'].append(export_clip)

        return jsonify(export_data), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/job/<job_id>/clip/<int:clip_index>/download', methods=['GET', 'OPTIONS'])
def download_clip_video(job_id, clip_index):
    """Extract and download a specific clip as video file.
    
    Uses send_file for memory-efficient streaming instead of Response generator.
    """
    
    if request.method == 'OPTIONS':
        return '', 204
    try:
        job_data = load_data(f"job_{job_id}.json", JOBS_DIR)
        if not job_data:
            return jsonify({'error': 'Job not found'}), 404

        if 'clips' not in job_data or not job_data['clips']:
            return jsonify({'error': 'No clips found'}), 404

        clips = job_data['clips']
        if clip_index < 0 or clip_index >= len(clips):
            return jsonify({'error': 'Invalid clip index'}), 400

        clip = clips[clip_index]
        start_ts = clip.get('start_timestamp')
        end_ts = clip.get('end_timestamp')

        if not start_ts or not end_ts:
            return jsonify({'error': 'Clip missing timestamps'}), 400

        # Find the original video file
        video_path = job_data.get('filePath')
        video_id = job_data.get('videoId')
        uploads_dir = os.path.join(DATA_DIR, 'uploads')
        
        if not video_path or not os.path.exists(video_path):
            if video_id and os.path.exists(uploads_dir):
                for fname in os.listdir(uploads_dir):
                    if fname.startswith(video_id) or video_id in fname:
                        video_path = os.path.join(uploads_dir, fname)
                        break
        
        if not video_path or not os.path.exists(video_path):
            if os.path.exists(uploads_dir):
                for fname in os.listdir(uploads_dir):
                    if job_id in fname:
                        video_path = os.path.join(uploads_dir, fname)
                        break

        if not video_path or not os.path.exists(video_path):
            return jsonify({'error': 'Original video file not found. Files are cleared between deploys on Render. Please re-upload the video.'}), 404

        # Create clips directory
        clips_dir = os.path.join(DATA_DIR, 'clips')
        os.makedirs(clips_dir, exist_ok=True)

        # Generate output filename - INCLUDE TIMESTAMPS so edits create new files
        safe_title = clip.get('title_options', {}).get('punchy', f'clip_{clip_index}')
        safe_title = "".join(c for c in safe_title if c.isalnum() or c in (' ', '-', '_')).rstrip()
        safe_title = safe_title.replace(' ', '_')[:20]
        # Include timestamps in filename so edited clips are different files
        start_safe = start_ts.replace(':', '')
        end_safe = end_ts.replace(':', '')
        output_filename = f"{job_id}_{clip_index}_{start_safe}_{end_safe}_{safe_title}.mp4"
        output_path = os.path.join(clips_dir, output_filename)

        # Check if already extracted and ready (must have content)
        if os.path.exists(output_path) and os.path.getsize(output_path) > 1000:
            print(f"[CLIP] Serving existing clip: {output_path} ({os.path.getsize(output_path)} bytes)")
            # Use send_file - most memory-efficient for file serving
            return send_file(
                output_path,
                mimetype='video/mp4',
                as_attachment=True,
                download_name=output_filename
            )

        # Check if currently processing
        clip_status = job_data.get('clipStatus', {}).get(str(clip_index))
        if clip_status == 'processing':
            return jsonify({'status': 'processing', 'message': 'Clip extraction in progress...'}), 202

        # Check for errors
        if clip_status and clip_status.startswith('error'):
            return jsonify({'error': 'Clip extraction failed', 'details': clip_status}), 500

        # Check if file exists and is valid
        if os.path.exists(output_path):
            file_size = os.path.getsize(output_path)
            if file_size > 10000:
                return send_file(
                    output_path,
                    mimetype='video/mp4',
                    as_attachment=True,
                    download_name=output_filename
                )
            else:
                os.remove(output_path)

        # Extract synchronously (more reliable)
        start_sec = parse_timestamp_to_seconds(start_ts)
        end_sec = parse_timestamp_to_seconds(end_ts)
        duration = end_sec - start_sec
        
        # Ensure minimum duration to avoid empty/corrupt files
        if duration <= 0:
            return jsonify({'error': 'Invalid clip duration', 'details': f'start={start_sec}s, end={end_sec}s'}), 400
        
        print(f"[CLIP] Extracting {start_ts} ({start_sec}s) to {end_ts} ({end_sec}s), duration: {duration}s")

        # FAST extraction using copy codec (no re-encoding)
        # This is 10x faster than re-encoding with libx264
        cmd = [
            'ffmpeg', '-y',
            '-ss', str(start_sec),
            '-i', video_path,
            '-t', str(duration),
            '-c', 'copy',  # Copy codec - no re-encoding, just copy packets
            '-movflags', '+faststart',
            output_path
        ]

        # Use DEVNULL to avoid memory issues - ffmpeg outputs progress to stderr which can be huge
        # CRITICAL FIX: Never use stderr=PIPE - it buffers ALL of ffmpeg's output into memory.
        # ffmpeg outputs massive progress info to stderr which can exceed 400MB on longer videos.
        # This was causing the 512MB OOM crash. Use DEVNULL to discard all output.
        result = subprocess.run(
            cmd,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            timeout=300
        )
        print(f"[CLIP] ffmpeg returncode: {result.returncode}")

        if result.returncode != 0 or not os.path.exists(output_path) or os.path.getsize(output_path) < 1000:
            return jsonify({'error': 'Extraction failed', 'details': 'ffmpeg process failed'}), 500

        # Use send_file - most memory-efficient for file serving
        return send_file(
            output_path,
            mimetype='video/mp4',
            as_attachment=True,
            download_name=output_filename
        )

    except Exception as e:
        print(f"[CLIP] Error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


# ============================================================================
# WORD-LEVEL TRANSCRIPT EDITING API
# ============================================================================

@app.route('/api/job/<job_id>/transcript-words', methods=['GET', 'OPTIONS'])
def get_transcript_words(job_id):
    """Get word-level transcript for a job.
    
    Returns transcript parsed into individual words with timestamps.
    Each word includes: text, start_time, end_time, index
    """
    if request.method == 'OPTIONS':
        return '', 204
    
    try:
        # Load job data
        job_data = load_data(f"job_{job_id}.json", JOBS_DIR)
        if not job_data:
            return jsonify({'error': 'Job not found'}), 404
        
        # Check if transcript exists
        if 'transcript' not in job_data:
            return jsonify({'error': 'Transcript not yet available'}), 400
        
        # Check cache first
        word_transcript = get_cached_word_transcript(job_id)
        
        if not word_transcript:
            # Parse transcript into words
            word_transcript = create_word_transcript_from_job(job_data)
            
            # Cache for future requests
            cache_word_transcript(job_id, word_transcript)
        
        # Return word-level data
        return jsonify({
            'jobId': job_id,
            'words': word_transcript.to_dict()['words'],
            'word_count': len(word_transcript.words),
            'total_duration': word_transcript.total_duration,
            'segments': job_data.get('transcript', {}).get('segments', [])
        }), 200
    
    except Exception as e:
        print(f"[ERROR] get_transcript_words: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/job/<job_id>/clip/<int:clip_index>/words', methods=['GET', 'OPTIONS'])
def get_clip_words(job_id, clip_index):
    """Get word-level transcript for editing a clip.
    
    Returns FULL transcript with segment boundaries marked.
    This allows users to see context before/after the segment.
    Format: [{text: "word", start: 0.0, end: 0.5, index: 0}, ...]
    
    Uses simple estimation (~0.3 seconds per word) from plain text transcript.
    """
    if request.method == 'OPTIONS':
        return '', 204
    
    try:
        # Load job data
        job_data = load_data(f"job_{job_id}.json", JOBS_DIR)
        if not job_data:
            return jsonify({'error': 'Job not found'}), 404
        
        # Check if clips exist
        if 'clips' not in job_data or not job_data['clips']:
            return jsonify({'error': 'No clips found for this job'}), 400
        
        # Validate clip index
        clips = job_data['clips']
        if clip_index < 0 or clip_index >= len(clips):
            return jsonify({'error': 'Invalid clip index'}), 400
        
        clip = clips[clip_index]
        segment_start = parse_timestamp_to_seconds(clip.get('start_timestamp', '00:00'))
        segment_end = parse_timestamp_to_seconds(clip.get('end_timestamp', '00:00'))
        
        # Get FULL transcript text (not just clip portion)
        full_transcript_text = ''
        if 'transcript' in job_data:
            segments = job_data['transcript'].get('segments', [])
            for seg in segments:
                full_transcript_text += seg.get('text', '') + ' '
        
        # Fallback to clip excerpt if no full transcript
        if not full_transcript_text.strip():
            full_transcript_text = clip.get('transcript_excerpt', '')
        
        # Parse FULL transcript into words with estimated timestamps
        # Estimate from 00:00 to end of transcript
        total_duration = job_data.get('duration_seconds', 3600)  # Default 1 hour
        words = parse_transcript_to_words(full_transcript_text, '00:00', 
                                         format_seconds_to_timestamp(total_duration))
        
        # Find segment boundaries in word list
        segment_start_index = 0
        segment_end_index = len(words) - 1
        
        for i, word in enumerate(words):
            if word['start'] <= segment_start + 0.5:
                segment_start_index = i
            if word['end'] <= segment_end:
                segment_end_index = i
        
        return jsonify({
            'jobId': job_id,
            'clipIndex': clip_index,
            'startTimestamp': clip.get('start_timestamp', '00:00'),
            'endTimestamp': clip.get('end_timestamp', '00:00'),
            'words': words,
            'wordCount': len(words),
            'segmentStartIndex': segment_start_index,
            'segmentEndIndex': segment_end_index,
            'isFullTranscript': True
        }), 200
    
    except Exception as e:
        print(f"[ERROR] get_clip_words: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/job/<job_id>/clip/<int:clip_index>/update-words', methods=['POST', 'OPTIONS'])
def update_clip_words(job_id, clip_index):
    """Update clip boundaries based on word indices.
    
    Request body:
    {
        "startWordIndex": 0,    // Starting word index
        "endWordIndex": 10      // Ending word index
    }
    
    Returns updated clip timestamps based on word boundaries.
    Uses simple estimation (~0.3 seconds per word).
    """
    if request.method == 'OPTIONS':
        return '', 204
    
    try:
        data = request.json or {}
        start_word_index = data.get('startWordIndex')
        end_word_index = data.get('endWordIndex')
        
        # Validate required parameters
        if start_word_index is None or end_word_index is None:
            return jsonify({'error': 'startWordIndex and endWordIndex are required'}), 400
        
        if start_word_index < 0 or end_word_index < 0:
            return jsonify({'error': 'Word indices must be non-negative'}), 400
        
        if start_word_index > end_word_index:
            return jsonify({'error': 'startWordIndex must be <= endWordIndex'}), 400
        
        # Load job data
        job_data = load_data(f"job_{job_id}.json", JOBS_DIR)
        if not job_data:
            return jsonify({'error': 'Job not found'}), 404
        
        # Check if clips exist
        if 'clips' not in job_data or not job_data['clips']:
            return jsonify({'error': 'No clips found for this job'}), 404
        
        # Validate clip index
        clips = job_data['clips']
        if clip_index < 0 or clip_index >= len(clips):
            return jsonify({'error': 'Invalid clip index'}), 400
        
        clip = clips[clip_index]
        start_timestamp = clip.get('start_timestamp', '00:00')
        end_timestamp = clip.get('end_timestamp', '00:00')
        
        # Get transcript text for this clip
        transcript_text = ''
        if 'transcript' in job_data:
            segments = job_data['transcript'].get('segments', [])
            start_sec = parse_timestamp_to_seconds(start_timestamp)
            end_sec = parse_timestamp_to_seconds(end_timestamp)
            
            for seg in segments:
                seg_start = seg.get('start_seconds', 0)
                seg_end = seg.get('end_seconds', 0)
                if seg_start < end_sec and seg_end > start_sec:
                    transcript_text += seg.get('text', '') + ' '
        
        if not transcript_text.strip():
            transcript_text = clip.get('transcript_excerpt', '')
        
        # Parse words using simple estimation
        words = parse_transcript_to_words(transcript_text, start_timestamp, end_timestamp)
        
        if not words:
            return jsonify({'error': 'No words found in transcript'}), 400
        
        # Validate indices are within range
        if start_word_index >= len(words):
            return jsonify({'error': f'startWordIndex out of range (max: {len(words)-1})'}), 400
        if end_word_index >= len(words):
            return jsonify({'error': f'endWordIndex out of range (max: {len(words)-1})'}), 400
        
        # Get new timestamps based on word indices
        start_word = words[start_word_index]
        end_word = words[end_word_index]
        
        new_start_timestamp = format_seconds_to_timestamp(start_word['start'])
        new_end_timestamp = format_seconds_to_timestamp(end_word['end'])
        
        # Calculate new duration
        start_sec = parse_timestamp_to_seconds(new_start_timestamp)
        end_sec = parse_timestamp_to_seconds(new_end_timestamp)
        duration_minutes = round((end_sec - start_sec) / 60, 2)
        
        # Enforce 25-minute maximum segment length
        MAX_SEGMENT_MINUTES = 25
        if duration_minutes > MAX_SEGMENT_MINUTES:
            return jsonify({
                'error': f'Segment exceeds maximum length of {MAX_SEGMENT_MINUTES} minutes',
                'requestedDuration': duration_minutes,
                'maxAllowed': MAX_SEGMENT_MINUTES
            }), 400
        
        # Update clip in job data
        clip['start_timestamp'] = new_start_timestamp
        clip['end_timestamp'] = new_end_timestamp
        clip['duration_minutes'] = duration_minutes
        clip['updatedAt'] = datetime.now().isoformat()
        
        # Save updated job
        job_data['clips'] = clips
        job_data['updatedAt'] = datetime.now().isoformat()
        save_data(f"job_{job_id}.json", job_data, JOBS_DIR)
        
        return jsonify({
            'success': True,
            'jobId': job_id,
            'clipIndex': clip_index,
            'startWordIndex': start_word_index,
            'endWordIndex': end_word_index,
            'startTimestamp': new_start_timestamp,
            'endTimestamp': new_end_timestamp,
            'durationMinutes': duration_minutes,
            'startWord': start_word,
            'endWord': end_word,
            'message': 'Clip updated successfully based on word boundaries'
        }), 200
    
    except Exception as e:
        print(f"[ERROR] update_clip_words: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/job/<job_id>/word-search', methods=['GET', 'OPTIONS'])
def search_words_in_transcript(job_id):
    """Search for words in the transcript.
    
    Query params:
    - q: Search query (required)
    - limit: Max results (default: 10)
    
    Returns matching words with their timestamps.
    """
    if request.method == 'OPTIONS':
        return '', 204
    
    try:
        query = request.args.get('q', '').strip()
        if not query:
            return jsonify({'error': 'Search query (q) is required'}), 400
        
        limit = int(request.args.get('limit', 10))
        
        # Load job data
        job_data = load_data(f"job_{job_id}.json", JOBS_DIR)
        if not job_data:
            return jsonify({'error': 'Job not found'}), 404
        
        # Get word transcript
        word_transcript = get_cached_word_transcript(job_id)
        
        if not word_transcript:
            word_transcript = create_word_transcript_from_job(job_data)
            cache_word_transcript(job_id, word_transcript)
        
        # Search for matching words (case-insensitive)
        query_lower = query.lower()
        matches = []
        
        for word in word_transcript.words:
            if query_lower in word.text.lower():
                matches.append({
                    'text': word.text,
                    'start_time': word.start_time,
                    'end_time': word.end_time,
                    'index': word.index,
                    'formatted_time': format_timestamp(word.start_time)
                })
                if len(matches) >= limit:
                    break
        
        return jsonify({
            'jobId': job_id,
            'query': query,
            'matches': matches,
            'match_count': len(matches)
        }), 200
    
    except Exception as e:
        print(f"[ERROR] search_words_in_transcript: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


# ============================================================================
# FRONTEND SERVING (Simple HTML Upload Form)
# ============================================================================

@app.route('/', methods=['GET'])
def serve_frontend():
    """Serve the simple HTML upload form"""
    print(f"[DEBUG] Serving root page, BACKEND_DIR={BACKEND_DIR}")
    try:
        return render_template('index.html')
    except Exception as e:
        print(f"[DEBUG] Template error: {e}")
        # Fallback: serve directly if template not found
        index_path = os.path.join(BACKEND_DIR, 'templates', 'index.html')
        print(f"[DEBUG] Looking for file at: {index_path}")
        if os.path.exists(index_path):
            print("[DEBUG] Found file, serving directly")
            with open(index_path, 'r') as f:
                return f.read()
        return jsonify({'status': 'error', 'message': str(e), 'path': index_path}), 500

@app.route('/static/<path:path>', methods=['GET'])
def serve_static(path):
    """Serve static files (Next.js build output)"""
    return send_from_directory(app.static_folder, path)

@app.route('/_next/<path:path>', methods=['GET'])
def serve_nextjs(path):
    """Serve Next.js build files"""
    if app.static_folder:
        return send_from_directory(app.static_folder, f'_next/{path}')
    return jsonify({'error': 'Static files not available'}), 404

@app.route('/<path:path>', methods=['GET'])
def serve_frontend_routes(path):
    """Catch-all for SPA routes"""
    if path.startswith('api/'):
        return jsonify({'error': 'Not found'}), 404
    return render_template('index.html')

# ============================================================================
# MAIN
# ============================================================================

# Startup logging for Railway debugging
print(f"[STARTUP] Flask app loading...", flush=True)
print(f"[STARTUP] PORT env: {os.getenv('PORT')}", flush=True)
print(f"[STARTUP] FLASK_PORT env: {os.getenv('FLASK_PORT')}", flush=True)
print(f"[STARTUP] DATA_DIR: {DATA_DIR}", flush=True)
print(f"[STARTUP] Gemini available: {GOOGLE_AI_AVAILABLE}", flush=True)
print(f"[STARTUP] OpenAI available: {OPENAI_AVAILABLE}", flush=True)

def create_app():
    """Application factory for gunicorn"""
    print("[STARTUP] create_app() called", flush=True)
    return app

# This is what gunicorn uses
application = create_app()

if __name__ == '__main__':
    # Railway provides PORT env var; fallback to 5001 for local dev
    port = int(os.getenv('PORT') or os.getenv('FLASK_PORT', 5001))
    print(f"[STARTUP] Starting Flask on port {port}", flush=True)
    app.run(host='0.0.0.0', port=port, debug=False)
