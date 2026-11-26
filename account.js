(() => {
  const root = document.querySelector('#slx-account');
  const {api,element,money} = window.slx;
  const orderStatus = {
    new:'New', availability_check:'Checking availability', awaiting_payment:'Awaiting payment',
    paid:'Deposit verified', sent_to_manufacturer:'Sent to production', in_production:'In production',
    preparing_shipment:'Preparing shipment', completed:'Completed', return_requested:'Return requested',
    shipped:'Shipped', delivered:'Delivered', cancelled:'Cancelled', returned:'Returned',
    defective:'Defective', unclaimed:'Unclaimed',
  };
  const date = new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeStyle:'short',timeZone:'Europe/Kyiv'});
  const params = new URLSearchParams(location.hash.slice(1));
  function state(label) {
    const message = element('p',{},label);
    message.setAttribute('role','status');
    return message;
  }
  function teamLogin() {
    return element('a',{href:'/admin',className:'text-button'},'Staff sign-in');
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
    const button = element('button',{className:'primary',type:'submit'},'Send code');
    const form = element('form',{className:'interest-form'},element('label',{},'Email',email),button,message);
    root.replaceChildren(form,teamLogin());
    submit(form,message,body=>api('otp',{body}),()=>verify(email.value));
  }
  function verify(email) {
    const code = element('input',{name:'code',inputMode:'numeric',autocomplete:'one-time-code',required:true,pattern:'[0-9]{6,8}'});
    const message = state('Check your inbox. If the code is missing, check your email address.');
    const back = element('button',{type:'button',className:'text-button'},'Use a different address');
    back.addEventListener('click',login);
    const form = element('form',{className:'interest-form'},element('label',{},'Verification code',code),
      element('button',{className:'primary',type:'submit'},'Verify'),back,message);
    root.replaceChildren(form,teamLogin());
    code.focus();
    submit(form,message,body=>api('verify',{body:{email,...body}}),render);
  }
  async function render() {
    try {
      const unsubscribe = params.get('unsubscribe');
      if (unsubscribe) {
        const notice = state('Working…');
        const button = element('button',{className:'primary',type:'button'},'Unsubscribe');
        const erase = element('button',{className:'secondary',type:'button'},'Delete my signup');
        notice.textContent = 'You can unsubscribe or delete this signup and its consent record.';
        root.replaceChildren(notice,button,erase);
        async function update(shouldErase) {
          button.disabled = erase.disabled = true;
          try {
            await api('unsubscribe',{body:{token:unsubscribe,erase:shouldErase}});
            history.replaceState(null,'',location.pathname);
            root.replaceChildren(state(shouldErase ? 'If this link matched a signup, it has been deleted.' : 'If this link matched a signup, it has been unsubscribed.'));
          } catch (error) { notice.textContent = error.message; button.disabled = erase.disabled = false; }
        }
        button.addEventListener('click',()=>update(false));
        erase.addEventListener('click',()=>update(true));
        return;
      }
      const {user,orders,authReady} = await api('account');
      if (!user) {
        if (authReady) login();
        else root.replaceChildren(state('Sign-in is not available yet.'));
        return;
      }
      const logout = element('button',{className:'secondary',type:'button'},'Sign out');
      const message = state('');
      logout.addEventListener('click',async()=>{
        try { await api('logout',{body:{}}); await render(); }
        catch (error) { message.textContent = error.message; }
      });
      root.replaceChildren(element('p',{className:'muted'},user.email),logout,message,element('h2',{},'My orders'));
      if (!orders.length) root.append(element('p',{className:'muted'},'You have no orders yet.'));
      for (const order of orders) {
        const history = (order.events ?? []).map(event=>element('li',{},`${date.format(new Date(event.at))} · ${orderStatus[event.status]}`));
        let requestReturn;
        if (['delivered','completed'].includes(order.status) && user.role==='customer') {
          const status=state('');
          requestReturn=element('form',{className:'interest-form'},
            element('label',{},'Reason for return',element('textarea',{name:'reason',maxLength:500,required:true})),
            element('button',{className:'secondary',type:'submit'},'Request a return'),status);
          submit(requestReturn,status,body=>api('order-return',{body:{id:order.id,expectedStatus:order.status,reason:body.reason}}),render);
        }
        root.append(element('details',{className:'ops-card'},
          element('summary',{},`${orderStatus[order.status]} · ${date.format(new Date(order.created_at))} · ${money(order.subtotal)}`),
          element('p',{className:'muted'},order.id),
          order.advance!=null ? element('p',{className:'muted'},`Deposit: ${money(order.advance)} · balance: ${money(Number(order.subtotal)-Number(order.advance))}`) : null,
          element('ul',{},order.items.map(item=>element('li',{},[item.name,item.size,item.color,`×${item.quantity}`].filter(Boolean).join(' · ')))),
          order.tracking ? element('p',{},`Tracking number: ${order.tracking}`) : null,element('ol',{},history),requestReturn));
      }
    } catch (error) { root.replaceChildren(state(error.message)); }
  }
  render();
})();
