# Pursue Segments - Backend API
# Flask API with Gemini 2.0 Flash integration for target audience generation
# YouTube processing with yt-dlp, Whisper, and clip analysis

from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import json
import uuid
import re
import threading
import time
from datetime import datetime
from dotenv import load_dotenv
import google.generativeai as genai
from openai import OpenAI

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app, origins=os.getenv('CORS_ORIGINS', 'http://localhost:3000').split(','))

# Configure APIs
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')

if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

openai_client = OpenAI(api_key=OPENAI_API_KEY) if OPENAI_API_KEY else None

# Data storage directories
DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')
JOBS_DIR = os.path.join(DATA_DIR, 'jobs')
TRANSCRIPTS_DIR = os.path.join(DATA_DIR, 'transcripts')

os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(JOBS_DIR, exist_ok=True)
os.makedirs(TRANSCRIPTS_DIR, exist_ok=True)

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
    """Convert timestamp string (HH:MM:SS or MM:SS) to seconds"""
    parts = timestamp_str.strip().split(':')
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
Write a short, punchy Target Audience & Responsibilities Outline for {podcast_name}, based on the questions and answers submitted by the Podcast Host below. The output must be no longer than 400–450 words and must follow the same structure, tone, and paragraph length.

Follow this structure EXACTLY:

1. Start with:
Hello,

2. Next line:
You are now the Head of Podcast Content Strategy for {podcast_name}. Your mission is to ensure every episode we publish—especially on YouTube and podcast platforms—is optimized to attract, engage, and convert our ideal audience.

3. Add a heading line:
Our target audience:

4. Then write 8–10 short paragraphs (1–2 sentences each) that:
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

7. Then write 5–7 bullet points that describe how to create and position content for this audience, including:
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
{target_audience_profile}

TRANSCRIPT (with timestamps):
{transcript}

ANALYSIS CRITERIA:
For each clip, find segments that have:
1. Strong HOOK potential - Look for contrast statements, surprising revelations, or emotional reactions
2. Complete story arc - Beginning, middle, and satisfying conclusion within the segment
3. Specific moments with numbers, results, or concrete examples
4. Natural sentence boundaries (look for transitions like "Now," "So," "Anyways," "Here's the thing")
5. Content that resonates with the target audience's pain points and interests

IMPORTANT TIMING GUIDELINES:
- Find the HOOK 30-60 seconds BEFORE the main valuable content
- Ensure the clip ends at a natural stopping point (completes the thought/story)
- Target 8-20 minutes duration per clip
- Vary the clip lengths for variety (one ~8 min, one ~12 min, one ~15+ min)

For each clip, provide:
1. start_timestamp - When the clip should start (include the hook setup)
2. end_timestamp - When the clip should end (complete thought)
3. duration_minutes - Approximate length
4. title_options - THREE different title options:
   - Option 1: Punchy, attention-grabbing
   - Option 2: Benefit-driven (what they'll learn)
   - Option 3: Curiosity-inducing (makes them need to watch)
5. engaging_quote - The most compelling 1-2 sentence quote from the segment
6. transcript_excerpt - 200-300 words from the key part of the segment
7. why_it_works - 2-3 sentences explaining why this segment resonates with the target audience

Return ONLY a valid JSON array in this exact format:
[
  {
    "start_timestamp": "MM:SS or HH:MM:SS",
    "end_timestamp": "MM:SS or HH:MM:SS", 
    "duration_minutes": 12.5,
    "title_options": {
      "punchy": "Short punchy title",
      "benefit": "What you'll learn title",
      "curiosity": "Makes you curious title"
    },
    "engaging_quote": "The most compelling quote...",
    "transcript_excerpt": "200-300 words...",
    "why_it_works": "Explanation of why this works..."
  }
]

IMPORTANT: 
- Return ONLY the JSON array, no other text
- Ensure timestamps match the format in the transcript
- Make sure each clip is 8-20 minutes long
- The JSON must be valid and parseable"""

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
        model = genai.GenerativeModel('gemini-2.0-flash')
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
        '--no-warnings',
        youtube_url
    ]
    
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

def transcribe_with_whisper(audio_path, video_id):
    """Transcribe audio using OpenAI Whisper API"""
    if not openai_client:
        raise Exception("OpenAI API key not configured")
    
    # Check if transcript already exists (caching)
    transcript_file = os.path.join(TRANSCRIPTS_DIR, f"transcript_{video_id}.json")
    if os.path.exists(transcript_file):
        return load_data(f"transcript_{video_id}.json", TRANSCRIPTS_DIR)
    
    # Transcribe with Whisper
    with open(audio_path, 'rb') as audio_file:
        response = openai_client.audio.transcriptions.create(
            model="whisper-1",
            file=audio_file,
            response_format="verbose_json",
            timestamp_granularities=["segment"]
        )
    
    # Format transcript with timestamps
    segments = []
    full_text = ""
    
    for segment in response.segments:
        start_time = format_seconds_to_timestamp(segment.start)
        end_time = format_seconds_to_timestamp(segment.end)
        text = segment.text.strip()
        
        segments.append({
            'start': start_time,
            'end': end_time,
            'text': text,
            'start_seconds': segment.start,
            'end_seconds': segment.end
        })
        
        full_text += f"[{start_time}] {text}\n"
    
    transcript_data = {
        'videoId': video_id,
        'segments': segments,
        'fullText': full_text,
        'duration': format_seconds_to_timestamp(response.duration),
        'createdAt': datetime.now().isoformat()
    }
    
    # Save transcript for caching
    save_data(f"transcript_{video_id}.json", transcript_data, TRANSCRIPTS_DIR)
    
    return transcript_data

def analyze_clips_with_gemini(transcript_text, target_audience_profile):
    """Analyze transcript and suggest clips using Gemini"""
    if not GEMINI_API_KEY:
        raise Exception("Gemini API key not configured")
    
    # Build the prompt
    prompt = CLIP_ANALYSIS_PROMPT.format(
        target_audience_profile=target_audience_profile,
        transcript=transcript_text[:150000]  # Limit to avoid token limits
    )
    
    # Call Gemini API
    model = genai.GenerativeModel('gemini-2.0-flash')
    response = model.generate_content(
        prompt,
        generation_config=genai.types.GenerationConfig(
            temperature=0.7,
            max_output_tokens=2048,
        )
    )
    
    # Parse JSON response
    try:
        # Clean up the response text to extract JSON
        response_text = response.text.strip()
        
        # Remove markdown code blocks if present
        if response_text.startswith('```json'):
            response_text = response_text[7:]
        if response_text.startswith('```'):
            response_text = response_text[3:]
        if response_text.endswith('```'):
            response_text = response_text[:-3]
        
        response_text = response_text.strip()
        
        clips = json.loads(response_text)
        
        # Validate and clean up clips
        validated_clips = []
        for clip in clips:
            # Ensure all required fields are present
            validated_clip = {
                'start_timestamp': clip.get('start_timestamp', '00:00'),
                'end_timestamp': clip.get('end_timestamp', '00:00'),
                'duration_minutes': clip.get('duration_minutes', 0),
                'title_options': clip.get('title_options', {
                    'punchy': 'Untitled Clip',
                    'benefit': 'Untitled Clip',
                    'curiosity': 'Untitled Clip'
                }),
                'engaging_quote': clip.get('engaging_quote', ''),
                'transcript_excerpt': clip.get('transcript_excerpt', ''),
                'why_it_works': clip.get('why_it_works', '')
            }
            validated_clips.append(validated_clip)
        
        return validated_clips
    except json.JSONDecodeError as e:
        raise Exception(f"Failed to parse Gemini response as JSON: {str(e)}\nResponse: {response.text[:500]}")
    except Exception as e:
        raise Exception(f"Error processing Gemini response: {str(e)}")

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

# ============================================================================
# API ROUTES - PROFILE (EXISTING)
# ============================================================================

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'gemini_configured': bool(GEMINI_API_KEY),
        'openai_configured': bool(OPENAI_API_KEY)
    })

@app.route('/api/questionnaire', methods=['POST'])
def save_questionnaire():
    """Save questionnaire answers"""
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

@app.route('/api/questionnaire/<questionnaire_id>', methods=['GET'])
def get_questionnaire(questionnaire_id):
    """Get questionnaire by ID"""
    try:
        filename = f"questionnaire_{questionnaire_id}.json"
        data = load_data(filename)
        
        if not data:
            return jsonify({'error': 'Questionnaire not found'}), 404
        
        return jsonify(data), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/generate-profile', methods=['POST'])
def generate_profile():
    """Generate target audience profile from questionnaire"""
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

@app.route('/api/profile/<profile_id>', methods=['GET'])
def get_profile(profile_id):
    """Get generated profile by ID"""
    try:
        filename = f"profile_{profile_id}.json"
        data = load_data(filename)
        
        if not data:
            return jsonify({'error': 'Profile not found'}), 404
        
        return jsonify(data), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/user/<user_id>/profiles', methods=['GET'])
def get_user_profiles(user_id):
    """Get all profiles for a user"""
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

@app.route('/api/process-episode', methods=['POST'])
def process_episode():
    """Start processing a YouTube episode"""
    try:
        data = request.json
        
        # Validate required fields
        youtube_url = data.get('youtubeUrl')
        podcast_name = data.get('podcastName')
        profile_id = data.get('profileId')
        user_id = data.get('userId')
        
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

@app.route('/api/job/<job_id>', methods=['GET'])
def get_job_status(job_id):
    """Get job status and results"""
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

@app.route('/api/analyze-clips', methods=['POST'])
def analyze_clips():
    """Analyze clips from a transcript"""
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

@app.route('/api/transcript/<video_id>', methods=['GET'])
def get_transcript(video_id):
    """Get cached transcript for a video"""
    try:
        transcript_data = load_data(f"transcript_{video_id}.json", TRANSCRIPTS_DIR)
        
        if not transcript_data:
            return jsonify({'error': 'Transcript not found'}), 404
        
        return jsonify(transcript_data), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ============================================================================
# MAIN
# ============================================================================

if __name__ == '__main__':
    port = int(os.getenv('FLASK_PORT', 5001))
    app.run(host='0.0.0.0', port=port, debug=True)
