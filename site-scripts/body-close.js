(function () {
  const STORAGE_KEY = 'google_ads_gclid';
  const STORAGE_TIME_KEY = 'google_ads_gclid_time';
  const MAX_AGE_DAYS = 90;

  let gclid = null;

  try {
    const params = new URLSearchParams(window.location.search);
    const gclidFromUrl = params.get('gclid');

    // If Google Ads supplied a GCLID, save it
    if (gclidFromUrl) {
      localStorage.setItem(STORAGE_KEY, gclidFromUrl);
      localStorage.setItem(STORAGE_TIME_KEY, Date.now().toString());
    }

    // Read the saved GCLID if it is not expired
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
    gclid = null;
  }

  document.addEventListener('click', function (event) {
    const link = event.target.closest('a[href*="book.evelinmakeup.com"]');
    if (!link) return;

    event.preventDefault();

    // Build the final URL, tagging on gclid if we have one
    let url = link.href;
    if (gclid) {
      try {
        const linkUrl = new URL(link.href);
        linkUrl.searchParams.set('gclid', gclid);
        url = linkUrl.toString();
      } catch (err) {
        console.warn('Unable to add GCLID to booking link', link.href);
      }
    }

    // record the click event with GA4, and then navigate to the booking link
    gtag('event', 'book_makeup_click', {
      link_url: url,
      link_text: link.innerText.trim(),
      event_callback: function () {
        window.location.href = url;
      },
      event_timeout: 1000
    });
  });
})();