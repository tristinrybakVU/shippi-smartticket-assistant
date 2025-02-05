// Utility function for logging with timestamps
console.log = console.log.bind(console);
const originalLog = console.log;
console.log = (...args) => {
  if (typeof args[0] === 'string' && args[0].includes('Aria-label')) {
    originalLog(...args);
  }
};

// Utility function to sanitize input
function sanitizeInput(input) {
  if (!input) return '';
  return input.replace(/[<>]/g, '').trim();
}

// Initialize extension

// Function to get ticket details from the current page
function getTicketDetails() {
  const ticketKey = sanitizeInput(document.querySelector('meta[name="ajs-issue-key"]')?.content);
  const title = sanitizeInput(document.querySelector('h1[data-test-id="issue.views.issue-base.foundation.summary.heading"]')?.textContent);
  const description = sanitizeInput(document.querySelector('[data-test-id="issue.views.field.rich-text.description"]')?.textContent);
  const status = sanitizeInput(document.querySelector('[data-test-id="issue.views.issue-base.foundation.status.status-field-wrapper"]')?.textContent);
  const priority = sanitizeInput(document.querySelector('[data-test-id="issue.views.issue-base.foundation.priority.priority-field"]')?.textContent);

  const details = {
    ticketKey,
    title,
    description,
    status,
    priority
  };

  return details;
}

// Rate limiting utility
const rateLimiter = {
  lastCallTime: 0,
  minInterval: 1000, // Minimum time between API calls in milliseconds
  isRateLimited() {
    const now = Date.now();
    if (now - this.lastCallTime < this.minInterval) {
      return true;
    }
    this.lastCallTime = now;
    return false;
  }
};

// Function to enhance comment using OpenAI
async function enhanceComment(text, editor) {
  if (rateLimiter.isRateLimited()) {
    throw new Error('Please wait a moment before making another request.');
  }

  // Get settings from storage
  const settings = await new Promise((resolve, reject) => {
    chrome.storage.sync.get([
      'apiKey',
      'intensity',
      'style',
      'autoFormat',
      'addLinks',
      'autoSave'
    ], (result) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(result);
      }
    });
  });

  if (!settings.apiKey) {
    throw new Error('OpenAI API key not found. Please set it in the extension settings.');
  }

  // Check cache first
  const cacheKey = `enhance_${sanitizeInput(text)}_${settings.intensity}_${settings.style}`;
  const cached = await chrome.storage.local.get([cacheKey]);
  if (cached[cacheKey]) {
    return cached[cacheKey];
  }

  const ariaLabel = editor.getAttribute('aria-label') || '';
  console.log('Aria-label:', ariaLabel);
  const isDescription = ariaLabel.startsWith('Description area');
  
  // Build system message based on settings
  let systemInstructions = [];
  
  // Base role
  systemInstructions.push(isDescription ? 
    'You are an expert at writing Jira tickets. You will format content into clear, structured sections.' :
    'You are an expert at writing Jira comments. Enhance comments while maintaining their core meaning. Return ONLY the enhanced text without any prefixes or labels.');
  
  // Intensity instructions
  switch (settings.intensity) {
    case 'minimal':
      systemInstructions.push(
        'Keep responses extremely concise and to the point.',
        'Remove any unnecessary details or explanations.',
        'Use short, direct sentences.'
      );
      break;
    case 'moderate':
      systemInstructions.push(
        'Balance detail with brevity.',
        'Include important context while staying focused.'
      );
      break;
    case 'detailed':
      systemInstructions.push(
        'Provide comprehensive explanations.',
        'Include relevant context and background.',
        'Elaborate on technical details when appropriate.'
      );
      break;
  }
  
  // Style instructions
  switch (settings.style) {
    case 'technical':
      systemInstructions.push(
        'Use precise technical terminology.',
        'Include specific technical details.',
        'Write for an engineering audience.'
      );
      break;
    case 'balanced':
      systemInstructions.push(
        'Balance technical accuracy with accessibility.',
        'Explain technical concepts clearly.',
        'Write for a mixed technical/non-technical audience.'
      );
      break;
    case 'simple':
      systemInstructions.push(
        'Use clear, simple language.',
        'Avoid technical jargon.',
        'Write for a general audience.'
      );
      break;
  }
  
  // Format preferences
  if (settings.autoFormat) {
    systemInstructions.push(
      'Format code blocks using triple backticks with language specification.',
      'Ensure proper indentation in code blocks.',
      'Use markdown formatting for emphasis and lists.'
    );
  }
  
  if (settings.addLinks) {
    systemInstructions.push(
      'Convert ticket references (e.g., PROJ-123) to Jira links.',
      'Include links to relevant documentation when mentioned.',
      'Use proper Jira link syntax: [PROJ-123]'
    );
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",  // Faster than GPT-4
        messages: [
          {
            role: "system",
            content: systemInstructions.join(' ')
          },
          {
            role: "user",
            content: `Please enhance this ${isDescription ? 'ticket description' : 'comment'}:\n\n${sanitizeInput(text)}`
          }
        ],
        temperature: 0.7,
        max_tokens: 1000,
        presence_penalty: 0.6
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to enhance text');
    }

    const data = await response.json();
    const enhancedText = data.choices[0].message.content.trim();

    // Cache the result
    await chrome.storage.local.set({ [cacheKey]: enhancedText });

    return enhancedText;
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

// Function to insert enhanced text into Jira
function insertEnhancedText(enhancedText, editor) {
  // Convert line breaks to Jira's line break format
  const jiraFormattedText = enhancedText
    .split('\n')
    .map(line => line.trim())
    .join('\n');

  // If it's a rich text editor (CKEditor)
  if (editor.classList.contains('ak-editor-content-area')) {
    // Insert as HTML with proper line breaks
    const formattedHtml = jiraFormattedText
      .replace(/\n/g, '<br>')
      .replace(/\[\[/g, '[')
      .replace(/\]\]/g, ']');
    
    editor.innerHTML = formattedHtml;
    // Trigger input event to ensure Jira recognizes the change
    editor.dispatchEvent(new Event('input', { bubbles: true }));
  } 
  // If it's a plain text editor
  else {
    editor.value = jiraFormattedText;
    // Trigger input event to ensure Jira recognizes the change
    editor.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

// Function to show preview modal
function showPreviewModal(enhancedText, editor) {
  const modal = document.createElement('div');
  modal.className = 'ai-preview-modal';
  
  const modalContent = document.createElement('div');
  const isDescription = editor.getAttribute('aria-label')?.startsWith('Description area');
  const title = isDescription ? 'Enhanced Ticket' : 'Enhanced Comment';
  
  modalContent.innerHTML = `
    <h3>${title}</h3>
    <textarea spellcheck="false">${enhancedText}</textarea>
    <div class="buttons">
      <button class="cancel">Cancel</button>
      <button class="apply"><span class="sparkle">✨</span>Enhance</button>
    </div>
  `;
  
  modal.appendChild(modalContent);
  
  const overlay = document.createElement('div');
  overlay.className = 'ai-modal-overlay';
  
  document.body.appendChild(overlay);
  document.body.appendChild(modal);
  
  // Get textarea reference
  const textarea = modal.querySelector('textarea');
  
  // Handle apply button
  const applyButton = modal.querySelector('.apply');
  const cancelButton = modal.querySelector('.cancel');
  
  applyButton.addEventListener('click', () => {
    const finalText = textarea.value; // Get the possibly edited text
    
    // For ProseMirror editor
    if (editor.classList.contains('ProseMirror')) {
      editor.innerHTML = finalText.replace(/\n/g, '<br>');
      const event = new Event('input', { bubbles: true });
      editor.dispatchEvent(event);
    } else {
      editor.value = finalText;
      editor.dispatchEvent(new Event('input', { bubbles: true }));
    }

    // Find and click the submit/save button
    const submitButton = document.querySelector('[type="submit"], .submit, [data-testid="comment-save-button"]');
    if (submitButton) {
      submitButton.click();
    }

    overlay.remove();
    modal.remove();
  });
  
  // Handle cancel button
  cancelButton.addEventListener('click', () => {
    overlay.remove();
    modal.remove();
  });
  
  // Handle click outside modal to close
  overlay.addEventListener('click', () => {
    overlay.remove();
    modal.remove();
  });

  // Handle escape key
  document.addEventListener('keydown', function escapeHandler(e) {
    if (e.key === 'Escape') {
      overlay.remove();
      modal.remove();
      document.removeEventListener('keydown', escapeHandler);
    }
  });
}

// Function to add enhance button to comment fields
function addEnhanceButton(editor) {
  // Check if button already exists
  if (editor.parentElement.querySelector('.ai-enhance-button')) {
    return;
  }

  const buttonContainer = document.createElement('div');
  buttonContainer.className = 'ai-enhance-button-container';

  const button = document.createElement('button');
  button.className = 'ai-enhance-button';
  
  // Set button text based on editor type
  const ariaLabel = editor.getAttribute('aria-label') || '';
  console.log('Aria-label:', ariaLabel);
  const isDescription = ariaLabel.startsWith('Description area');
  const buttonHtml = isDescription ? 
    '<span class="sparkle">✨</span>Enhance Ticket' :
    '<span class="sparkle">✨</span>Enhance Comment';
  button.innerHTML = buttonHtml;

  let originalHtml = buttonHtml;
  let isProcessing = false;

  button.addEventListener('click', async () => {
    if (isProcessing) return;
    
    try {
      isProcessing = true;
      button.disabled = true;
      originalHtml = button.innerHTML;
      button.innerHTML = '<span class="sparkle">⌛</span>Processing...';
      
      const text = editor.value || editor.textContent;
      const enhancedText = await enhanceComment(text, editor);
      showPreviewModal(enhancedText, editor);
    } catch (error) {
      alert(error.message);
    } finally {
      isProcessing = false;
      button.disabled = false;
      button.innerHTML = originalHtml;
    }
  });

  buttonContainer.appendChild(button);
  
  // Find the Jira buttons container
  const jiraButtonsContainer = editor.closest('.ak-editor-content-area')
    ?.querySelector('.css-1yp4ln')
    ?? editor.closest('.ak-editor-content-area')
    ?.querySelector('.css-1svm4p1');

  if (jiraButtonsContainer) {
    // Insert before the first button in Jira's container
    const firstButton = jiraButtonsContainer.querySelector('button');
    if (firstButton) {
      jiraButtonsContainer.insertBefore(buttonContainer, firstButton);
    } else {
      jiraButtonsContainer.appendChild(buttonContainer);
    }
  } else {
    // Fallback: append to editor's parent
    editor.parentElement.appendChild(buttonContainer);
  }
}

// Function to scan for comment fields
function scanForCommentFields() {
  // Find all potential editor areas
  const editors = document.querySelectorAll('.ProseMirror[role="textbox"]');
  editors.forEach(editor => {
    const ariaLabel = editor.getAttribute('aria-label');
    console.log('Aria-label found:', ariaLabel);
    if (ariaLabel) {
      addEnhanceButton(editor);
    }
  });
}

// Start observing DOM changes
const observer = new MutationObserver(() => {
  scanForCommentFields();
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});

// Initial scan
scanForCommentFields();
