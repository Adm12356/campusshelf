// CampusShelf frontend behaviour (favourites, cart, gallery, toast).
// All data lives in MySQL; this file only talks to the server.
const $ = s => document.querySelector(s);
let toastTimer;

function toast(msg) {
  const el = $('#toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2500);
}

async function post(url) {
  const res = await fetch(url, { method: 'POST', headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error('Request failed');
  return res.json();
}

document.addEventListener('click', async e => {
  // ---- favourite toggle ----
  const fav = e.target.closest('[data-favorite]');
  if (fav) {
    e.preventDefault();
    try {
      const { saved } = await post('/favourite/' + fav.dataset.favorite);
      // every heart for this product on the page (card heart or detail button)
      document.querySelectorAll(`[data-favorite="${fav.dataset.favorite}"]`).forEach(b => {
        b.classList.toggle('saved', saved);
        const icon = b.querySelector('.heart-icon');
        if (icon) { icon.textContent = saved ? '♥' : '♡'; b.lastChild.textContent = saved ? ' Saved' : ' Save'; }
        else b.textContent = saved ? '♥' : '♡';
      });
      toast(saved ? 'Saved to favourites' : 'Removed from favourites');

      // on the favourites page, un-saving removes the card
      if ($('main[data-page="favourites"]') && !saved) {
        fav.closest('.product-card')?.remove();
        if (!$('#favouritesGrid .product-card')) {
          $('#favouritesGrid').classList.add('hidden');
          $('#favouritesEmpty').classList.remove('hidden');
        }
      }
    } catch { toast('Something went wrong. Please try again.'); }
    return;
  }

  // ---- add to cart ----
  const add = e.target.closest('[data-addcart]');
  if (add) {
    try {
      const r = await post('/cart/add/' + add.dataset.addcart);
      toast(r.message);
      if (r.ok) {
        add.textContent = 'In cart ✓';
        const c = $('#cartCount');
        if (c) c.textContent = r.count;
      }
    } catch { toast('Something went wrong. Please try again.'); }
    return;
  }

  // ---- product detail gallery ----
  const thumb = e.target.closest('[data-thumb]');
  if (thumb && $('#mainImage')) $('#mainImage').src = thumb.dataset.thumb;
});
