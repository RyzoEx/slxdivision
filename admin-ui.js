(() => {
  const {api,endpoint,element:h,money,orderStatus,productStatus} = window.slx;
  const login = document.querySelector('#admin-login');
  const formValues = form => Object.fromEntries(new FormData(form));
  if (login) {
    login.addEventListener('submit',async event=>{
      event.preventDefault();
      const button = login.querySelector('button');
      button.disabled = true;
      try { await api('login',{body:formValues(login)}); location.reload(); }
      catch (error) { login.querySelector('[role="status"]').textContent = error.message; button.disabled = false; }
    });
    return;
  }

  const panel = document.querySelector('#admin-panel');
  const nav = document.querySelector('#admin-navigation');
  const message = document.querySelector('#admin-message');
  const dt = new Intl.DateTimeFormat('uk-UA',{dateStyle:'short',timeStyle:'short',timeZone:'Europe/Kyiv'});
  const ymd = new Intl.DateTimeFormat('sv-SE',{year:'numeric',month:'2-digit',day:'2-digit',timeZone:'Europe/Kyiv'});
  const cost = {
    garment:'Одяг',printing:'Друк',fulfillment:'Фулфілмент',shipping:'Доставка',payment_fee:'Платіжна комісія',
    return_reserve:'Резерв повернень',tax:'Податки',
  };
  const roles = {owner:'Власник',manager:'Менеджер',operator:'Оператор'};
  const tabs = {
    dashboard:['Огляд','admin-summary'],products:['Товари','admin-products'],collections:['Колекції','admin-collections'],
    orders:['Замовлення','admin-orders'],customers:['Клієнти','admin-customers'],manufacturing:['Виробництво','admin-manufacturing'],
    finance:['Фінанси','admin-finance'],referrals:['SLX Circle','admin-referrals'],settings:['Налаштування','admin-settings'],
  };
  let me;
  let tab = 'dashboard';
  let mode = 'test';
  let loadNumber = 0;
  const unauthorized = error => { if (error.status===401) location.reload(); else message.textContent = error.message; };
  const read = (op,params={}) => api(op,{params:{mode,...params}});
  const post = (op,body) => api(op,{params:{mode},body});
  const card = (...children) => h('section',{className:'ops-card'},...children);
  const summary = () => h('button',{type:'submit',className:'primary'},'Зберегти');
  const action = (label,run) => {
    const button = h('button',{type:'button',className:'secondary'},label);
    button.addEventListener('click',async()=>{
      button.disabled = true;
      message.textContent = '';
      try { await run(); } catch(error) { unauthorized(error); }
      finally { button.disabled = false; }
    });
    return button;
  };
  const field = (label,name,value='',options={}) => h('label',{},label,h('input',{name,value:String(value ?? ''),...options}));
  const choose = (label,name,choices,value) => {
    const list = h('select',{name});
    list.setAttribute('aria-label',label);
    for (const [id,caption] of choices) list.append(new Option(caption,id,false,id===value));
    return h('label',{},label,list);
  };
  const checkbox = (label,name,checked) => h('label',{className:'ops-check'},h('input',{type:'checkbox',name,checked}),label);
  const note = text => h('p',{className:'muted'},text);
  const numeric = {type:'number',min:0,step:.01};
  const percent = {...numeric,max:100};
  const toMinor = value => value === '' ? null : Math.round(Number(value)*100);
  const fromMinor = value => value === null || value === undefined ? '' : Number(value)/100;
  const split = value => value.split(',').map(entry=>entry.trim()).filter(Boolean);
  const brief = id => id.slice(0,8).toUpperCase();
  const ds = value => dt.format(new Date(value));
  const heading = title => h('h2',{},title);
  function form(fields, submit, run, {refresh=true} = {}) {
    const node = h('form',{className:'ops-form'},fields,submit);
    node.addEventListener('submit',async event=>{
      event.preventDefault();
      submit.disabled = true;
      message.textContent = '';
      try {
        await run(formValues(node),node);
        message.textContent = 'Збережено.';
        if (refresh) await render();
      } catch(error) { unauthorized(error); }
      finally { submit.disabled = false; }
    });
    return node;
  }
  function dashboard(data) {
    return [note(data.sales ? 'Робочі замовлення відкрито. Оплати вимкнено.' : 'Передзапуск. Оплачувані замовлення вимкнено.'),
      card(heading('Каталог'),h('p',{},`Речей: ${data.products}`)),
      card(heading('Замовлення'),...(data.counts.length ? data.counts.map(row=>h('p',{},`${orderStatus[row.status]} · ${row.count}`)) : [note('Ще немає замовлень.')]))];
  }
  async function upload(file) {
    if (file.size > 1400000) throw new Error('Зображення має бути до 1,4 МБ.');
    const extension = {'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[file.type];
    if (!extension) throw new Error('Виберіть JPEG, PNG або WebP.');
    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = '';
    for (let offset=0; offset<bytes.length; offset+=16384) binary += String.fromCharCode(...bytes.subarray(offset,offset+16384));
    return (await post('admin-upload',{extension,base64:btoa(binary)})).key;
  }
  function products(data) {
    if (mode==='test') return [note('Каталог спільний для обох режимів. Перейдіть у робочий режим, щоб редагувати публічні дані.'),...data.products.map(item=>card(item.name,' · ',productStatus[item.status]))];
    return [note('Операційні дані оновлюються одразу. Нові сторінки та описи додаються через Git.'),
      ...data.products.map(item=>card(
        h('div',{className:'ops-product'},h('img',{src:item.photo ? endpoint('media',{key:item.photo}) : item.src,alt:'',width:64}),heading(item.name)),
        form([
          choose('Статус','status',Object.entries(productStatus),item.status),
          field('Ціна, грн','price',fromMinor(item.price),numeric),
          field('Розміри через кому','sizes',item.sizes.join(', ')),
          field('Кольори через кому','colors',item.colors.join(', ')),
          data.storageReady ? field('Нове фото','photo','',{type:'file',accept:'image/jpeg,image/webp,image/png'}) : null,
          item.photo ? checkbox('Повернути фото з Git','reset',false) : null,
        ],summary(),async(values)=>{
          const photo = values.photo?.size ? await upload(values.photo) : values.reset ? '' : item.photo;
          await post('admin-product',{id:item.id,status:values.status,price:toMinor(values.price),sizes:split(values.sizes),colors:split(values.colors),photo});
        }),
        data.canNotify && item.status==='available' ? action('Надіслати сповіщення',async()=>{
          if (!confirm(`Надіслати сповіщення про наявність ${item.name}?`)) return;
          const result = await post('admin-notify',{id:item.id});
          message.textContent = `Надіслано: ${result.sent}. Помилки: ${result.failed}. За потреби повторіть для наступної групи.`;
        }) : null))];
  }
  function collections(data) {
    return [note('Склад колекцій і публічні матеріали керуються у Git.'),
      ...data.collections.map(item=>card(heading(item.name),note(`Речей у каталозі: ${item.count}${item.archived?' · архів':''}`),
        mode==='live' ? form([field('Внутрішня примітка','notes',item.notes,{maxLength:1000})],summary(),values=>post('admin-collection',{id:item.id,notes:values.notes}))
          : note(item.notes || 'Приміток немає.')))];
  }
  function testOrder(products) {
    const rows = h('div',{className:'test-order-rows'});
    const byId = new Map(products.map(item=>[item.id,item]));
    function addLine() {
      const itemField = choose('Річ','product',products.map(item=>[item.id,item.name]),products[0]?.id);
      const variants = h('div',{className:'ops-form'});
      function showOptions() {
        const item = byId.get(itemField.querySelector('select').value);
        const selectOrField = (name,label,values) => values.length
          ? choose(label,name,values.map(value=>[value,value]),values[0])
          : field(label,name);
        variants.replaceChildren(selectOrField('size','Розмір',item.sizes),selectOrField('color','Колір',item.colors),
          field('Тестова ціна, грн','price','',numeric),field('Кількість','quantity',1,{type:'number',min:1,max:10,required:true}));
      }
      itemField.addEventListener('change',showOptions);
      showOptions();
      const line = h('div',{className:'ops-card'},itemField,variants,
        action('Прибрати позицію',()=>{ if (rows.children.length>1) line.remove(); }));
      rows.append(line);
    }
    addLine();
    let intent;
    return card(heading('Нове тестове замовлення'),note('Тестові ціни діють лише в цьому замовленні. Дані покупця не потрібні.'),
      form([rows,action('Додати позицію',()=>{ if (rows.children.length<20) addLine(); }),field('Код SLX Circle','referral')],
        h('button',{type:'submit',className:'primary'},'Створити тестове замовлення'),async values=>{
          const items = [...rows.children].map(line=>{
            const value = key => line.querySelector(`[name="${key}"]`).value;
            return {id:value('product'),size:value('size'),color:value('color'),quantity:Number(value('quantity')),
              ...(value('price')==='' ? {} : {testPrice:toMinor(value('price'))})};
          });
          const key = JSON.stringify([items,values.referral]);
          if (intent?.key!==key) intent = {key,id:crypto.randomUUID()};
          await post('admin-test-order',{requestId:intent.id,items,referral:values.referral});
          intent = undefined;
        }));
  }
  function orders(data, manufacturing=false) {
    const output = [];
    if (!manufacturing && mode==='test' && data.products?.length) output.push(testOrder(data.products));
    const rows = manufacturing ? data.orders.filter(order=>['paid','sent_to_manufacturer','in_production','shipped','defective'].includes(order.status)) : data.orders;
    if (!rows.length) output.push(note('Замовлень у цьому режимі ще немає.'));
    for (const order of rows) {
      const fields = [
        choose('Статус','status',order.allowed.map(status=>[status,orderStatus[status]]),order.status),
        field('Технологія друку','technology',order.manufacturing.technology,{maxLength:80}),
        field('ТТН','tracking',order.manufacturing.tracking,{maxLength:64}),
        h('label',{},'Коментар виробнику',h('textarea',{name:'notes',value:order.manufacturing.notes ?? '',maxLength:600})),
      ];
      if (!manufacturing && order.financials) fields.push(...Object.entries(cost).map(([key,name])=>field(`${name}, грн`,key,fromMinor(order.financials[key]),numeric)));
      output.push(h('details',{className:'ops-card'},
        h('summary',{},`${brief(order.id)} · ${orderStatus[order.status]} · ${ds(order.created_at)}`),
        h('ul',{},order.items.map(item=>h('li',{},[item.name,item.size,item.color,`×${item.quantity}`].filter(Boolean).join(' · ')))),
        mode==='live' ? note([order.delivery.name,order.delivery.phone,order.delivery.city,order.delivery.point].filter(Boolean).join(' · ')) : null,
        order.referral_code ? note(`SLX Circle: ${order.referral_code}`) : null,
        form(fields,summary(),values=>post('admin-order',{
          id:order.id,expectedStatus:order.status,status:values.status,
          technology:values.technology,tracking:values.tracking,notes:values.notes,
          ...(!manufacturing && order.financials ? {costs:Object.fromEntries(Object.keys(cost).map(key=>[key,toMinor(values[key])]))} : {}),
        })),
        order.events.length ? h('ol',{className:'ops-timeline'},order.events.map(event=>h('li',{},`${ds(event.at)} · ${orderStatus[event.status]}`))) : null));
    }
    return output;
  }
  function customers(data) {
    if (!data.customers.length) return [note(mode==='test' ? 'Тестові замовлення не містять карток покупців.' : 'Клієнтів ще немає.')];
    return data.customers.map(user=>card(h('p',{},user.email), note(`Реальних замовлень: ${user.orders} · ${ds(user.created_at)}`)));
  }
  function finance() {
    const to = ymd.format(new Date());
    const from = to.slice(0,8)+'01';
    const result = h('div',{className:'ops-results'});
    const labels = {revenue:'Виручка',refunds:'Повернення',...cost,referrals:'SLX Circle',profit:'Прибуток'};
    async function refresh(range) {
      const data = await read('admin-finance',range);
      result.replaceChildren(card(
        h('dl',{className:'finance-grid'},Object.entries(labels).map(([key,label])=>h('div',{},h('dt',{},label),h('dd',{},money(data.totals[key]))))),
        note(`Розподіл: перша частка ${money(data.founder.first)} · друга ${money(data.founder.second)}`),
        h('a',{className:'secondary',href:endpoint('admin-finance-csv',{mode,...range})},'Завантажити CSV')));
    }
    refresh({from,to}).catch(unauthorized);
    return [form([field('Від','from',from,{type:'date',required:true}),field('До','to',to,{type:'date',required:true})],
      h('button',{type:'submit',className:'primary'},'Застосувати'),refresh,{refresh:false}),result];
  }
  function circles(data) {
    const edit = (item={},editing=false) => form([
      field('Код','code',item.code,{required:true,readOnly:editing,maxLength:24}),
      field('Назва партнера','label',item.label,{required:true,maxLength:100}),
      field('Комісія, %','bps',(item.bps ?? data.bps)/100,{...percent,required:true}),
      checkbox('Активний','active',item.active!==false),
    ],summary(),values=>post('admin-referral',{
      edit:editing,code:values.code,label:values.label,bps:toMinor(values.bps),active:values.active==='on',
    }));
    return [card(heading('Новий код'),edit()),...data.codes.map(item=>card(edit(item,true))),card(heading('Історія нарахувань'),
      ...(data.history.length ? data.history.map(entry=>h('p',{},`${ds(entry.created_at)} · ${entry.referral_code} · ${brief(entry.order_id)} · ${entry.kind==='reversal'?'Сторно':'Нарахування'} ${money(entry.amount)}`))
        : [note('Нарахувань ще немає.')]))];
  }
  function configuration(data) {
    const output = [note(data.envAllowsSales ? 'Робочий режим дозволено конфігурацією Vercel.' : 'У Vercel робочі замовлення ще не дозволені.')];
    if (mode !== 'live') return [...output,note('Для зміни налаштувань перейдіть у робочий режим.')];
    output.push(card(heading('Режим магазину'),form([
      checkbox('Приймати неоплачені запити','sales',data.config.sales),
      checkbox('Підтверджено готовність виробництва','manufacturer_ready',data.config.manufacturer_ready),
      checkbox('Підтверджено умови доставки та повернення','terms_ready',data.config.terms_ready),
      field('Частка першого засновника, %','founder_share_bps',data.config.founder_share_bps/100,{...percent,required:true}),
      field('Комісія SLX Circle за замовчуванням, %','referral_bps',data.config.referral_bps/100,{...percent,required:true}),
    ],summary(),values=>post('admin-settings',{
      sales:values.sales==='on',manufacturer_ready:values.manufacturer_ready==='on',terms_ready:values.terms_ready==='on',
      founder_share_bps:toMinor(values.founder_share_bps),referral_bps:toMinor(values.referral_bps),
    }))));
    output.push(card(heading('Доступ команди'),...data.staff.map(staff=>staff.role==='owner' ? note(`${staff.email} · ${roles[staff.role]}`)
      : form([note(staff.email),choose('Роль','role',Object.entries(roles).filter(([key])=>key!=='owner'),staff.role),checkbox('Активний','active',staff.active)],
        summary(),values=>post('admin-staff',{id:staff.id,role:values.role,active:values.active==='on'})))));
    return output;
  }
  const views = {dashboard,products,collections,orders,customers,manufacturing:data=>orders(data,true),finance,referrals:circles,settings:configuration};
  function navigation() {
    const role = me.role;
    const list = Object.keys(tabs).filter(id=>role==='owner' || (role==='manager' ? id!=='settings' : ['dashboard','orders','manufacturing'].includes(id)));
    const modeSelect = choose('Режим','mode',[['test','Тестові дані'],['live','Робочі дані']],mode);
    modeSelect.addEventListener('change',event=>{mode=event.target.value;message.textContent='';render();});
    nav.replaceChildren(h('div',{className:'ops-mode'},modeSelect,note(`${roles[role]} · ${me.email}`)),
      h('nav',{className:'ops-tabs',ariaLabel:'Модулі'},list.map(id=>{
        const button = h('button',{className:'secondary',type:'button'},tabs[id][0]);
        button.setAttribute('aria-pressed',String(id===tab));
        button.addEventListener('click',()=>{tab=id;message.textContent='';render();});
        return button;
      })));
  }
  async function render() {
    const version = ++loadNumber;
    if (me) navigation();
    panel.replaceChildren(note('Завантажуємо…'));
    try {
      if (!me) {
        const summary = await read('admin-summary');
        me = summary.user;
        navigation();
      }
      const data = tab==='finance' ? null : await read(tabs[tab][1]);
      if (version===loadNumber) panel.replaceChildren(heading(tabs[tab][0]),...views[tab](data));
    } catch (error) { if (version===loadNumber) { panel.replaceChildren(); unauthorized(error); } }
  }
  document.querySelector('[data-admin-logout]').addEventListener('click',async()=>{
    try { await api('logout',{body:{}}); location.reload(); } catch (error) { unauthorized(error); }
  });
  render();
})();
