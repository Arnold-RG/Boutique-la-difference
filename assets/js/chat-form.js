/**
 * Chat form binding — submit sends through the existing chat logic without
 * reloading the page (Enter and the Send button both submit the form).
 */
(function (global) {
  function bindChatForm(form, send) {
    if (!form || typeof send !== 'function') return null;
    function onSubmit(e) {
      if (e && typeof e.preventDefault === 'function') e.preventDefault();
      send();
      return false;
    }
    form.addEventListener('submit', onSubmit);
    return onSubmit;
  }
  const api = { bindChatForm };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.BLDChatForm = api;
})(typeof window !== 'undefined' ? window : globalThis);
