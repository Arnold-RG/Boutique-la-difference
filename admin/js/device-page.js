(function () {
  var root = document.getElementById('root');
  fetch('/api/session', { credentials: 'same-origin', headers: { Accept: 'application/json' } })
    .then(function (res) { if (!res.ok) throw new Error('signed out'); return res.json(); })
    .then(function () {
      var id = BLDAuth.getOrCreateDeviceId();
      BLDAuth.registerThisDevice();
      root.innerHTML = ''
        + '<div class="auth-card">'
        + '<p class="login-kicker">This browser</p>'
        + '<h1 class="display">Already inside</h1>'
        + '<p>This computer is signed in through the shop server. The note below is stored only in this browser.</p>'
        + '<p class="step-note">Browser id<br><strong>' + id + '</strong></p>'
        + '<a class="btn btn-brass" href="index.html">Back to the office</a>'
        + '</div>';
    })
    .catch(function () {
      window.location.replace('login');
    });
})();
