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
