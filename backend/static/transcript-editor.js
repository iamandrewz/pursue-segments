/**
 * TranscriptEditor - Word-level transcript editor component
 * Allows clicking and dragging to select words in a transcript
 */
class TranscriptEditor {
    constructor(options) {
        this.container = options.container;
        this.onSelectionChange = options.onSelectionChange || (() => {});

        this.words = [];
        this.selectionStart = -1;
        this.selectionEnd = -1;
        
        this.isDragging = false;
        this.dragMode = null; // 'select', 'start-handle', 'end-handle'
        this.dragStartIndex = -1;

        this._setupStyles();
        this._bindEvents();
    }

    /**
     * Render the transcript with words and selection
     * @param {Array} wordsArray - Array of {text, start, end, index}
     * @param {number} selectedStartIndex - Start index of selection
     * @param {number} selectedEndIndex - End index of selection
     */
    render(wordsArray, selectedStartIndex, selectedEndIndex) {
        this.words = wordsArray;
        this.selectionStart = selectedStartIndex !== undefined ? selectedStartIndex : -1;
        this.selectionEnd = selectedEndIndex !== undefined ? selectedEndIndex : -1;

        this.container.innerHTML = '';
        this.container.className = 'transcript-editor';

        const editorContent = document.createElement('div');
        editorContent.className = 'transcript-editor-content';

        this.words.forEach((word, index) => {
            const wordSpan = document.createElement('span');
            wordSpan.className = 'transcript-word';
            wordSpan.textContent = word.text;
            wordSpan.dataset.index = index;
            wordSpan.dataset.start = word.start;
            wordSpan.dataset.end = word.end;

            if (index >= this.selectionStart && index <= this.selectionEnd) {
                wordSpan.classList.add('selected');
            }

            editorContent.appendChild(wordSpan);
        });

        this.container.appendChild(editorContent);
        this._updateDragHandles();
    }

    /**
     * Programmatically set selection
     * @param {number} startIndex - Start word index
     * @param {number} endIndex - End word index
     */
    updateSelection(startIndex, endIndex) {
        if (startIndex < 0 || endIndex >= this.words.length || startIndex > endIndex) {
            console.warn('Invalid selection indices');
            return;
        }

        this.selectionStart = startIndex;
        this.selectionEnd = endIndex;

        // Update visual selection
        const wordElements = this.container.querySelectorAll('.transcript-word');
        wordElements.forEach((el, index) => {
            if (index >= startIndex && index <= endIndex) {
                el.classList.add('selected');
            } else {
                el.classList.remove('selected');
            }
        });

        this._updateDragHandles();
        this._notifySelectionChange();
    }

    /**
     * Get current selection info
     * @returns {Object} {startIndex, endIndex, startTime, endTime, text}
     */
    getSelection() {
        if (this.selectionStart < 0 || this.selectionEnd < 0) {
            return null;
        }

        const startWord = this.words[this.selectionStart];
        const endWord = this.words[this.selectionEnd];

        // Collect selected text
        let selectedText = '';
        for (let i = this.selectionStart; i <= this.selectionEnd; i++) {
            selectedText += this.words[i].text + ' ';
        }
        selectedText = selectedText.trim();

        return {
            startIndex: this.selectionStart,
            endIndex: this.selectionEnd,
            startTime: startWord ? startWord.start : 0,
            endTime: endWord ? endWord.end : 0,
            text: selectedText
        };
    }

    /**
     * Scroll container to show selected words
     */
    scrollToSelection() {
        if (this.selectionStart < 0 || this.selectionEnd < 0) {
            return;
        }

        const selectedElements = this.container.querySelectorAll('.transcript-word.selected');
        if (selectedElements.length > 0) {
            const firstSelected = selectedElements[0];
            const lastSelected = selectedElements[selectedElements.length - 1];

            const containerRect = this.container.getBoundingClientRect();
            const firstRect = firstSelected.getBoundingClientRect();
            const lastRect = lastSelected.getBoundingClientRect();

            const scrollTop = this.container.scrollTop;
            const containerHeight = this.container.clientHeight;

            // Calculate scroll position to show all selected words
            const startScroll = firstSelected.offsetTop;
            const endScroll = lastSelected.offsetTop + lastSelected.offsetHeight - containerHeight;

            if (startScroll < scrollTop) {
                this.container.scrollTop = startScroll;
            } else if (endScroll > scrollTop) {
                this.container.scrollTop = Math.max(0, endScroll);
            }
        }
    }

    /**
     * Clear current selection
     */
    clearSelection() {
        this.selectionStart = -1;
        this.selectionEnd = -1;

        const wordElements = this.container.querySelectorAll('.transcript-word');
        wordElements.forEach(el => el.classList.remove('selected'));

        this._updateDragHandles();
        this._notifySelectionChange();
    }

    /**
     * Set up component styles
     * @private
     */
    _setupStyles() {
        if (document.getElementById('transcript-editor-styles')) {
            return;
        }

        const style = document.createElement('style');
        style.id = 'transcript-editor-styles';
        style.textContent = `
            .transcript-editor {
                overflow-y: auto;
                max-height: 400px;
                padding: 10px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                font-size: 16px;
                line-height: 1.6;
                background: #fff;
                border: 1px solid #ddd;
                border-radius: 4px;
                position: relative;
                user-select: none;
            }

            .transcript-editor-content {
                display: flex;
                flex-wrap: wrap;
                gap: 2px;
            }

            .transcript-word {
                display: inline-block;
                padding: 2px 4px;
                cursor: pointer;
                border-radius: 2px;
                transition: background-color 0.1s ease;
            }

            .transcript-word:hover {
                background-color: #f0f0f0;
            }

            .transcript-word.selected {
                background-color: #FFD93D;
                color: #000;
            }

            .drag-handle {
                position: absolute;
                width: 20px;
                height: 20px;
                background-color: #FFD93D;
                border: 2px solid #E5C300;
                cursor: ew-resize;
                z-index: 10;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 10px;
                color: #333;
                border-radius: 3px;
                transition: transform 0.1s ease, box-shadow 0.1s ease;
            }

            .drag-handle:hover {
                transform: scale(1.1);
                box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            }

            .drag-handle::before {
                content: '⋮';
                writing-mode: vertical-rl;
                font-weight: bold;
            }

            .drag-handle.start-handle {
                left: -10px;
            }

            .drag-handle.end-handle {
                right: -10px;
            }

            .transcript-word.dragging {
                cursor: ew-resize;
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Bind event handlers
     * @private
     */
    _bindEvents() {
        // Mouse down on words
        this.container.addEventListener('mousedown', (e) => this._handleMouseDown(e));

        // Mouse move for dragging
        document.addEventListener('mousemove', (e) => this._handleMouseMove(e));

        // Mouse up to end dragging
        document.addEventListener('mouseup', (e) => this._handleMouseUp(e));
    }

    /**
     * Handle mouse down event
     * @private
     */
    _handleMouseDown(e) {
        const handle = e.target.closest('.drag-handle');
        const word = e.target.closest('.transcript-word');

        if (handle) {
            e.preventDefault();
            e.stopPropagation();
            
            if (handle.classList.contains('start-handle')) {
                this.dragMode = 'start-handle';
            } else if (handle.classList.contains('end-handle')) {
                this.dragMode = 'end-handle';
            }
            this.isDragging = true;
            return;
        }

        if (word) {
            e.preventDefault();
            const index = parseInt(word.dataset.index, 10);
            
            this.isDragging = true;
            this.dragMode = 'select';
            this.dragStartIndex = index;
            this.selectionStart = index;
            this.selectionEnd = index;
            
            this._updateVisualSelection();
        }
    }

    /**
     * Handle mouse move event
     * @private
     */
    _handleMouseMove(e) {
        if (!this.isDragging) return;

        const word = e.target.closest('.transcript-word');
        
        if (this.dragMode === 'select' && word) {
            const index = parseInt(word.dataset.index, 10);
            
            if (index >= this.dragStartIndex) {
                this.selectionStart = this.dragStartIndex;
                this.selectionEnd = index;
            } else {
                this.selectionStart = index;
                this.selectionEnd = this.dragStartIndex;
            }
            
            this._updateVisualSelection();
        } else if (this.dragMode === 'start-handle' && word) {
            const index = parseInt(word.dataset.index, 10);
            
            if (index <= this.selectionEnd) {
                this.selectionStart = index;
                this._updateVisualSelection();
            }
        } else if (this.dragMode === 'end-handle' && word) {
            const index = parseInt(word.dataset.index, 10);
            
            if (index >= this.selectionStart) {
                this.selectionEnd = index;
                this._updateVisualSelection();
            }
        }
    }

    /**
     * Handle mouse up event
     * @private
     */
    _handleMouseUp(e) {
        if (this.isDragging) {
            this.isDragging = false;
            this.dragMode = null;
            this.dragStartIndex = -1;
            
            this._updateDragHandles();
            this._notifySelectionChange();
            this.scrollToSelection();
        }
    }

    /**
     * Update visual selection without re-rendering
     * @private
     */
    _updateVisualSelection() {
        const wordElements = this.container.querySelectorAll('.transcript-word');
        
        wordElements.forEach((el, index) => {
            if (index >= this.selectionStart && index <= this.selectionEnd) {
                el.classList.add('selected');
            } else {
                el.classList.remove('selected');
            }
        });

        this._updateDragHandles();
    }

    /**
     * Update drag handle positions
     * @private
     */
    _updateDragHandles() {
        // Remove existing handles
        const existingHandles = this.container.querySelectorAll('.drag-handle');
        existingHandles.forEach(h => h.remove());

        if (this.selectionStart < 0 || this.selectionEnd < 0 || this.selectionStart === this.selectionEnd) {
            return;
        }

        const wordElements = this.container.querySelectorAll('.transcript-word');
        
        // Start handle
        const startWord = wordElements[this.selectionStart];
        if (startWord) {
            const startHandle = document.createElement('div');
            startHandle.className = 'drag-handle start-handle';
            startHandle.style.top = (startWord.offsetTop + startWord.offsetHeight / 2 - 10) + 'px';
            startHandle.style.left = (startWord.offsetLeft - 10) + 'px';
            this.container.appendChild(startHandle);
        }

        // End handle
        const endWord = wordElements[this.selectionEnd];
        if (endWord) {
            const endHandle = document.createElement('div');
            endHandle.className = 'drag-handle end-handle';
            endHandle.style.top = (endWord.offsetTop + endWord.offsetHeight / 2 - 10) + 'px';
            endHandle.style.left = (endWord.offsetLeft + endWord.offsetWidth - 10) + 'px';
            this.container.appendChild(endHandle);
        }
    }

    /**
     * Notify selection change callback
     * @private
     */
    _notifySelectionChange() {
        const selection = this.getSelection();
        this.onSelectionChange(selection);
    }
}

// Export for module usage if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TranscriptEditor;
}
