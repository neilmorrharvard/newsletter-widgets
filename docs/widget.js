console.log("Widget JS loaded");

function injectNewsletterWidget() {
  // Newsletter Widget JS
  (function(root) {
    if (document.getElementById('newsletterContainer')) return; // Prevent double-injection

    // Widget HTML
    var widgetHTML = `
      <div class="newsletter-container" id="newsletterContainer">
        <div class="newsletter-banner" id="newsletterBanner">
          <button class="banner-close-button" id="bannerCloseButton">
            <svg class="banner-close-icon" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <line x1="18" x2="6" y1="6" y2="18"></line>
              <line x1="6" x2="18" y1="6" y2="18"></line>
            </svg>
          </button>
          <div class="banner-content" id="bannerContent">
            <div class="banner-emoji">☝️</div>
            <div class="banner-text">This story's featured in our daily Regina recap.</div>
            <button class="expand-button" id="expandButton">
              <span>Try it free</span>
              <svg class="arrow" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <polyline points="18,15 12,9 6,15"></polyline>
              </svg>
            </button>
          </div>
          <div class="form-section" id="formSection">
            <div class="form-content">
              <div class="form-header">
                <h3 class="form-title">Stay in the loop</h3>
                <p class="form-subtitle">Join our newsletter and never miss an update. Get the latest news, insights, and exclusive content delivered straight to your inbox.</p>
              </div>
              <form class="form-group" id="subscribeForm">
                <div class="input-wrapper">
                  <label class="form-label" for="email">Email address</label>
                  <input class="form-input" id="email" placeholder="Enter your email" required type="email" />
                </div>
                <button class="submit-button" type="submit">Sign up</button>
              </form>
              <div class="cf-turnstile" data-sitekey="0x4AAAAAABjnEqi0fT57mwgZ" style="margin: 16px 0;"></div>
              <div class="form-message" id="formMessage" style="margin-top:16px;font-size:15px;"></div>
            </div>
          </div>
          <div class="success-message" id="successMessage">
            <strong>Thanks for subscribing!</strong><br />You'll hear from us soon.
          </div>
        </div>
      </div>
    `;

    // Inject widget at end of body
    var temp = document.createElement('div');
    temp.innerHTML = widgetHTML;
    document.body.appendChild(temp.firstElementChild);

    // Add Turnstile script separately
    if (!document.querySelector('script[src*="turnstile/v0/api.js"]')) {
      var turnstileScript = document.createElement('script');
      turnstileScript.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
      turnstileScript.async = true;
      turnstileScript.defer = true;
      document.head.appendChild(turnstileScript);
    }

    // Widget logic
    var banner = document.getElementById('newsletterBanner');
    var expandButton = document.getElementById('expandButton');
    var bannerCloseButton = document.getElementById('bannerCloseButton');
    var bannerContent = document.getElementById('bannerContent');
    var formSection = document.getElementById('formSection');
    var subscribeForm = document.getElementById('subscribeForm');
    var successMessage = document.getElementById('successMessage');
    var emailInput = document.getElementById('email');
    var newsletterContainer = document.getElementById('newsletterContainer');
    var formMessage = document.getElementById('formMessage');

    var isExpanded = false;
    var bannerVisible = false;

    // Check if user has interacted with modal in the last 5 days
    function shouldShowModal() {
      var lastInteraction = localStorage.getItem('newsletterModalLastInteraction');
      if (!lastInteraction) return true;
      
      var lastInteractionDate = new Date(lastInteraction);
      var fiveDaysAgo = new Date();
      fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
      
      return lastInteractionDate < fiveDaysAgo;
    }

    // Record user interaction with modal
    function recordModalInteraction() {
      localStorage.setItem('newsletterModalLastInteraction', new Date().toISOString());
    }

    // Handle scroll to show/hide banner
    window.addEventListener('scroll', function() {
      var scrollPercent = (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100;
      if (scrollPercent >= 10 && !bannerVisible && shouldShowModal()) {
        newsletterContainer.classList.add('visible');
        bannerVisible = true;
        if (window.posthog) window.posthog.capture('newsletter_banner_shown');
      } else if (scrollPercent < 10 && bannerVisible && !isExpanded) {
        newsletterContainer.classList.remove('visible');
        bannerVisible = false;
      }
    });

    expandButton.addEventListener('click', function(e) {
      e.stopPropagation();
      recordModalInteraction();
      toggleExpanded();
      if (window.posthog) window.posthog.capture('newsletter_modal_expanded');
    });

    bannerCloseButton.addEventListener('click', function(e) {
      e.stopPropagation();
      recordModalInteraction();
      closeBanner();
    });

    function toggleExpanded() {
      isExpanded = !isExpanded;
      if (isExpanded) {
        newsletterContainer.classList.add('expanded');
        setTimeout(function() { emailInput.focus(); }, 400);
      } else {
        newsletterContainer.classList.remove('expanded');
      }
    }

    function closeBanner() {
      newsletterContainer.classList.remove('visible');
      newsletterContainer.classList.remove('expanded');
      bannerVisible = false;
      isExpanded = false;
    }

    // Close when clicking outside (only when not expanded to full screen)
    document.addEventListener('click', function(e) {
      if (!banner.contains(e.target) && isExpanded && !newsletterContainer.classList.contains('expanded')) {
        toggleExpanded();
      }
    });

    // Handle form submission
    subscribeForm.addEventListener('submit', function(e) {
      e.preventDefault();
      if (window.posthog) window.posthog.capture('newsletter_email_submitted');
      var email = emailInput.value;
      formMessage.textContent = '';
      var turnstileToken = '';
      if (window.turnstile) {
        turnstileToken = turnstile.getResponse();
      }
      if (!turnstileToken) {
        formMessage.textContent = 'Please complete the CAPTCHA.';
        return;
      }
      if (email) {
        // Disable form
        emailInput.disabled = true;
        subscribeForm.querySelector('.submit-button').disabled = true;
        formMessage.textContent = 'Submitting...';
        fetch('https://newsletter-worker.nmorrison.workers.dev', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, turnstile_token: turnstileToken })
        })
        .then(async (res) => {
          const data = await res.json().catch(() => ({}));
          if (res.ok && data.success) {
            recordModalInteraction();
            formSection.style.display = 'none';
            successMessage.classList.add('show');
            setTimeout(function() {
              successMessage.classList.remove('show');
              formSection.style.display = 'flex';
              emailInput.value = '';
              if (window.turnstile) {
                turnstile.reset();
              }
              closeBanner();
            }, 3000);
          } else {
            formMessage.textContent = data.error || 'An error occurred. Please try again.';
          }
        })
        .catch(() => {
          formMessage.textContent = 'Network error. Please try again.';
        })
        .finally(() => {
          emailInput.disabled = false;
          subscribeForm.querySelector('.submit-button').disabled = false;
        });
      }
    });

    // Prevent form section clicks from closing the banner
    formSection.addEventListener('click', function(e) {
      e.stopPropagation();
    });

    // Handle escape key to close expanded modal
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && isExpanded) {
        toggleExpanded();
      }
    });

  })(window);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', injectNewsletterWidget);
} else {
  injectNewsletterWidget();
} 