document.addEventListener('click', function (event) {
  const link = event.target.closest('a[href*="book.evelinmakeup.com"]');

  if (!link) return;

  event.preventDefault();

  const url = link.href;

  gtag('event', 'book_makeup_click', {
    link_url: url,
    link_text: link.innerText.trim(),
    event_callback: function () {
      window.location.href = url;
    },
    event_timeout: 1000
  });
});

(function () {
  const STORAGE_KEY = 'google_ads_gclid';
  const STORAGE_TIME_KEY = 'google_ads_gclid_time';
  const MAX_AGE_DAYS = 90;

  let gclid = null;

  try {
    const params = new URLSearchParams(window.location.search);
    const gclidFromUrl = params.get('gclid');

    // 1. If Google Ads supplied a GCLID, save it
    if (gclidFromUrl) {
      localStorage.setItem(STORAGE_KEY, gclidFromUrl);
      localStorage.setItem(STORAGE_TIME_KEY, Date.now().toString());
    }

    // 2. Read the saved GCLID if it is not expired
    gclid = localStorage.getItem(STORAGE_KEY);
    const savedAt = Number(localStorage.getItem(STORAGE_TIME_KEY));

    if (gclid && savedAt) {
      const ageMs = Date.now() - savedAt;
      const maxAgeMs = MAX_AGE_DAYS * 24 * 60 * 60 * 1000;

      if (ageMs > maxAgeMs) {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(STORAGE_TIME_KEY);
        gclid = null;
      }
    }
  } catch (e) {
    // localStorage unavailable (private mode, blocked storage, etc.)
    gclid = null;
  }

  if (!gclid) return;

  // 3. Attach GCLID to the booking link at click time, not page load —
  // works even if the link is added to the DOM after this script runs.
  document.addEventListener('click', function (e) {
    const link = e.target.closest('a[href*="book.evelinmakeup.com"]');
    if (!link) return;

    try {
      const url = new URL(link.href);
      url.searchParams.set('gclid', gclid);
      link.href = url.toString();
    } catch (err) {
      console.warn('Unable to add GCLID to booking link', link.href);
    }
  }, true); // capture phase: runs before the browser follows the link
})();
