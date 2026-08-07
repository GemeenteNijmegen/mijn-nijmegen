(function() {
  var forms = document.querySelectorAll('form[novalidate]');
  
  forms.forEach(function(form) {
    form.addEventListener('submit', function(e) {
      if (!form.checkValidity()) {
        e.preventDefault();
        e.stopPropagation();
      }
      
      var inputs = form.querySelectorAll('input[required], input[pattern]');
      inputs.forEach(function(input) {
        var valid = input.checkValidity();
        input.setAttribute('aria-invalid', valid ? 'false' : 'true');
        var errorMessage = document.getElementById(input.id + '-error');
        if (errorMessage) {
          errorMessage.hidden = valid;
        }
      });
    });
  });
})();
