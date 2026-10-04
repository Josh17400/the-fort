/*
 * capacitor-gamekit - JS entry point.
 *
 * Hand-written UMD (no build step). native/shell.js registers 'GameKit' itself;
 * this file keeps the package a valid Capacitor plugin and gives the web a clean
 * "unavailable" rejection instead of Capacitor's UNIMPLEMENTED error.
 */
(function (root, factory) {
  'use strict';
  if (typeof exports === 'object' && typeof module !== 'undefined') {
    module.exports = factory(require('@capacitor/core'));
  } else {
    root.capacitorGameKit = factory(root.capacitorExports);
  }
}(typeof self !== 'undefined' ? self : this, function (core) {
  'use strict';

  function unavailable() {
    return Promise.reject(new Error('Game Center is only available on iOS'));
  }

  var stub = {
    signIn: unavailable,
    submitScore: unavailable,
    showLeaderboard: unavailable,
    unlockAchievement: unavailable,
    showAchievements: unavailable,
    requestReview: unavailable,
    cloudGet: unavailable,
    cloudPut: unavailable
  };

  return {
    GameKit: core.registerPlugin('GameKit', {
      web: function () { return stub; }
    })
  };
}));
