# Pursue Segments - Backend API
# Flask API with Gemini 2.0 Flash integration for target audience generation

from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import json
import uuid
from datetime import datetime
from dotenv import load_dotenv
import google.generativeai as genai

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app, origins=os.getenv('CORS_ORIGINS', 'http://localhost:3000').split(','))

# Configure Gemini API
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

# Data storage directory
DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')
os.makedirs(DATA_DIR, exist_ok=True)

def save_data(filename, data):
    """Save data to JSON file"""
    filepath = os.path.join(DATA_DIR, filename)
    with open(filepath, 'w') as f:
        json.dump(data, f, indent=2)
    return filepath

def load_data(filename):
    """Load data from JSON file"""
    filepath = os.path.join(DATA_DIR, filename)
    if os.path.exists(filepath):
        with open(filepath, 'r') as f:
            return json.load(f)
    return None

# ============================================================================
# PROMPT TEMPLATE - Exactly as specified in requirements
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
    
    if not GEMINI_API_KEY:
        raise Exception("Gemini API key not configured")
    
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
            # Extract question number
            q_num = q_key.replace(section_prefix, '').strip('_')
            formatted_lines.append(f"{q_num}. {value}")
        formatted_sections[section_key] = '\n'.join(formatted_lines) if formatted_lines else "No answers provided."
    
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
    
    # Call Gemini API
    model = genai.GenerativeModel('gemini-2.0-flash')
    response = model.generate_content(
        prompt,
        generation_config=genai.types.GenerationConfig(
            temperature=0.7,
            max_output_tokens=800,
        )
    )
    
    return response.text

# ============================================================================
# API ROUTES
# ============================================================================

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'gemini_configured': bool(GEMINI_API_KEY)
    })

@app.route('/api/questionnaire', methods=['POST'])
def save_questionnaire():
    """Save questionnaire answers"""
    try:
        data = request.json
        
        # Validate required fields
        if not data.get('podcastName'):
            return jsonify({'error': 'Podcast name is required'}), 400
        
        if not data.get('answers'):
            return jsonify({'error': 'Answers are required'}), 400
        
        # Generate unique ID
        questionnaire_id = str(uuid.uuid4())
        
        # Prepare data
        questionnaire_data = {
            'id': questionnaire_id,
            'podcastName': data['podcastName'],
            'hostNames': data.get('hostNames', ''),
            'answers': data['answers'],
            'createdAt': datetime.now().isoformat(),
            'status': 'completed'
        }
        
        # Save to file
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
    try:
        data = request.json
        questionnaire_id = data.get('questionnaireId')
        
        if not questionnaire_id:
            return jsonify({'error': 'Questionnaire ID is required'}), 400
        
        # Load questionnaire
        filename = f"questionnaire_{questionnaire_id}.json"
        questionnaire = load_data(filename)
        
        if not questionnaire:
            return jsonify({'error': 'Questionnaire not found'}), 404
        
        # Generate profile using Gemini
        profile_text = generate_profile_with_gemini(
            podcast_name=questionnaire['podcastName'],
            host_names=questionnaire.get('hostNames', ''),
            answers=questionnaire['answers']
        )
        
        # Save profile
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
        
        # Update questionnaire with profile reference
        questionnaire['profileId'] = profile_id
        save_data(filename, questionnaire)
        
        return jsonify({
            'id': profile_id,
            'profile': profile_text,
            'wordCount': profile_data['wordCount'],
            'status': 'success'
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

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
        
        # Sort by creation date (newest first)
        profiles.sort(key=lambda x: x['createdAt'], reverse=True)
        
        return jsonify({
            'profiles': profiles,
            'count': len(profiles)
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ============================================================================
# MAIN
# ============================================================================

if __name__ == '__main__':
    port = int(os.getenv('FLASK_PORT', 5001))
    app.run(host='0.0.0.0', port=port, debug=True)
