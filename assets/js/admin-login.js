(function () {
  var code = new URLSearchParams(location.search).get('e');
  var messages = {
    invalid: 'Those details were not accepted.',
    locked: 'Too many attempts. Wait a few minutes, then try again.',
    unconfigured: 'Sign-in is not set up on this server yet.'
  };
  var el = document.getElementById('loginError');
  if (el && messages[code]) el.textContent = messages[code];
})();
