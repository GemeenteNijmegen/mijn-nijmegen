document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('a.spin').forEach(link => {
    link.addEventListener('click', function (e) {
      if (this.querySelector('.btn-spinner')) return; // Already spinning

      // Inject keyframes once
      if (!document.getElementById('spinner-style')) {
        const style = document.createElement('style');
        style.id = 'spinner-style';
        style.textContent = `
              @keyframes spin { to { transform: rotate(360deg); } }
              .btn-spinner {
                display: inline-block;
                width: 12px;
                height: 12px;
                border: 2px solid currentColor;
                border-top-color: transparent;
                border-radius: 50%;
                animation: spin 0.7s linear infinite;
                margin-left: 8px;
                opacity: 0.8;
                flex-shrink: 0;
              }
            `;
        document.head.appendChild(style);
      }

      this.style.pointerEvents = 'none';
      this.style.opacity = '0.85';

      const spinEl = document.createElement('span');
      spinEl.className = 'btn-spinner';
      this.appendChild(spinEl);
    });
  });
});
