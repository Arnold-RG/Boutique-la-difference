(function () {
  var root = document.getElementById('root');

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  fetch('/api/session', { credentials: 'same-origin', headers: { Accept: 'application/json' } })
    .then(function (res) { if (!res.ok) throw new Error('signed out'); return res.json(); })
    .then(function () {
      var id = BLDAuth.getOrCreateDeviceId();
      BLDAuth.registerThisDevice();
      var card = el('div', 'auth-card');
      card.appendChild(el('p', 'login-kicker', 'This browser'));
      card.appendChild(el('h1', 'display', 'Already inside'));
      card.appendChild(el('p', null, 'This computer is signed in through the shop server. The note below is stored only in this browser.'));
      var note = el('p', 'step-note', 'Browser id');
      note.appendChild(document.createElement('br'));
      note.appendChild(el('strong', null, String(id)));
      card.appendChild(note);
      var back = el('a', 'btn btn-brass', 'Back to the office');
      back.href = 'index.html';
      card.appendChild(back);
      root.textContent = '';
      root.appendChild(card);
    })
    .catch(function () {
      window.location.replace('login');
    });
})();
