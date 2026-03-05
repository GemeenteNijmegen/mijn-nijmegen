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
        if (!input.checkValidity()) {
          input.classList.add('is-invalid');
        } else {
          input.classList.remove('is-invalid');
        }
      });
    });
  });
})();
