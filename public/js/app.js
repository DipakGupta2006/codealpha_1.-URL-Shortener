/**
 * NanoLink Client-side Application Script
 * Provides smooth interactions, copy-to-clipboard, search filtering, and toasts
 */

document.addEventListener('DOMContentLoaded', () => {
  initCopyButtons();
  initAdvancedToggle();
  initSearchFilter();
  initFormValidation();
});

/**
 * Toast Notification Helper
 */
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  if (!toast) return;

  const icon = type === 'success' 
    ? '<i class="fa-solid fa-circle-check" style="color:#34d399;"></i>' 
    : '<i class="fa-solid fa-circle-exclamation" style="color:#f87171;"></i>';

  toast.innerHTML = `${icon} <span>${message}</span>`;
  toast.className = `toast show toast-${type}`;

  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => {
    toast.className = 'toast';
  }, 3000);
}

/**
 * Copy to Clipboard Handlers
 */
function initCopyButtons() {
  document.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      const textToCopy = btn.getAttribute('data-copy');
      
      if (!textToCopy) return;

      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(textToCopy);
        } else {
          // Fallback for non-HTTPS / local environments
          const textArea = document.createElement('textarea');
          textArea.value = textToCopy;
          textArea.style.position = 'fixed';
          textArea.style.left = '-999999px';
          textArea.style.top = '-999999px';
          document.body.appendChild(textArea);
          textArea.focus();
          textArea.select();
          document.execCommand('copy');
          textArea.remove();
        }

        // Visual feedback on the button
        const originalContent = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
        btn.classList.add('copied');
        showToast('Short URL copied to clipboard!', 'success');

        setTimeout(() => {
          btn.innerHTML = originalContent;
          btn.classList.remove('copied');
        }, 2000);

      } catch (err) {
        console.error('Failed to copy text: ', err);
        showToast('Failed to copy. Please copy manually.', 'error');
      }
    });
  });
}

/**
 * Advanced Options Accordion Toggle
 */
function initAdvancedToggle() {
  const toggleBtn = document.getElementById('toggleAdvancedBtn');
  const advancedOptions = document.getElementById('advancedOptions');

  if (!toggleBtn || !advancedOptions) return;

  toggleBtn.addEventListener('click', () => {
    const isHidden = advancedOptions.style.display === 'none' || advancedOptions.style.display === '';
    advancedOptions.style.display = isHidden ? 'block' : 'none';
    toggleBtn.classList.toggle('active', isHidden);
  });
}

/**
 * Live Client-side Search / Filtering in Recent Links Table
 */
function initSearchFilter() {
  const searchInput = document.getElementById('linkSearchInput');
  const table = document.getElementById('linksTable');

  if (!searchInput || !table) return;

  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();
    const rows = table.querySelectorAll('tbody tr.link-row');

    rows.forEach(row => {
      const code = row.getAttribute('data-code') || '';
      const url = row.getAttribute('data-url') || '';

      if (code.toLowerCase().includes(query) || url.includes(query)) {
        row.style.display = '';
      } else {
        row.style.display = 'none';
      }
    });
  });
}

/**
 * Shorten Form Validation & Loading State
 */
function initFormValidation() {
  const form = document.getElementById('shortenForm');
  const submitBtn = document.getElementById('submitBtn');
  const urlInput = document.getElementById('urlInput');

  if (!form || !submitBtn || !urlInput) return;

  form.addEventListener('submit', (e) => {
    const url = urlInput.value.trim();

    // Check if protocol is present
    if (!/^https?:\/\//i.test(url)) {
      e.preventDefault();
      showToast('Please include http:// or https:// in your URL', 'error');
      urlInput.focus();
      return;
    }

    // Toggle button loading state
    const btnText = submitBtn.querySelector('.btn-text');
    const btnSpinner = submitBtn.querySelector('.btn-spinner');

    if (btnText && btnSpinner) {
      btnText.style.display = 'none';
      btnSpinner.style.display = 'inline-flex';
      submitBtn.disabled = true;
    }
  });
}
