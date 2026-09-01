addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.mijn-tabs').forEach(initTabs);
});

/**
 * WAI-ARIA APG tabs pattern (automatic activation): arrow keys move focus and
 * activate, Home/End jump to first/last, click activates.
 *
 * @param {HTMLElement} root a `.mijn-tabs` container
 */
function initTabs(root) {
  const tabs = Array.from(root.querySelectorAll('[role="tab"]'));
  const panels = tabs.map((tab) => document.getElementById(tab.getAttribute('aria-controls')));

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => activate(index));
    tab.addEventListener('keydown', (event) => onKeydown(event, index));
  });

  function activate(index) {
    tabs.forEach((tab, i) => {
      const selected = i === index;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      panels[i].hidden = !selected;
    });
    tabs[index].focus();
  }

  function onKeydown(event, index) {
    let newIndex;
    switch (event.key) {
      case 'ArrowRight':
        newIndex = (index + 1) % tabs.length;
        break;
      case 'ArrowLeft':
        newIndex = (index - 1 + tabs.length) % tabs.length;
        break;
      case 'Home':
        newIndex = 0;
        break;
      case 'End':
        newIndex = tabs.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    activate(newIndex);
  }
}
