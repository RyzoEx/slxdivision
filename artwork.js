(() => {
  const dialog = document.createElement('dialog');
  dialog.className = 'artwork-dialog';
  dialog.setAttribute('aria-labelledby','artwork-dialog-title');
  dialog.innerHTML = '<div class="artwork-dialog-bar"><h2 id="artwork-dialog-title"></h2><button class="secondary" type="button" autofocus>Close</button></div><img alt="">';
  document.body.append(dialog);
  const image = dialog.querySelector('img');
  let opener;
  dialog.querySelector('button').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',event=>{ if (event.target === dialog) dialog.close(); });
  dialog.addEventListener('close',()=>{
    image.removeAttribute('src');
    opener?.focus();
  });
  document.addEventListener('click',event=>{
    const link = event.target.closest('[data-artwork]');
    if (!link || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    opener = link;
    dialog.querySelector('h2').textContent = link.dataset.artworkName;
    image.alt = link.querySelector('img').alt;
    image.src = link.href;
    dialog.showModal();
    link.dispatchEvent(new Event('slx:artwork-view',{bubbles:true}));
  });
})();
