(function() {
  var attrs = ['bis_skin_checked', 'bis_register'];
  attrs.forEach(function(attr) {
    document.querySelectorAll('[' + attr + ']').forEach(function(el) {
      el.removeAttribute(attr);
    });
  });
})();
