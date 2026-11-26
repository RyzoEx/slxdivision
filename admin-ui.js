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
    garment:'Одяг',printing:'Друк',fulfillment:'Фулфілмент',other:'Додаткові витрати',
    shipping:'Доставка',payment_fee:'Платіжна комісія',return_reserve:'Витрати на повернення',tax:'Податки',
  };
  const roles = {owner:'Власник',manager:'Менеджер',operator:'Оператор'};
  const tabs = {
    dashboard:['Огляд','admin-summary'],subscribers:['Підписники','admin-subscribers'],collections:['Колекції','admin-collections'],
    social:['Соцмережі','admin-social'],system:['Система','admin-system'],products:['Товари','admin-products'],
    orders:['Замовлення','admin-orders'],customers:['Клієнти','admin-customers'],manufacturing:['Виробництво','admin-manufacturing'],
    partners:['Виробники','admin-manufacturers'],finance:['Фінанси','admin-finance'],
    referrals:['SLX Circle','admin-referrals'],settings:['Налаштування','admin-settings'],
  };
  let me;
  let tab = 'dashboard';
  let mode = 'test';
  let preview = false;
  let subscriberFilters = {};
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
  function form(fields, submit, run, {refresh=true,feedback='Збережено.'} = {}) {
    const node = h('form',{className:'ops-form'},fields,submit);
    node.addEventListener('submit',async event=>{
      event.preventDefault();
      submit.disabled = true;
      message.textContent = '';
      try {
        await run(formValues(node),node);
        message.textContent = feedback;
        if (refresh) await render();
      } catch(error) { unauthorized(error); }
      finally { submit.disabled = false; }
    });
    return node;
  }
  function dashboard(data) {
    const signups = data.signups;
    const eventNames = {'admin.login':'Вхід до панелі','collection.update':'Оновлено колекцію','social.update':'Оновлено соцмережі',
      'interest.delete':'Видалено заявку','interest.dispatch':'Запущено надсилання'};
    return [note(data.sales ? 'LIVE · Приймаємо заявки без списання коштів.' : 'COMING SOON · Продажі вимкнено.'),
      ...(signups ? [h('dl',{className:'ops-metrics'},
        h('div',{},h('dt',{},'Підписники новин'),h('dd',{},signups.subscribers)),
        h('div',{},h('dt',{},'Запити на сповіщення'),h('dd',{},signups.requests)),
        h('div',{},h('dt',{},'Товари'),h('dd',{},data.products))),
        card(heading('Попит за дизайнами'),...(signups.designs.length ? signups.designs.map(row=>h('p',{className:'ops-data-row'},row.name,h('strong',{},row.count))) : [note('Підтверджених заявок поки немає.')])),
        card(heading('Останні події'),...(signups.activity.length ? signups.activity.map(row=>h('p',{className:'ops-data-row'},eventNames[row.action],h('time',{},ds(row.created_at)))) : [note('Подій поки немає.')]))] : []),
      note(data.telegramReady ? 'Telegram підключено.' : 'Telegram очікує налаштування.'),
      card(heading('Замовлення'),...(data.counts.length ? data.counts.map(row=>h('p',{},`${orderStatus[row.status]} · ${row.count}`)) : [note('Ще немає замовлень.')]))];
  }
  function subscribers(data) {
    const consent = [['all','Усі'],['active','Згода є'],['withdrawn','Згоду відкликано'],['legacy','Згода не зафіксована']];
    const scopes = [['all','Усі'],['newsletter','Новини SLX'],['product','Сповіщення про товар']];
    const filters = form([field('Пошук за email','q',subscriberFilters.q,{type:'search',maxLength:180}),
      choose('Тип','scope',scopes,subscriberFilters.scope),choose('Згода','consent',consent,subscriberFilters.consent)],
      h('button',{type:'submit',className:'primary'},'Фільтрувати'),values=>{subscriberFilters=values;},{feedback:''});
    const results = data.subscribers.map(row=>{
      const canDelete = preview || mode==='live';
      const permission = row.status==='unsubscribed' ? consent[2][1] : row.consent_at ? consent[1][1] : consent[3][1];
      const deletion = h('details',{className:'ops-delete'},h('summary',{},'Видалити…'),
        note('Заявку і запис згоди буде видалено.'),action('Підтвердити видалення',async()=>{
          await post('admin-subscriber-delete',{id:row.id});
          if (data.subscribers.length===1 && data.page>1) subscriberFilters.page=data.page-1;
          await render();
        }));
      return h('li',{className:'ops-subscriber'},h('div',{},h('strong',{},row.email),note(row.product==='newsletter'?'Новини SLX':row.product)),
        h('div',{},h('time',{},ds(row.created_at)),note(permission)),canDelete ? deletion : null);
    });
    const go = page=>{subscriberFilters={...subscriberFilters,page};return render();};
    return [filters,h('a',{className:'secondary',href:endpoint('admin-subscribers-csv',{...subscriberFilters,mode}),download:'slx-subscribers.csv'},'Експортувати CSV'),
      results.length ? h('ul',{className:'ops-subscriber-list'},results) : note('Записів за цими фільтрами немає.'),
      h('div',{className:'ops-data-row'},data.page>1 ? action('Попередня',()=>go(data.page-1)) : null,
        note(`Сторінка ${data.page}`),data.more ? action('Наступна',()=>go(data.page+1)) : null)];
  }
  function social(data) {
    const fields=Object.entries(data.social).map(([name,url])=>field(name,name,url,{type:'url',maxLength:280}));
    return [note('Введіть HTTPS-посилання на офіційні профілі. Порожнє поле приховує посилання.'),
      preview || mode==='live' ? form(fields,summary(),values=>post('admin-social',values))
        : card(...Object.entries(data.social).map(([name,url])=>h('p',{},`${name} · ${url || '—'}`)))];
  }
  function system(data) {
    return [card(heading('Стан сервісів'),
      ...[['База даних',`${data.database==='connected'?'Підключено':'Недоступна'} · ${data.latencyMs} мс`],
        ['Середовище',data.environment],['Віджет Spreadshop',data.spreadshop?'Увімкнено':'Вимкнено'],
        ['Аналітика',data.analytics?'Увімкнено':'Вимкнено'],['Тестова форма',data.previewSignup?'Увімкнено':'Вимкнено']]
        .map(([label,value])=>h('p',{className:'ops-data-row'},label,h('strong',{},value))),action('Перевірити з’єднання',render))];
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
    if (mode==='test') return [note('Тут можна перевірити розрахунок. Для збереження відкрийте робочий режим.'),
      ...data.products.map(item=>card(heading(item.name),pricing(item,data)))];
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
        pricing(item,data),
        data.canNotify && item.status==='available' ? action('Надіслати сповіщення',async()=>{
          if (!confirm(`Надіслати сповіщення про наявність ${item.name}?`)) return;
          const result = await post('admin-notify',{id:item.id});
          message.textContent = `Надіслано: ${result.sent}. Помилки: ${result.failed}. За потреби повторіть для наступної групи.`;
        }) : null))];
  }
  function pricing(item,data) {
    const values=item.pricing ?? {};
    const result=h('div',{className:'ops-results'});
    const inputs=[
      ['Собівартість виробу','garment'],['Друк','printing'],['Пакування та фулфілмент','fulfillment'],
      ['Додаткові витрати','other'],['Роздрібна ціна','retail'],['Передоплата','advance'],
    ];
    const show=calculation=>{
      const rows=[['Податки',calculation.taxes],['Платіжні комісії',calculation.fees],
        ['Contributor',calculation.contributor],['Залишок при отриманні',calculation.remainder],
        ['Прибуток',calculation.profit],['У резерв',calculation.reserve],['У Relocation Fund',calculation.relocation]];
      result.replaceChildren(
        h('dl',{className:'finance-grid'},rows.map(([label,amount])=>h('div',{},h('dt',{},label),h('dd',{},money(amount))))),
        note(`Маржа: ${(calculation.marginBps/100).toFixed(2)}%`),
        heading('Прогноз на місяць'),
        ...calculation.projections.map(row=>h('p',{},`${row.units} продажів · прибуток ${money(row.profit)} · резерв ${money(row.reserve)} · фонд ${money(row.relocation)}`)));
    };
    const run=async (fields,preview)=>{
      const {manufacturerId,commissionKind,...numbers}=fields;
      const result=await post('admin-pricing',{id:item.id,manufacturerId,preview,
        values:{commissionKind,...Object.fromEntries(Object.entries(numbers).map(([key,value])=>[key,toMinor(value) ?? 0]))}});
      show(result);
    };
    const calculator=form([
      choose('Виробник','manufacturerId',[['','Оберіть виробника'],...data.manufacturers.map(partner=>[partner.id,partner.name])],item.manufacturerId ?? ''),
      ...inputs.map(([label,key])=>field(label+', грн',key,fromMinor(values[key]),{...numeric,required:key==='retail'||key==='advance'})),
      field('Податки, %','taxBps',fromMinor(values.taxBps),percent),
      field('Платіжні комісії, %','feeBps',fromMinor(values.feeBps),percent),
      choose('Тип Contributor','commissionKind',[['percent','Відсоток'],['fixed','Фіксована сума']],values.commissionKind ?? 'percent'),
      field('Винагорода, % або грн','commissionValue',fromMinor(values.commissionValue),numeric),
    ],h('button',{type:'submit',className:'primary'},mode==='test'?'Розрахувати':'Зберегти розрахунок'),
    fields=>run(fields,mode==='test'),{refresh:false,feedback:mode==='test'?'Розраховано.':'Збережено.'});
    return h('details',{className:'ops-card'},h('summary',{},'Калькулятор ціни'),
      note(`Відрахування у резерв: ${data.reserveBps/100}%. Розрахунок зберігається окремо від ціни у вітрині.`),
      calculator,mode==='live' ? action('Розрахувати без збереження',()=>calculator.reportValidity()&&run(formValues(calculator),true)) : null,result);
  }
  function partners(data) {
    const fields=[['Контакти','contact',500],['Асортимент','assortment',1500],['Партнерський прайс','priceList',2000],
      ['Умови оплати','payment',1000],['Умови повернення','returns',1000],['Строки виготовлення','leadTime',160]];
    const editor=partner=>{
      const id=partner.id ?? crypto.randomUUID();
      return form([field('Назва','name',partner.name,{required:true,maxLength:120}),
        ...fields.map(([label,key,maxLength])=>h('label',{},label,h('textarea',{name:key,value:partner[key] ?? '',maxLength}))),
        field('Пакування, грн','packaging',fromMinor(partner.packaging),numeric),
        checkbox('Пряма відправка покупцю','directShipping',Boolean(partner.directShipping))],summary(),values=>post('admin-manufacturer',{
        ...values,id,packaging:toMinor(values.packaging),directShipping:values.directShipping==='on',
      }));
    };
    if (mode==='test') return [note('Виробники спільні для каталогу. Для змін відкрийте робочий режим.'),
      ...data.manufacturers.map(partner=>card(heading(partner.name),note(partner.leadTime)))];
    return [h('details',{className:'ops-card'},h('summary',{},'Додати виробника'),editor({})),
      ...data.manufacturers.map(partner=>h('details',{className:'ops-card'},h('summary',{},partner.name),editor(partner)))];
  }
  function collections(data) {
    return [note('Статус колекції в панелі фіксує готовність. Продажі керуються окремим чеклістом запуску.'),
      ...data.collections.map(item=>card(heading(item.name),note(`Дизайнів: ${item.count} · ${item.release==='live'?'Live':'Coming Soon'}`),
        preview || mode==='live' ? form([field('Назва','name',item.name,{maxLength:100,required:true}),
          h('label',{},'Опис для сторінки колекції',h('textarea',{name:'description',value:item.description,maxLength:1000})),
          choose('Статус колекції','release',[['coming-soon','Coming Soon'],['live','Live']],item.release),
          field('Внутрішня примітка','notes',item.notes,{maxLength:1000}),
          ...item.designs.map(design=>checkbox(`Показувати ${design.name}`,design.id,!item.hidden.includes(design.id)))],
        summary(),({name,description,release,notes,...visible})=>post('admin-collection',{id:item.id,name,description,release,notes,
          hidden:item.designs.filter(design=>visible[design.id]!=='on').map(design=>design.id)})) : note(item.notes || 'Приміток немає.')))];
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
    const manufacturers=new Map(data.manufacturers.map(({id,name})=>[id,name]));
    if (!manufacturing && mode==='test' && data.products?.length) output.push(testOrder(data.products));
    const rows = manufacturing ? data.orders.filter(order=>['paid','sent_to_manufacturer','in_production','preparing_shipment','shipped','defective'].includes(order.status)) : data.orders;
    if (!rows.length) output.push(note('Замовлень у цьому режимі ще немає.'));
    for (const order of rows) {
      const terminal=['cancelled','returned'].includes(order.status);
      const canEditCosts=!manufacturing && order.financials && !order.closed_at && !terminal;
      const canRecordRefund=!manufacturing && order.financials && order.paid_at && !terminal
        && order.allowed.some(status=>['returned','cancelled'].includes(status));
      const fields = [
        choose('Статус','status',order.allowed.map(status=>[status,orderStatus[status]]),order.status),
        field('Технологія друку','technology',order.manufacturing.technology,{maxLength:80}),
        field('ТТН','tracking',order.manufacturing.tracking,{maxLength:64}),
        h('label',{},'Коментар виробнику',h('textarea',{name:'notes',value:order.manufacturing.notes ?? '',maxLength:600})),
      ];
      if (canEditCosts) fields.push(...Object.entries(cost).map(([key,name])=>field(`${name}, грн`,key,fromMinor(order.financials[key]),numeric)));
      if (!manufacturing && !terminal) fields.push(field('Причина скасування чи повернення','reason',order.resolution?.reason,{maxLength:500}));
      if (canRecordRefund) fields.push(field('Фактичне повернення коштів, грн','refund','',numeric));
      if (mode==='live' && !manufacturing && order.financials && order.status==='awaiting_payment' && order.allowed.includes('paid')) {
        fields.push(field('Отримана передоплата, грн','advanceReceived','',numeric),
          field('Номер підтвердження операції','advanceReference','',{maxLength:120}));
      }
      if (mode==='live' && !manufacturing && order.financials && order.status==='delivered') {
        fields.push(field('Отриманий залишок, грн','balanceReceived','',numeric));
      }
      output.push(h('details',{className:'ops-card'},
        h('summary',{},`${brief(order.id)} · ${orderStatus[order.status]} · ${ds(order.created_at)}`),
        h('ul',{},order.items.map(item=>h('li',{},[item.name,item.size,item.color,`×${item.quantity}`,manufacturers.get(item.manufacturerId)].filter(Boolean).join(' · ')))),
        mode==='live' ? note([order.delivery.name,order.delivery.phone,order.delivery.contact,order.delivery.city,order.delivery.point].filter(Boolean).join(' · ')) : null,
        mode==='live' && order.delivery.comment ? note(order.delivery.comment) : null,
        order.referral_code ? note(`SLX Circle: ${order.referral_code}`) : null,
        order.advance!=null ? note(`Передоплата: ${money(order.advance)} · залишок: ${money(Number(order.subtotal)-Number(order.advance))}`) : null,
        order.resolution?.advanceReceived!=null ? note(`Отримано передоплату: ${money(order.resolution.advanceReceived)}`) : null,
        order.resolution?.balanceReceived!=null ? note(`Отримано залишок: ${money(order.resolution.balanceReceived)}`) : null,
        order.resolution?.refund!=null ? note(`Зафіксовано повернення: ${money(order.resolution.refund)}`) : null,
        form(fields,summary(),values=>post('admin-order',{
          id:order.id,expectedStatus:order.status,status:values.status,
          technology:values.technology,tracking:values.tracking,notes:values.notes,
          reason:values.reason,...(canRecordRefund ? {refund:toMinor(values.refund)} : {}),
          advanceReceived:toMinor(values.advanceReceived ?? ''),advanceReference:values.advanceReference,
          balanceReceived:toMinor(values.balanceReceived ?? ''),
          ...(canEditCosts ? {costs:Object.fromEntries(Object.keys(cost).map(key=>[key,toMinor(values[key])]))} : {}),
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
      const data=await read('admin-finance',range);
      if (data.provider==='spreadshop') {
        result.replaceChildren(spreadshopFinance(data,()=>refresh(range)));
        return;
      }
      const fund=await read('admin-funds');
      result.replaceChildren(balanceCard(fund,()=>refresh(range)),card(heading('Звіт за період'),
        h('dl',{className:'finance-grid'},Object.entries(labels).map(([key,label])=>h('div',{},h('dt',{},label),h('dd',{},money(data.totals[key]))))),
        h('a',{className:'secondary',href:endpoint('admin-finance-csv',{mode,...range})},'Завантажити CSV')));
    }
    refresh({from,to}).catch(unauthorized);
    return [form([field('Від','from',from,{type:'date',required:true}),field('До','to',to,{type:'date',required:true})],
      h('button',{type:'submit',className:'primary'},'Застосувати'),refresh,{refresh:false}),result];
  }
  function spreadshopFinance(data,refresh) {
    const labels={credit:'Нарахована маржа',adjustment:'Коригування',payout:'Отримана виплата',expense:'Сплачені витрати SLX'};
    const allocationLabels={net:'Отриманий прибуток після витрат',relocation:'Переїзд · 50%',development:'Розвиток SLX · 30%',reserve:'Резерв · 20%'};
    const format=(amount,currency)=>new Intl.NumberFormat('uk-UA',{style:'currency',currency}).format(Number(amount)/100);
    const currencies=data.byCurrency.map(({currency})=>[currency,currency]);
    const metrics=(values,names,currency)=>h('dl',{className:'finance-grid'},Object.entries(names).map(([key,label])=>
      h('div',{},h('dt',{},label),h('dd',{},format(values[key],currency)))));
    return card(heading('Фінанси Spreadshop'),
      note('Записуйте отримані виплати за банківськими виписками, а витрати — за документами SLX. Розподіл розраховується окремо для кожної валюти станом на кінець періоду.'),
      ...data.byCurrency.map(row=>h('section',{className:'ops-card'},heading(row.currency),
        metrics(row,{...labels,earned:'Маржа після коригувань',receivedNet:'Отримано після витрат за період'},row.currency),
        h('h3',{},'Накопичувальний розподіл'),
        metrics(row.allocation,allocationLabels,row.currency))),
      h('details',{},h('summary',{},'Додати запис'),form([
        choose('Тип','kind',Object.entries(labels),'credit'),
        choose('Валюта','currency',currencies,'GBP'),
        field('Дата звіту','day',data.to,{type:'date',required:true}),
        field('Номер документа','reference','',{required:true,maxLength:80}),
        field('Сума','amount','',{type:'number',step:.01,required:true}),
      ],summary(),async values=>{
        await post('admin-spreadshop-entry',{...values,amount:toMinor(values.amount)});
        await refresh();
      },{refresh:false})),
      heading('Записи за період'),
      data.entries.length ? h('ul',{className:'ops-timeline'},data.entries.map(entry=>h('li',{},
        `${entry.day} · ${labels[entry.kind]} · ${entry.reference} · ${format(entry.amount,entry.currency)}`))) : note('Записів за цей період немає.'),
      h('a',{className:'secondary',href:endpoint('admin-finance-csv',{mode,from:data.from,to:data.to})},'Завантажити CSV'));
  }
  function balanceCard(fund,refresh) {
    const pockets=[['available','Вільний залишок'],['reserve','Резерв'],['fund','Relocation Fund']];
    const metrics=[['balance','Загальний баланс SLX'],...pockets];
    const entryLabels={completion:'Завершення замовлення',refund:'Повернення',transfer:'Внутрішній переказ'};
    let intent;
    const transfer=me.role==='owner' ? h('details',{},h('summary',{},'Перемістити між розділами'),form([
      choose('Звідки','from',pockets,'available'),choose('Куди','to',pockets,'reserve'),
      field('Сума, грн','amount','',{...numeric,required:true}),field('Примітка','note','',{required:true,maxLength:240}),
    ],summary(),async values=>{
      const fingerprint=JSON.stringify(values);
      if(intent?.fingerprint!==fingerprint) intent={fingerprint,id:crypto.randomUUID()};
      await post('admin-funds-transfer',{...values,amount:toMinor(values.amount),requestId:intent.id});
      intent=undefined;
      await refresh();
    },{refresh:false})) : null;
    return card(heading('Спільні кошти SLX'),
      h('dl',{className:'finance-grid'},metrics.map(([key,label])=>h('div',{},h('dt',{},label),h('dd',{},money(fund[key]))))),
      note(`Відрахування у резерв: ${fund.reserveBps/100}%`),
      fund.goal>0 ? h('label',{},`Ціль Relocation Fund: ${money(fund.fund)} з ${money(fund.goal)}`,
        h('progress',{value:Math.min(fund.fund,fund.goal),max:fund.goal})) : note('Ціль Relocation Fund ще не задана.'),
      transfer,heading('Журнал балансу'),
      fund.history.length ? h('ul',{className:'ops-timeline'},fund.history.map(row=>h('li',{},
        `${ds(row.created_at)} · ${entryLabels[row.kind]}${row.order_id ? ' · '+brief(row.order_id) : ''} · баланс ${money(row.balance_delta)} · резерв ${money(row.reserve_delta)} · фонд ${money(row.fund_delta)}${row.actor_email ? ' · '+row.actor_email : ''}${row.note ? ' · '+row.note : ''}`))) : note('Операцій ще немає.'));
  }
  function circles(data) {
    const edit = (item={},editing=false) => form([
      field('Код','code',item.code,{required:true,readOnly:editing,maxLength:24}),
      field('Назва партнера','label',item.label,{required:true,maxLength:100}),
      choose('Тип винагороди','kind',[['percent','Відсоток'],['fixed','Фіксована сума']],item.fixed_amount==null?'percent':'fixed'),
      field('Винагорода, % або грн','amount',fromMinor(item.fixed_amount ?? item.bps ?? data.bps),{...numeric,required:true}),
      checkbox('Активний','active',item.active!==false),
    ],summary(),values=>post('admin-referral',{
      edit:editing,code:values.code,label:values.label,
      ...(values.kind==='fixed' ? {fixed:toMinor(values.amount),bps:0} : {fixed:null,bps:toMinor(values.amount)}),
      active:values.active==='on',
    }));
    return [card(heading('Новий код'),edit()),...data.codes.map(item=>card(edit(item,true))),card(heading('Історія нарахувань'),
      ...(data.history.length ? data.history.map(entry=>h('p',{},`${ds(entry.created_at)} · ${entry.referral_code} · ${brief(entry.order_id)} · ${entry.kind==='reversal'?'Сторно':'Нарахування'} ${money(entry.amount)}`))
        : [note('Нарахувань ще немає.')]))];
  }
  function configuration(data) {
    const output = [note(data.envAllowsSales ? 'Робочий режим дозволено конфігурацією Vercel.' : 'У Vercel робочі замовлення ще не дозволені.')];
    if (mode !== 'live') return [...output,note('Для зміни налаштувань перейдіть у робочий режим.')];
    const checklist={prices_ready:'Підтверджено роздрібні ціни',sample_ready:'Перевірено якість тестового виробу',
      terms_ready:'Підтверджено умови доставки й повернення',seller_ready:'Перевірено дані продавця',
      payment_ready:'Підтверджено оформлення прийому платежів',manufacturer_ready:'Підтверджено готовність виробництва'};
    const completed=data.launchChecks.filter(key=>data.config[key]===true).length;
    output.push(card(heading('Чекліст запуску'),note(`Підтверджено ${completed} з ${data.launchChecks.length}`),form([
      checkbox('Приймати неоплачені запити','sales',data.config.sales),
      ...data.launchChecks.map(key=>checkbox(checklist[key],key,Boolean(data.config[key]))),
      field('Відрахування у резерв, %','reserve_bps',(data.config.reserve_bps ?? 0)/100,{...percent,required:true}),
      field('Ціль Relocation Fund, грн','fund_goal',fromMinor(data.config.fund_goal),numeric),
      field('Комісія SLX Circle за замовчуванням, %','referral_bps',data.config.referral_bps/100,{...percent,required:true}),
    ],summary(),values=>post('admin-settings',{
      sales:values.sales==='on',...Object.fromEntries(data.launchChecks.map(key=>[key,values[key]==='on'])),
      reserve_bps:toMinor(values.reserve_bps),fund_goal:toMinor(values.fund_goal),referral_bps:toMinor(values.referral_bps),
    }))));
    output.push(card(heading('Доступ команди'),...data.staff.map(staff=>staff.role==='owner' ? note(`${staff.email} · ${roles[staff.role]}`)
      : form([note(staff.email),choose('Роль','role',Object.entries(roles).filter(([key])=>key!=='owner'),staff.role),checkbox('Активний','active',staff.active)],
        summary(),values=>post('admin-staff',{id:staff.id,role:values.role,active:values.active==='on'})))));
    return output;
  }
  const views = {dashboard,subscribers,social,system,products,collections,orders,customers,manufacturing:data=>orders(data,true),partners,finance,referrals:circles,settings:configuration};
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
      let summaryData;
      if (!me) {
        summaryData = await read('admin-summary');
        me = summaryData.user;
        preview = summaryData.preview;
        navigation();
      }
      const data = tab==='finance' ? null : tab==='dashboard' && summaryData ? summaryData
        : await read(tabs[tab][1],tab==='subscribers' ? subscriberFilters : undefined);
      if (version===loadNumber) panel.replaceChildren(heading(tabs[tab][0]),...views[tab](data));
    } catch (error) { if (version===loadNumber) { panel.replaceChildren(); unauthorized(error); } }
  }
  document.querySelector('[data-admin-logout]').addEventListener('click',async()=>{
    try { await api('logout',{body:{}}); location.reload(); } catch (error) { unauthorized(error); }
  });
  render();
})();
