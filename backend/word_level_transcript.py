"""
Word-Level Transcript Editor Module

Provides word-level precision for transcript editing, enabling precise
clip boundary adjustments based on individual word timestamps.

Supports:
- Parsing transcript segments into individual words with timestamps
- Handling partial words (mid-word cuts)
- Updating clip boundaries based on word indices
- Backward compatibility with existing timestamp-based API
"""

import re
import logging
from typing import List, Dict, Optional, Tuple, Any
from dataclasses import dataclass, field
from datetime import datetime

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@dataclass
class Word:
    """Represents a single word with timestamp information."""
    text: str
    start_time: float  # Start time in seconds
    end_time: float   # End time in seconds
    index: int        # Word index in the full transcript
    
    @property
    def duration(self) -> float:
        """Calculate duration of the word."""
        return self.end_time - self.start_time
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            'text': self.text,
            'start_time': self.start_time,
            'end_time': self.end_time,
            'index': self.index
        }


@dataclass
class WordTranscript:
    """Container for word-level transcript data."""
    words: List[Word] = field(default_factory=list)
    original_segments: List[Dict] = field(default_factory=list)
    total_duration: float = 0.0
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            'words': [w.to_dict() for w in self.words],
            'word_count': len(self.words),
            'total_duration': self.total_duration
        }
    
    def get_words_in_range(self, start_time: float, end_time: float) -> List[Word]:
        """Get all words within a time range."""
        return [w for w in self.words if w.end_time >= start_time and w.start_time <= end_time]
    
    def get_word_indices_for_range(self, start_time: float, end_time: float) -> Tuple[int, int]:
        """Get start and end word indices for a time range."""
        words_in_range = self.get_words_in_range(start_time, end_time)
        if not words_in_range:
            return (0, 0)
        return (words_in_range[0].index, words_in_range[-1].index)
    
    def get_time_range_for_indices(self, start_index: int, end_index: int) -> Tuple[float, float]:
        """Get start and end times for a range of word indices."""
        if start_index < 0:
            start_index = 0
        if end_index >= len(self.words):
            end_index = len(self.words) - 1
        
        if start_index > end_index or not self.words:
            return (0.0, 0.0)
        
        return (self.words[start_index].start_time, self.words[end_index].end_time)


class WordLevelTranscriptParser:
    """
    Parser for converting transcript segments into word-level data.
    
    Handles various transcript formats and supports mid-word precision
    through interpolation and word-level analysis.
    """
    
    # Common word duration average (can be refined based on speaking rate)
    DEFAULT_AVG_WORD_DURATION = 0.3  # seconds per word
    
    def __init__(self, avg_word_duration: float = DEFAULT_AVG_WORD_DURATION):
        """
        Initialize the parser.
        
        Args:
            avg_word_duration: Average duration per word in seconds.
                             Used for interpolation when word-level data isn't available.
        """
        self.avg_word_duration = avg_word_duration
    
    def parse_transcript(self, segments: List[Dict]) -> WordTranscript:
        """
        Parse transcript segments into word-level data.
        
        Args:
            segments: List of transcript segments with timing info.
                     Each segment should have: text, start_seconds, end_seconds
        
        Returns:
            WordTranscript object with word-level data
        """
        words = []
        word_index = 0
        
        for segment in segments:
            segment_text = segment.get('text', '')
            start_time = segment.get('start_seconds', 0.0)
            end_time = segment.get('end_seconds', start_time)
            
            if not segment_text:
                continue
            
            # Parse words from segment
            segment_words = self._parse_segment_words(
                segment_text, start_time, end_time, word_index
            )
            
            words.extend(segment_words)
            word_index += len(segment_words)
        
        # Calculate total duration
        total_duration = words[-1].end_time if words else 0.0
        
        return WordTranscript(
            words=words,
            original_segments=segments,
            total_duration=total_duration
        )
    
    def _parse_segment_words(
        self, 
        text: str, 
        start_time: float, 
        end_time: float,
        start_index: int
    ) -> List[Word]:
        """
        Parse words from a single transcript segment.
        
        Uses multiple strategies:
        1. Try to extract word-level timing from formatted text
        2. Fall back to interpolation based on word count
        
        Args:
            text: Segment text content
            start_time: Segment start time in seconds
            end_time: Segment end time in seconds
            start_index: Starting word index
        
        Returns:
            List of Word objects
        """
        words = []
        
        # Clean and split text into words
        cleaned_text = self._clean_text(text)
        word_list = cleaned_text.split()
        
        if not word_list:
            return words
        
        # Calculate duration per word using actual timing
        segment_duration = end_time - start_time
        
        if segment_duration > 0 and len(word_list) > 0:
            # Use actual duration distribution
            # Words typically have varying lengths, so we weight by word length
            total_chars = sum(len(w) for w in word_list)
            
            if total_chars > 0:
                # Distribute time proportional to character count
                current_time = start_time
                for i, word in enumerate(word_list):
                    word_duration = (len(word) / total_chars) * segment_duration
                    # Ensure minimum duration
                    word_duration = max(word_duration, 0.05)
                    
                    word_obj = Word(
                        text=word,
                        start_time=current_time,
                        end_time=current_time + word_duration,
                        index=start_index + i
                    )
                    words.append(word_obj)
                    current_time += word_duration
            else:
                # Fallback: equal distribution
                word_duration = segment_duration / len(word_list)
                current_time = start_time
                for i, word in enumerate(word_list):
                    word_obj = Word(
                        text=word,
                        start_time=current_time,
                        end_time=current_time + word_duration,
                        index=start_index + i
                    )
                    words.append(word_obj)
                    current_time += word_duration
        else:
            # Fallback: use average word duration
            current_time = start_time
            for i, word in enumerate(word_list):
                word_obj = Word(
                    text=word,
                    start_time=current_time,
                    end_time=current_time + self.avg_word_duration,
                    index=start_index + i
                )
                words.append(word_obj)
                current_time += self.avg_word_duration
        
        return words
    
    def _clean_text(self, text: str) -> str:
        """Clean transcript text for word parsing."""
        # Remove speaker labels and timestamps
        cleaned = re.sub(r'\[[^\]]*\]', '', text)  # Remove [timestamp] style
        cleaned = re.sub(r'\d+:\d+\.?\d*', '', cleaned)  # Remove time codes
        cleaned = re.sub(r'[^\w\s\'-]', '', cleaned)  # Keep apostrophes and hyphens
        cleaned = re.sub(r'\s+', ' ', cleaned)  # Normalize whitespace
        return cleaned.strip()
    
    def get_partial_word(
        self, 
        word: Word, 
        start_pct: float = 0.0, 
        end_pct: float = 1.0
    ) -> Tuple[Word, Optional[Word], Optional[Word]]:
        """
        Get a partial word for mid-word cuts.
        
        Args:
            word: The original word
            start_pct: Start percentage (0.0 to 1.0) - for start of clip
            end_pct: End percentage (0.0 to 1.0) - for end of clip
        
        Returns:
            Tuple of (full_word, partial_start, partial_end)
            - full_word: Original word (if clip covers full word)
            - partial_start: Word portion at clip start (if mid-word start)
            - partial_end: Word portion at clip end (if mid-word end)
        """
        if start_pct == 0.0 and end_pct == 1.0:
            # Full word
            return (word, None, None)
        
        word_duration = word.end_time - word.start_time
        
        partial_start = None
        partial_end = None
        
        if start_pct > 0:
            # Cut from middle - create partial word for start
            partial_start = Word(
                text=word.text,
                start_time=word.start_time,
                end_time=word.start_time + (word_duration * start_pct),
                index=word.index
            )
        
        if end_pct < 1.0:
            # Cut at middle - create partial word for end
            partial_end = Word(
                text=word.text,
                start_time=word.start_time + (word_duration * end_pct),
                end_time=word.end_time,
                index=word.index
            )
        
        return (word, partial_start, partial_end)


class ClipWordEditor:
    """
    Handles word-level editing operations for clips.
    
    Provides methods to:
    - Get word boundaries for clips
    - Update clip timestamps based on word selection
    - Handle partial words for precise cutting
    """
    
    def __init__(self, transcript: WordTranscript):
        """
        Initialize the editor.
        
        Args:
            transcript: Word-level transcript data
        """
        self.transcript = transcript
    
    def get_clip_words(
        self, 
        clip_start: float, 
        clip_end: float
    ) -> Dict[str, Any]:
        """
        Get word boundaries for a clip time range.
        
        Args:
            clip_start: Clip start time in seconds
            clip_end: Clip end time in seconds
        
        Returns:
            Dictionary with words, indices, and timing info
        """
        words = self.transcript.get_words_in_range(clip_start, clip_end)
        
        if not words:
            return {
                'words': [],
                'start_index': 0,
                'end_index': 0,
                'start_time': clip_start,
                'end_time': clip_end,
                'word_count': 0
            }
        
        return {
            'words': [w.to_dict() for w in words],
            'start_index': words[0].index,
            'end_index': words[-1].index,
            'start_time': words[0].start_time,
            'end_time': words[-1].end_time,
            'word_count': len(words),
            'text': ' '.join(w.text for w in words)
        }
    
    def update_clip_by_words(
        self,
        clip_index: int,
        start_word_index: int,
        end_word_index: int,
        include_partial_start: bool = False,
        include_partial_end: bool = False
    ) -> Dict[str, Any]:
        """
        Update clip timestamps based on word indices.
        
        Args:
            clip_index: Index of the clip being updated
            start_word_index: Starting word index
            end_word_index: Ending word index
            include_partial_start: Whether to include partial word at start
            include_partial_end: Whether to include partial word at end
        
        Returns:
            Dictionary with updated timing and word info
        """
        # Validate indices
        if start_word_index < 0:
            start_word_index = 0
        if end_word_index >= len(self.transcript.words):
            end_word_index = len(self.transcript.words) - 1
        
        if start_word_index > end_word_index:
            return {
                'error': 'Invalid word range: start_index > end_index',
                'success': False
            }
        
        # Get the words in range
        words = self.transcript.words[start_word_index:end_word_index + 1]
        
        if not words:
            return {
                'error': 'No words found in specified range',
                'success': False
            }
        
        # Calculate new timestamps
        new_start_time = words[0].start_time
        new_end_time = words[-1].end_time
        
        # Handle partial words for precise cutting
        partial_info = {}
        
        if include_partial_start and start_word_index > 0:
            # Could extend back to previous word
            prev_word = self.transcript.words[start_word_index - 1]
            partial_info['can_extend_start'] = True
            partial_info['extend_start_time'] = prev_word.start_time
            partial_info['extend_start_text'] = prev_word.text
        
        if include_partial_end and end_word_index < len(self.transcript.words) - 1:
            # Could extend to next word
            next_word = self.transcript.words[end_word_index + 1]
            partial_info['can_extend_end'] = True
            partial_info['extend_end_time'] = next_word.end_time
            partial_info['extend_end_text'] = next_word.text
        
        return {
            'success': True,
            'clip_index': clip_index,
            'start_word_index': start_word_index,
            'end_word_index': end_word_index,
            'start_time': new_start_time,
            'end_time': new_end_time,
            'duration': new_end_time - new_start_time,
            'word_count': len(words),
            'text': ' '.join(w.text for w in words),
            'words': [w.to_dict() for w in words],
            'partial_options': partial_info,
            'formatted_start': self._format_timestamp(new_start_time),
            'formatted_end': self._format_timestamp(new_end_time)
        }
    
    def _format_timestamp(self, seconds: float) -> str:
        """Format seconds to MM:SS or HH:MM:SS format."""
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        
        if hours > 0:
            return f"{hours:02d}:{minutes:02d}:{secs:02d}"
        return f"{minutes:02d}:{secs:02d}"


# =============================================================================
# UTILITY FUNCTIONS
# =============================================================================

def format_timestamp(seconds: float) -> str:
    """Format seconds to MM:SS or HH:MM:SS format."""
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    
    if hours > 0:
        return f"{hours:02d}:{minutes:02d}:{secs:02d}"
    return f"{minutes:02d}:{secs:02d}"


def parse_timestamp(timestamp_str: str) -> float:
    """Parse timestamp string to seconds."""
    parts = timestamp_str.split(':')
    
    if len(parts) == 3:
        # HH:MM:SS
        return int(parts[0]) * 3600 + int(parts[1]) * 60 + float(parts[2])
    elif len(parts) == 2:
        # MM:SS
        return int(parts[0]) * 60 + float(parts[1])
    else:
        # SS
        return float(timestamp_str)


def create_word_transcript_from_job(job_data: Dict) -> WordTranscript:
    """
    Create WordTranscript from job data.
    
    Args:
        job_data: Job data dictionary containing transcript
    
    Returns:
        WordTranscript object
    """
    if 'transcript' not in job_data or 'segments' not in job_data['transcript']:
        return WordTranscript()
    
    segments = job_data['transcript']['segments']
    parser = WordLevelTranscriptParser()
    return parser.parse_transcript(segments)


# =============================================================================
# CACHING
# =============================================================================

# In-memory cache for word transcripts (job_id -> WordTranscript)
_word_transcript_cache: Dict[str, WordTranscript] = {}


def get_cached_word_transcript(job_id: str) -> Optional[WordTranscript]:
    """Get cached word transcript for a job."""
    return _word_transcript_cache.get(job_id)


def cache_word_transcript(job_id: str, transcript: WordTranscript) -> None:
    """Cache word transcript for a job."""
    _word_transcript_cache[job_id] = transcript


def clear_word_transcript_cache(job_id: str = None) -> None:
    """Clear word transcript cache."""
    global _word_transcript_cache
    if job_id:
        _word_transcript_cache.pop(job_id, None)
    else:
        _word_transcript_cache.clear()
