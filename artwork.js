(() => {
  const dialog = document.createElement('dialog');
  dialog.className = 'artwork-dialog';
  dialog.setAttribute('aria-labelledby','artwork-dialog-title');
  dialog.innerHTML = '<div class="artwork-dialog-bar"><h2 id="artwork-dialog-title"></h2><button class="secondary" type="button" autofocus>Close</button></div><img alt="">';
  document.body.append(dialog);
  const teaser = document.querySelector('[data-teaser-play]');
  const launch = document.querySelector('[data-play-teaser]');
  if (teaser && launch) {
    const status = document.querySelector('.teaser-status');
    teaser.addEventListener('error',()=>{
      status.textContent = 'Could not load the teaser. Try again.';
      launch.hidden = false;
      launch.disabled = false;
    });
    launch.addEventListener('click',()=>{
      launch.disabled = true;
      status.textContent = '';
      teaser.controls = true;
      teaser.src = teaser.dataset.src;
      teaser.play().then(()=>{
        teaser.tabIndex = 0;
        teaser.focus({preventScroll:true});
        launch.hidden = true;
      }).catch(()=>{
        launch.disabled = false;
        status.textContent = 'Playback could not start. Try the player controls.';
      });
    });
  }
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
