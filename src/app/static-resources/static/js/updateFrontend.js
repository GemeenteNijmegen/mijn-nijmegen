addEventListener("DOMContentLoaded", (event) => {
  updateContent();
});

const MAX_LOAD_ATTEMPTS = 3;
// Status codes on which loading the data again might succeed (timeouts, (gateway) errors)
const RETRYABLE_STATUS_CODES = [408, 500, 502, 503, 504];

/**
 * Check if zaken have loaded, if not, try to load async
 */
function updateContent() {
  const body = document.querySelector('body');
  if(body.dataset?.loaded=='false') {
    body.dataset.loadattempts = body.dataset.loadattempts ?? '0';
    getData().catch((error) => {
      console.error(error);
      showNotice();
    });
  }
}

async function getData() {
  const body = document.querySelector('body');
  const token = document.querySelector('meta[name=xsrf-token]').content;
  const response = await fetch('', {
    method: 'GET',
    credentials: "same-origin",
    headers: {
      'Accept': 'application/json',
      'xsrftoken': token,
    }
  });
  // Error responses (e.g. from the gateway) do not always have a JSON body
  const data = await response.json().catch(() => ({}));

  // Partial responses can contain the elements that did load
  for(const el of data.elements ?? []) {
    if(el) {
      replaceElement(el);
    }
  }

  if(response.ok) {
    return;
  }
  if(!RETRYABLE_STATUS_CODES.includes(response.status)) {
    throw new Error(`Network response was not OK (status ${response.status})`);
  }
  const attempt = Number(body.dataset.loadattempts) + 1;
  body.dataset.loadattempts = attempt;
  console.log(`attempted loading ${attempt} times`);
  if(attempt < MAX_LOAD_ATTEMPTS) {
    updateContent();
  } else {
    showNotice();
  }
};

/**
 * Replace the placeholder with the same ID as the element in the html-string
 *
 * The html may contain siblings without an ID (e.g. an alert before the list),
 * these are inserted in place of the placeholder as well.
 *
 * @param {string} html the valid HTML as as string
 */
function replaceElement(html) {
  const template = document.createElement('template');
  template.innerHTML = html.trim();
  const element = Array.from(template.content.children).find((child) => child.id);
  const old = element && document.getElementById(element.id);
  if(!old) {
    console.warn('No element found to replace', element?.id);
    return;
  }
  old.replaceWith(template.content);
}

function showNotice() {
  if(document.getElementById('load-notice')) {
    return;
  }
  const notice = `<div id="load-notice" class="utrecht-alert utrecht-alert--warning" role="alert">
    <p class="utrecht-paragraph">Het laden van uw gegevens is niet gelukt. Ververs de pagina om het opnieuw te proberen. Werkt het nog steeds niet, probeer het dan op een
    later moment opnieuw.</p>
  </div>`;
  document.getElementById('main')?.insertAdjacentHTML('afterbegin', notice);
}
