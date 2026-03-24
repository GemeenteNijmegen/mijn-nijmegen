document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('a.spinner').forEach(link => {
    link.addEventListener('click', function (e) {
      e.preventDefault(); // Remove in production

      if (this.querySelector('.btn-spinner')) return;

      this.setAttribute('aria-disabled', 'true');

      const spinEl = document.createElement('span');
      spinEl.className = 'btn-spinner';
      this.appendChild(spinEl);
    });
  });
});
