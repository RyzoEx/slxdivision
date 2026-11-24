(() => {
  const root = document.querySelector('#slx-account');
  const {api,element,money,orderStatus} = window.slx;
  const date = new Intl.DateTimeFormat('uk-UA',{dateStyle:'medium',timeStyle:'short',timeZone:'Europe/Kyiv'});
  const params = new URLSearchParams(location.hash.slice(1));
  function state(label) {
    const message = element('p',{},label);
    message.setAttribute('role','status');
    return message;
  }
  function teamLogin() {
    return element('a',{href:'/admin',className:'text-button'},'Вхід для команди');
  }
  function submit(form, message, call, success) {
    const button = form.querySelector('button[type="submit"]');
    form.addEventListener('submit',async event=>{
      event.preventDefault();
      button.disabled = true;
      try { await call(Object.fromEntries(new FormData(form))); await success(); }
      catch (error) { message.textContent = error.message; }
      finally { button.disabled = false; }
    });
  }
  function login() {
    const email = element('input',{type:'email',name:'email',required:true,autocomplete:'email'});
    const message = state('');
    const button = element('button',{className:'primary',type:'submit'},'Надіслати код');
    const form = element('form',{className:'interest-form'},element('label',{},'Email',email),button,message);
    root.replaceChildren(form,teamLogin());
    submit(form,message,body=>api('otp',{body}),()=>verify(email.value));
  }
  function verify(email) {
    const code = element('input',{name:'code',inputMode:'numeric',autocomplete:'one-time-code',required:true,pattern:'[0-9]{6,8}'});
    const message = state('Перевірте пошту. Якщо коду немає, перевірте адресу.');
    const back = element('button',{type:'button',className:'text-button'},'Інша адреса');
    back.addEventListener('click',login);
    const form = element('form',{className:'interest-form'},element('label',{},'Код підтвердження',code),
      element('button',{className:'primary',type:'submit'},'Підтвердити'),back,message);
    root.replaceChildren(form,teamLogin());
    code.focus();
    submit(form,message,body=>api('verify',{body:{email,...body}}),render);
  }
  async function render() {
    try {
      const unsubscribe = params.get('unsubscribe');
      if (unsubscribe) {
        const notice = state('Виконуємо запит…');
        const button = element('button',{className:'primary',type:'button'},'Відписатися');
        notice.textContent = 'Підтвердьте відписку від цього сповіщення.';
        root.replaceChildren(notice,button);
        button.addEventListener('click',async()=>{
          button.disabled = true;
          try {
            await api('unsubscribe',{body:{token:unsubscribe}});
            history.replaceState(null,'',location.pathname);
            root.replaceChildren(state('Ви відписалися від цього сповіщення.'));
          } catch (error) { notice.textContent = error.message; button.disabled = false; }
        });
        return;
      }
      const {user,orders,authReady} = await api('account');
      if (!user) {
        if (authReady) login();
        else root.replaceChildren(state('Вхід ще не налаштовано.'));
        return;
      }
      const logout = element('button',{className:'secondary',type:'button'},'Вийти');
      const message = state('');
      logout.addEventListener('click',async()=>{
        try { await api('logout',{body:{}}); await render(); }
        catch (error) { message.textContent = error.message; }
      });
      root.replaceChildren(element('p',{className:'muted'},user.email),logout,message,element('h2',{},'Мої замовлення'));
      if (!orders.length) root.append(element('p',{className:'muted'},'У вас ще немає замовлень.'));
      for (const order of orders) {
        const history = (order.events ?? []).map(event=>element('li',{},`${date.format(new Date(event.at))} · ${orderStatus[event.status]}`));
        root.append(element('details',{className:'ops-card'},
          element('summary',{},`${orderStatus[order.status]} · ${date.format(new Date(order.created_at))} · ${money(order.subtotal)}`),
          element('p',{className:'muted'},order.id),
          element('ul',{},order.items.map(item=>element('li',{},[item.name,item.size,item.color,`×${item.quantity}`].filter(Boolean).join(' · ')))),
          order.tracking ? element('p',{},`ТТН: ${order.tracking}`) : null,element('ol',{},history)));
      }
    } catch (error) { root.replaceChildren(state(error.message)); }
  }
  render();
})();
