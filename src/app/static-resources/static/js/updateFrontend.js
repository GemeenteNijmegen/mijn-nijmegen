addEventListener("DOMContentLoaded", (event) => {
  updateContent();
});

/**
 * Check if zaken have loaded, if not, try to load async
 */
function updateContent() {
  const body = document.querySelector('body');
  if(body.dataset?.loaded=='false') {
    body.dataset.loadattempts = '0';
    getData();
  }
}

async function getData() {
  const token = document.querySelector('meta[name=xsrf-token]').content;
  const response = await fetch('', {
    method: 'GET',
    credentials: "same-origin",
    headers: { 
      'Accept': 'application/json',
      'xsrftoken': token,
    }
  });

  if(!response.ok) {
    throw new Error('Network response was not OK');
  };
  const data = await response.json();
  if(data.elements) {
    for(el of data.elements) {
      replaceElement(el);
    }
  } 
  if(data.error) {
    console.error(data.error);
    if(response.status == 408) {
      // Time out, try again.
      const attempt = Number(body.dataset.loadattempts) + 1;
      body.dataset.loadattempts = attempt;
      if(attempt < 3) {
        updateContent();
      }
    }
  }
};


/**
 * Transform an html-string to an actual nodetree
 * 
 * @param {string} html the valid HTML as as string
 * @returns {Node} the html node
 */
function htmlStringToElement(html) {
  var template = document.createElement('template');
  html = html.trim(); // Never return a text node of whitespace as the result
  template.innerHTML = html;
  return template.content.firstChild;
}

/**
 * Replace a DOM-element with another element
 * 
 * It will replace an element with the same ID value
 * as the replacing element.
 * 
 * @param {Node} data 
 */
function replaceElement(data) {
  const element = htmlStringToElement(data);
  const old = document.getElementById(element.id);
  old.replaceWith(element);
}
