(function () {
  var y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();

  var fab = document.getElementById('helpFab');
  var sheet = document.getElementById('helpSheet');
  var scrim = document.getElementById('helpScrim');
  var closeBtn = document.getElementById('helpCloseBtn');
  if (!fab || !sheet || !scrim || !closeBtn) return;

  function openHelp(on) {
    sheet.classList.toggle('is-on', on);
    scrim.classList.toggle('is-on', on);
    sheet.setAttribute('aria-hidden', on ? 'false' : 'true');
    fab.setAttribute('aria-expanded', on ? 'true' : 'false');
    fab.textContent = on ? 'Close' : 'Message the shop';
    document.body.classList.toggle('help-open', on);
    if (on) {
      try { window.dispatchEvent(new CustomEvent('bld:help-open')); } catch (e) {}
      setTimeout(function () {
        var input = document.getElementById('helpInput');
        if (input) input.focus();
      }, 80);
    }
  }

  openHelp(false);
  fab.addEventListener('click', function (e) {
    e.preventDefault();
    openHelp(!sheet.classList.contains('is-on'));
  });
  closeBtn.addEventListener('click', function (e) {
    e.preventDefault();
    openHelp(false);
  });
  scrim.addEventListener('click', function () { openHelp(false); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && sheet.classList.contains('is-on')) openHelp(false);
  });
  var foot = document.getElementById('helpFoot');
  if (foot) foot.addEventListener('submit', function (e) { e.preventDefault(); });
  window.BLDHelpChat = { open: openHelp, isOpen: function () { return sheet.classList.contains('is-on'); } };
})();
