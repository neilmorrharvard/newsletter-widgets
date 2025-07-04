// Newsletter Widget JS
(function(root) {
  // Widget code will go here
  root.NewsletterWidget = function(options) {
    // Mount widget to #newsletter-widget-root
    var container = document.getElementById('newsletter-widget-root');
    if (!container) return;
    container.innerHTML = '<div style="padding:20px;border:1px solid #ccc;border-radius:8px;">Newsletter Widget Placeholder</div>';
  };
  // Auto-mount for demo
  if (document.getElementById('newsletter-widget-root')) {
    root.NewsletterWidget();
  }
})(window); 