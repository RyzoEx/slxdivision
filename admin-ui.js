(() => {
  const {api,endpoint,element:h,money,orderStatus,productStatus} = window.slx;
  const {icon,iconButton,badge,empty,table,modal,menu,chart}=window.slxConsole;
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
  const topbar = document.querySelector('#admin-topbar');
  const mobileNav = document.querySelector('#admin-mobile-nav');
  const consoleLayout = document.querySelector('#admin-dashboard');
  const message = document.querySelector('#admin-message');
  const dt = new Intl.DateTimeFormat('uk-UA',{dateStyle:'short',timeStyle:'short',timeZone:'Europe/Kyiv'});
  const ymd = new Intl.DateTimeFormat('sv-SE',{year:'numeric',month:'2-digit',day:'2-digit',timeZone:'Europe/Kyiv'});
  const cost = {
    garment:'Одяг',printing:'Друк',fulfillment:'Фулфілмент',other:'Додаткові витрати',
    shipping:'Доставка',payment_fee:'Платіжна комісія',return_reserve:'Витрати на повернення',tax:'Податки',
  };
  const roles = {owner:'Власник',manager:'Менеджер',operator:'Оператор',editor:'Редактор',analyst:'Аналітик'};
  const tabs = {
    dashboard:['Огляд','admin-summary'],analytics:['Аналітика','admin-summary'],subscribers:['Підписники','admin-subscribers'],collections:['Колекції','admin-content'],
    designs:['Дизайни','admin-content'],website:['Вебсайт','admin-content'],media:['Медіатека','admin-media'],email:['Листи','admin-email'],
    social:['Соцмережі','admin-social'],system:['Система','admin-system'],products:['Товари','admin-products'],
    orders:['Замовлення','admin-orders'],customers:['Клієнти','admin-customers'],manufacturing:['Виробництво','admin-manufacturing'],
    partners:['Виробники','admin-manufacturers'],finance:['Фінанси','admin-finance'],
    referrals:['SLX Circle','admin-referrals'],settings:['Налаштування','admin-settings'],
  };
  const navigationGroups=[['Загальне',{dashboard:'layout-dashboard',analytics:'chart-no-axes-combined'}],
    ['Комерція',{orders:'shopping-bag',products:'package',customers:'users',finance:'wallet'}],
    ['Контент',{collections:'layers',designs:'shirt',media:'images',website:'globe'}],
    ['Маркетинг',{subscribers:'bell',email:'mail',social:'share-2',referrals:'circle-dashed'}],
    ['Операції',{manufacturing:'factory',partners:'truck'}],['Адміністрування',{system:'activity',settings:'settings'}]];
  const closedGroups=new Set();
  const labels={local:'TEST',preview:'PREVIEW',production:'PRODUCTION'};
  const compactKey='slx-console-compact';
  let compact=false;
  try { compact=localStorage.getItem(compactKey)==='1'; } catch {}
  let environment='local';
  let backendState='loading';
  let me;
  let tab = 'dashboard';
  let mode = 'test';
  let preview = false;
  let subscriberAccess = false;
  let subscriberFilters = {};
  let loadNumber = 0;
  const unauthorized = error => {
    if (error.status===401) location.reload();
    else { message.dataset.tone='error';message.textContent=error.message; }
  };
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
  function confirmDelete() {
    return new Promise(resolve=>{
      const dismiss=h('button',{className:'secondary',value:'cancel',autofocus:true},'Скасувати');
      const accept=h('button',{className:'secondary',value:'delete'},'Підтвердити видалення');
      const title=heading('Видалити заявку?'); title.id='subscriber-delete-title';
      const modal=h('dialog',{className:'ops-confirm',ariaLabelledBy:title.id},title,note('Заявку і запис згоди буде видалено.'),
        h('form',{method:'dialog'},dismiss,accept));
      modal.addEventListener('close',()=>{resolve(modal.returnValue==='delete');modal.remove();},{once:true});
      document.body.append(modal);modal.showModal();
    });
  }
  function form(fields, submit, run, {refresh=true,feedback='Збережено.'} = {}) {
    const node = h('form',{className:'ops-form'},fields,submit);
    node.addEventListener('submit',async event=>{
      event.preventDefault();
      submit.disabled = true;
      message.textContent = '';
      try {
        await run(formValues(node),node);
        message.dataset.tone='success';message.textContent = feedback;
        if (refresh) { node.closest('.console-modal')?.close();await render(); }
      } catch(error) { unauthorized(error); }
      finally { submit.disabled = false; }
    });
    return node;
  }
  function dashboard(data) {
    const signups = data.signups;
    const eventNames = {'admin.login':'Вхід до панелі','collection.update':'Оновлено колекцію','social.update':'Оновлено соцмережі','editorial.save':'Збережено чернетку',
      'interest.delete':'Видалено заявку','interest.dispatch':'Запущено надсилання','mail.simulated':'Перевірено шаблон'};
    const revenue=h('dd',{},'—');
    const staffCanFinance=['owner','manager'].includes(me.role);
    const scope=mode==='test'?'Тестовий режим':'Робочий режим';
    const moneyNote=h('small',{},staffCanFinance?'Поточний місяць · '+scope:'Немає доступу до фінансів');
    const orderCount=data.counts.reduce((total,row)=>total+row.count,0);
    const metrics=[['Дохід',revenue,'wallet',moneyNote],['Замовлення',orderCount,'shopping-bag',scope],
      ['Підписники',signups?.subscribers,'users','Новини SLX'],['Запити на сповіщення',signups?.requests,'bell','Активні заявки'],
      ['Активні товари',data.products,'package','Видимий каталог SLX'],['Відкликані згоди',signups?.withdrawn,'shield-check','Збережені записи']];
    const kpis=h('dl',{className:'console-kpis'},metrics.map(([title,value,glyph,detail])=>h('div',{},icon(glyph),h('dt',{},title),
      value instanceof Node ? value : h('dd',{},value??'—'),detail instanceof Node ? detail : h('small',{},value==null?'Немає доступних даних':detail))));
    if (staffCanFinance) {
      const now=ymd.format(new Date());
      read('admin-finance',{from:now.slice(0,8)+'01',to:now}).then(result=>{
        if (typeof result.totals?.revenue==='number') revenue.textContent=money(result.totals.revenue);
        else moneyNote.textContent='Партнерський звіт обліковує маржу.';
      }).catch(()=>{moneyNote.textContent='Фінансовий звіт недоступний.';});
    }
    const recent=h('div',{},empty('Ще немає замовлень','Нові замовлення з’являться після їх реєстрації.','shopping-bag'));
    if (orderCount>0 && ['owner','manager','operator'].includes(me.role)) read('admin-orders').then(({orders})=>{
      recent.replaceChildren(h('div',{className:'console-section-list'},orders.slice(0,4).map(row=>h('p',{className:'ops-data-row'},
        `${brief(row.id)} · ${orderStatus[row.status]}`,h('time',{},ds(row.created_at))))));
    }).catch(()=>recent.replaceChildren(empty('Замовлення недоступні')));
    const services=h('div',{},note('Перевіряємо стан…'));
    if (allowedTabs().includes('system')) read('admin-system').then(service=>{
      services.replaceChildren(h('div',{className:'console-section-list'},readiness(service,data.sales).map(([title,value,tone])=>
        h('p',{className:'ops-data-row'},title,badge(value,tone)))));
    }).catch(()=>services.replaceChildren(empty('Інфраструктура недоступна')));
    else services.replaceChildren(empty('Перевірка доступна адміністратору'));
    const demand=card(heading('Попит за дизайнами'),signups?.designs.length ? h('div',{className:'console-section-list'},
      signups.designs.map(row=>h('p',{className:'ops-data-row'},row.name,h('strong',{},row.count)))) : empty('Підтверджених заявок поки немає'));
    return [h('div',{className:'console-overview-head'},h('div',{},badge(data.sales?'LIVE':'COMING SOON',data.sales?'good':'warn'),
      h('p',{},`${data.currentCollection?.name??'Heavy DAngels'} — DROP 001`)),
      h('a',{className:'secondary',href:'/',target:'_blank',rel:'noopener'},'Відкрити сайт',icon('arrow-up-right'))),kpis,
      h('div',{className:'console-overview-grid'},card(heading('Заявки за 14 днів · UTC'),signups ? chart(signups.daily) : empty('Статистика недоступна')),demand),
      h('div',{className:'console-overview-grid'},card(heading('Останні замовлення'),recent),card(heading('Готовність до запуску'),services)),
      card(heading('Останні події'),signups?.activity.length ? h('div',{className:'console-section-list'},signups.activity.map(row=>h('p',{className:'ops-data-row'},
        eventNames[row.action]??row.action,h('time',{},ds(row.created_at))))) : empty('Подій поки немає'))];
  }
  function analytics(data) {
    return [card(heading('Запити за 14 днів · UTC'),data.signups ? chart(data.signups.daily) : empty('Статистика недоступна',
      'Виберіть робочі дані, якщо цей режим доступний.')),
    data.signups ? card(heading('Попит за дизайнами'),data.signups.designs.length ? table(['Дизайн','Запити'],
      data.signups.designs.map(row=>[row.name,row.count]),'Попит за дизайнами') : empty('Підтверджених заявок поки немає')) : null];
  }
  function subscribers(data) {
    const consent = [['all','Усі'],['active','Згода є'],['withdrawn','Згоду відкликано'],['legacy','Згода не зафіксована']];
    const scopes = [['all','Усі'],['newsletter','Новини SLX'],['product','Сповіщення про товар']];
    const filters = form([field('Пошук за email','q',subscriberFilters.q,{type:'search',maxLength:180}),
      choose('Тип','scope',scopes,subscriberFilters.scope),choose('Згода','consent',consent,subscriberFilters.consent),
      field('З дати · UTC','from',subscriberFilters.from,{type:'date'}),field('До дати · UTC','to',subscriberFilters.to,{type:'date'}),
      choose('Дизайн','design',[['','Усі'],...data.designs.map(item=>[item.id,item.name])],subscriberFilters.design),
      choose('Сортування','sort',[['newest','Спочатку нові'],['oldest','Спочатку давні']],subscriberFilters.sort)],
      h('button',{type:'submit',className:'primary'},'Фільтрувати'),values=>{subscriberFilters=values;},{feedback:''});
    filters.classList.add('console-filters');
    const names=new Map(data.designs.map(item=>[item.id,item.name]));
    const results = data.subscribers.map(row=>{
      const canDelete = preview || mode==='live';
      const permission = row.status==='unsubscribed' ? consent[2][1] : row.consent_at ? consent[1][1] : consent[3][1];
      const options=[];
      options.push(h('button',{type:'button',className:'console-nav-link',onclick:()=>modal('Історія згоди',h('div',{className:'console-section-list'},h('strong',{},row.email),
        note(row.consent_at ? `${ds(row.consent_at)} · версія ${row.consent_version}` : 'Первинну згоду не зафіксовано.'),
        row.marketing_at ? note(`Маркетинг · ${ds(row.marketing_at)}`) : null,
        row.withdrawn_at ? note(`Відкликано · ${ds(row.withdrawn_at)}`) : null),true)},'Історія згоди'));
      if (canDelete) options.push(action('Видалити…',async()=>{
          if (!(await confirmDelete())) return;
          await post('admin-subscriber-delete',{id:row.id});
          if (data.subscribers.length===1 && data.page>1) subscriberFilters.page=data.page-1;
          await render();
          message.dataset.tone='success';message.textContent='Заявку видалено.';
        }));
      const newsletter=row.product==='newsletter';
      return [h('strong',{},row.email),newsletter?'Новини SLX':'Сповіщення про товар',newsletter?'—':names.get(row.product)??row.product,
        badge(permission,row.status==='unsubscribed'?'warn':row.consent_at?'good':'neutral'),row.marketing_at ? 'Зафіксовано' : '—',
        h('time',{dateTime:row.created_at},ds(row.created_at)),menu('Дії підписника',options)];
    });
    const go = page=>{subscriberFilters={...subscriberFilters,page};return render();};
    return [h('div',{className:'console-toolbar'},note('Заявки на новини та окремі дизайни'),
      h('a',{className:'secondary',href:endpoint('admin-subscribers-csv',{...subscriberFilters,mode}),download:'slx-subscribers.csv'},icon('file-down'),'Експортувати CSV')),
      filters,results.length ? table(['Email','Тип підписки','Дизайн','Статус згоди','Маркетинг','Дата реєстрації','Дії'],results,'Підписники SLX')
        : card(empty('Записів за цими фільтрами немає.',null,'users')),
      h('div',{className:'console-toolbar'},note(`Сторінка ${data.page}`),h('div',{className:'console-tab-row'},data.page>1 ? action('Попередня',()=>go(data.page-1)) : null,
        data.more ? action('Наступна',()=>go(data.page+1)) : null))];
  }
  function social(data) {
    const fields=Object.entries(data.social).map(([name,url])=>field(name,name,url,{type:'url',maxLength:280}));
    return [card(heading('Офіційні посилання'),note('Порожнє поле приховує посилання у вітрині.'),
      preview || mode==='live' ? form(fields,summary(),values=>post('admin-social',values))
        : h('div',{className:'console-section-list'},Object.entries(data.social).map(([name,url])=>h('p',{className:'ops-data-row'},name,url||'—'))))];
  }
  function readiness(data,sales=false) {
    return [['PostgreSQL',data.database==='connected'?(data.environment==='local'?'Локальна база':'Підключено'):'Недоступно',data.database==='connected'?'good':'error'],
      ['Пошта',data.email==='configured'?(data.mailApproved?'Налаштовано':'Очікує погодження'):'Не налаштовано',data.mailApproved?'good':'neutral'],
      ['Spreadshop',data.spreadshop?'Увімкнено':'Вимкнено',data.spreadshop?'good':'neutral'],
      ['GA4',data.analytics?'Увімкнено':'Вимкнено',data.analytics?'good':'neutral'],
      ['Notify Me',data.previewSignup?'Тестова форма':data.productionSignup?'API налаштовано':'Вимкнено',data.previewSignup?'warn':'neutral'],
      ['Продажі',sales?'Увімкнено':'Вимкнено',sales?'good':'neutral']];
  }
  function system(data) {
    const services=[...readiness(data).slice(0,4),['Backend API',data.backend==='ok'?'Працює':'Недоступно',data.backend==='ok'?'good':'error'],
      ['Storage',data.storageReady?'Доступно':'Не налаштовано',data.storageReady?'good':'neutral'],
      ['Vercel Deployment',data.commit?labels[data.environment]:'Локальна збірка',data.commit?'good':'neutral']];
    const glyphs=['database','mail','shopping-bag','chart-no-axes-combined','activity','images','globe'];
    return [h('div',{className:'console-toolbar'},note(`Перевірено ${ds(data.checkedAt)}`),action('Перевірити з’єднання',render)),
      h('div',{className:'console-service-grid'},services.map(([label,value,tone],i)=>card(h('strong',{className:'console-service-title'},icon(glyphs[i]),label),
        badge(value,tone),i===0 ? note(`Час запиту · ${data.latencyMs} мс`) : null))),
      card(heading('Збірка'),h('p',{className:'ops-data-row'},'Версія',data.version),h('p',{className:'ops-data-row'},'Коміт',data.commit??'—'),
        h('p',{className:'ops-data-row'},'Середовище',labels[data.environment]??'TEST'))];
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
    const entries=new Map((data.editorial?.product??[]).map(item=>[item.id,item]));
    const collections=new Map((data.editorial?.collection??[]).map(item=>[item.id,item.name]));
    const rows=data.products.map(item=>{
      const draft=entries.get(item.id);
      const source=item.photo ? endpoint('media',{key:item.photo}) : item.src;
      const editor=()=>h('div',{className:'ops-results'},mode==='test'?note('Тестовий розрахунок. Збереження доступне в робочому режимі.'):form([
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
        mode==='live' && data.canNotify && item.status==='available' ? action('Надіслати сповіщення',async()=>{
          if (!confirm(`Надіслати сповіщення про наявність ${item.name}?`)) return;
          const result = await post('admin-notify',{id:item.id});
          message.textContent = `Надіслано: ${result.sent}. Помилки: ${result.failed}. За потреби повторіть для наступної групи.`;
        }) : null);
      return [source?h('img',{className:'console-thumb',src:source,alt:'',loading:'lazy',width:43,height:50}):icon('image'),h('strong',{},item.name),
        collections.get(item.collection)??item.collection??'—',draft?.category??item.category??'—',
        data.fulfillment==='spreadshop' ? note('У Spreadshop') : money(item.price),badge(productStatus[item.status]??item.status),draft?.partnerId||'—',
        menu(`Дії товару ${item.name}`,[h('button',{type:'button',className:'console-nav-link',onclick:()=>modal(item.name,editor(),true)},'Переглянути')])];
    });
    return [note(`${rows.length} позицій у каталозі SLX. Дані Spreadshop звіряються окремо після активації.`),rows.length ?
      table(['Зображення','Назва','Колекція','Категорія','Ціна','Статус','Spreadshop ID','Дії'],rows,'Товари SLX') : card(empty('Каталог порожній'))];
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
  function editorial(data,kind) {
    const assets=[['','Без обкладинки'],...data.media.filter(item=>item.kind!=='video').map(item=>[item.path,item.path.split('/').at(-1)])];
    const cards=data[kind].map(item=>{
      const common=[field('Назва','name',item.name,{required:true,maxLength:100}),
        h('label',{},'Опис',h('textarea',{name:'description',value:item.description,maxLength:1000}))];
      const seo=[field('SEO title','seoTitle',item.seoTitle,{maxLength:120}),field('SEO description','seoDescription',item.seoDescription,{maxLength:320})];
      const visibility=[field('Порядок','order',item.order,{type:'number',min:0,max:9999}),checkbox('Видимість','visible',item.visible)];
      const fields=kind==='website' ? [...common,...seo,field('Контактний email','email',item.email,{type:'email'}),
        field('Hero','hero',item.hero,{required:true,maxLength:90}),field('Оголошення','announcement',item.announcement,{maxLength:150}),
        checkbox('Тизер','teaser',item.teaser),...['collection','about','social'].map(id=>checkbox({collection:'Колекція',about:'Про бренд',social:'Соцмережі'}[id],id,item.sections.includes(id)))
      ] : kind==='collection' ? [...common,...seo,...visibility,field('Slug','slug',item.slug,{required:true,maxLength:65}),
        field('Орієнтовна дата','launchDate',item.launchDate,{type:'date'}),choose('Обкладинка','cover',assets,item.cover),
        choose('Статус','status',[['draft','Draft'],['coming-soon','Coming Soon'],['published','Published'],['archived','Archived']],item.status)
      ] : [...common,...visibility,field('Категорія','category',item.category,{required:true,maxLength:70}),
        choose('Колекція','collection',data.collection.map(row=>[row.id,row.name]),item.collection),
        field('Зображення з медіатеки (через кому)','images',item.images.join(', '),{maxLength:1200}),
        field('Ідентифікатор Spreadshop','partnerId',item.partnerId,{maxLength:80}),field('Посилання Spreadshop','partnerUrl',item.partnerUrl,{type:'url'}),
        field('Довідкова ціна GBP','infoPrice',item.infoPrice,{placeholder:'£…'}),
        choose('Доступність','availability',[['coming-soon','Coming Soon'],['available','Available'],['sold-out','Sold out']],item.availability)];
      const editor=form(fields,h('button',{type:'submit',className:'primary'},'Зберегти чернетку'),values=>post('admin-content-save',{...values,kind,id:item.id,
        visible:values.visible==='on',order:Number(values.order),teaser:values.teaser==='on',images:split(values.images ?? ''),
        sections:['collection','about','social'].filter(id=>values[id]==='on')}));
      const sample=h('div',{className:'ops-draft-preview'});
      const pre=action('Переглянути чернетку',()=>{
        const values=formValues(editor);
        const cover=values.cover || split(values.images ?? '')[0];
        sample.replaceChildren(values.announcement ? note(values.announcement) : null,h('h3',{},values.hero || values.name),
          h('p',{},values.description),assets.some(([path])=>path===cover && path) ? h('img',{src:`/${cover}`,alt:'',loading:'lazy'}) : null,
          note([values.slug,values.status,values.seoTitle].filter(Boolean).join(' · ')));
      });
      if (kind==='website') return card(heading(item.name),editor,pre,sample);
      const related=data.product.filter(row=>row.collection===item.id);
      const cover=kind==='collection'?item.cover||related.find(row=>row.images.length)?.images[0]:item.images[0];
      const status=item.status??item.availability;
      const state={draft:'Чернетка','coming-soon':'Coming Soon',published:'Опубліковано',archived:'Архів',available:'Доступно','sold-out':'Розпродано'};
      const open=action('Редагувати',()=>modal(`Редагувати ${item.name}`,h('div',{className:'ops-results'},editor,pre,sample),true));
      return h('article',{className:'console-editorial-card'},h('div',{className:'console-media-image'},cover?
        h('img',{src:`/${cover}`,alt:item.name,loading:'lazy'}):icon('image')),
        h('div',{className:'console-media-caption'},h('div',{className:'console-toolbar'},h('strong',{},item.name),badge(state[status]??status,status==='coming-soon'?'warn':'neutral')),
        h('p',{},kind==='collection'?`${related.length} дизайнів` : data.collection.find(row=>row.id===item.collection)?.name??item.collection),
        h('p',{},item.updatedAt?`Оновлено ${ds(item.updatedAt)}`:'Збережено в каталозі'),open));
    });
    if (kind==='website') return cards;
    const grid=h('div',{className:'console-editorial-grid'},cards);
    return [note('Чернетки доступні команді. Публічну вітрину оновлює погоджений реліз.'),grid];
  }
  function media(data) {
    const picker=h('input',{type:'file',accept:'image/png,image/webp,image/jpeg,video/mp4'});
    const verify=action('Перевірити файл',async()=>{
      const file=picker.files[0];
      if (!file || file.size>3250000) throw new Error('Виберіть файл до 3,25 МБ.');
      const base64=await new Promise((resolve,reject)=>{
        const reader=new FileReader(); reader.onload=()=>resolve(reader.result.split(',')[1]);reader.onerror=reject;reader.readAsDataURL(file);
      });
      const result=await post('admin-media-validate',{mime:file.type,base64});
      message.dataset.tone='success';message.textContent=`Формат перевірено · ${result.bytes} Б. Зберігання вимкнено.`;
    });
    const query=field('Пошук за назвою','searchMedia','',{type:'search'});
    const kinds={image:'Зображення',logo:'Логотип',poster:'Постер',video:'Відео'};
    const category=choose('Тип','mediaKind',[['','Усі'],...Object.entries(kinds)],'');
    const grid=h('div',{className:'console-media-grid'});
    const entries=data.media.map(item=>{
      const filename=item.path.split('/').at(-1);
      const src=`/${item.path}`;
      const format=filename.split('.').at(-1).toUpperCase();
      const size=h('span',{},'');const dimensions=h('span',{},'');
      const picture=item.kind==='video'?icon('images'):h('img',{src,alt:'',loading:'lazy'});
      if (picture instanceof HTMLImageElement) picture.addEventListener('load',()=>{
        dimensions.textContent=` · ${picture.naturalWidth} × ${picture.naturalHeight}`;
      });
      let readSize=false;
      const cardNode=h('article',{className:'console-media-card'},h('button',{type:'button',className:'console-media-image',ariaLabel:`Збільшити ${filename}`,onclick:()=>{
        const enlarged=item.kind==='video' ? h('video',{className:'console-preview-media',src,controls:true,preload:'metadata'})
          : h('img',{className:'console-preview-media',src,alt:filename});
        if (item.kind==='video') enlarged.addEventListener('loadedmetadata',()=>{dimensions.textContent=` · ${enlarged.videoWidth} × ${enlarged.videoHeight}`;});
        modal(filename,enlarged);
      }},picture),h('div',{className:'console-media-caption'},h('strong',{},filename),h('p',{},`${kinds[item.kind]} · ${format}`,size,dimensions)));
      const show=()=>{if(readSize)return;readSize=true;
        fetch(src,{method:'HEAD'}).then(response=>{
          const bytes=Number(response.headers.get('content-length'));
          if(response.ok&&bytes>0)size.textContent=` · ${Math.round(bytes/1024)} КБ`;
        }).catch(()=>{});
      };
      return {...item,filename,cardNode,show};
    });
    const observer=new IntersectionObserver(records=>{
      for(const record of records) if(record.isIntersecting) {entries.find(entry=>entry.cardNode===record.target)?.show();observer.unobserve(record.target);}
    });
    function filter() {
      observer.disconnect();
      const text=query.querySelector('input').value.toLowerCase().trim(), kind=category.querySelector('select').value;
      const found=entries.filter(entry=>(!kind||entry.kind===kind)&&entry.filename.toLowerCase().includes(text));
      grid.replaceChildren(...(found.length?found.map(entry=>entry.cardNode):[empty('Файлів не знайдено')]));
      for (const entry of found) observer.observe(entry.cardNode);
    }
    query.addEventListener('input',filter);category.addEventListener('change',filter);filter();
    return [h('div',{className:'console-toolbar'},note('Завантаження вимкнено до погодження Storage.'),
      h('details',{className:'console-file-validation'},h('summary',{},'Перевірити формат файла'),h('label',{},'Файл',picker),verify)),
      h('div',{className:'console-toolbar console-filters'},query,category),grid];
  }
  function email(data) {
    const status=h('span',{},badge('Перевіряємо…'));
    read('admin-system').then(result=>status.replaceChildren(badge(result.email==='configured'?'Провайдер налаштовано':'Провайдер не налаштовано')))
      .catch(()=>status.replaceChildren(badge('Статус недоступний','warn')));
    function previewMail(item) {
      const frame=h('article',{className:'console-email-preview'},h('img',{src:'/assets/brand/logo-480.webp',alt:'SLX Division',width:110,height:80}),
        h('small',{},'SLX DIVISION · HEAVY DANGELS'),h('h3',{},item.title),h('p',{},item.copy),
        h('img',{src:'/assets/collections/heavy-dangels/blind-seraph-preview.webp',width:420,height:560,alt:'Blind Seraph artwork'}),
        h('span',{className:'console-email-link'},item.cta),h('small',{},'Manage subscription'));
      const desktop=h('button',{className:'secondary',type:'button'},icon('monitor'),'Desktop');
      const mobile=h('button',{className:'secondary',type:'button'},icon('smartphone'),'Mobile');
      function resize(compactView) {
        frame.classList.toggle('is-mobile',compactView);desktop.setAttribute('aria-pressed',String(!compactView));mobile.setAttribute('aria-pressed',String(compactView));
      }
      desktop.onclick=()=>resize(false);mobile.onclick=()=>resize(true);resize(false);
      const dialog=modal(item.title,h('div',{className:'ops-results'},h('div',{className:'console-tab-row'},desktop,mobile),frame,
        h('a',{className:'secondary',href:endpoint('admin-email',{template:item.id,mode}),target:'_blank',rel:'noopener'},'Відкрити HTML')));
      dialog.classList.add('console-email-modal');
    }
    return [h('div',{className:'console-toolbar'},note('Dry run перевіряє шаблон без надсилання.'),status),
      h('div',{className:'console-mail-grid'},data.templates.map(item=>card(icon('mail'),heading(item.title),note(item.copy),
        h('div',{className:'console-tab-row'},action('Переглянути лист',()=>previewMail(item)),preview ? action('Dry run',async()=>{
          const result=await post('admin-email-dry-run',{template:item.id});await render();
          message.dataset.tone='success';message.textContent=result.duplicate?'Симуляцію вже зафіксовано.':'Симуляцію зафіксовано.';
        }) : null)))),card(heading('Історія тестів'),data.history.length?table(['Шаблон','Результат','Дата'],data.history.map(row=>[
          data.templates.find(item=>item.id===row.template)?.title??row.template,badge(row.state==='simulated'?'Симуляція':'Помилка',row.state==='simulated'?'good':'error'),ds(row.checked_at)]),'Історія тестів пошти'):
        empty('Тестових операцій ще немає',null,'mail'))];
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
    if (!rows.length) return [...output,card(empty('Замовлень у цьому режимі ще немає.',
      'Нові замовлення з’являться після їх реєстрації.','shopping-bag'))];
    const entries=[];
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
      const details=h('div',{className:'ops-results'},
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
        order.events.length ? h('ol',{className:'ops-timeline'},order.events.map(event=>h('li',{},`${ds(event.at)} · ${orderStatus[event.status]}`))) : null);
      entries.push({status:order.status,cells:[h('strong',{},brief(order.id)),badge(orderStatus[order.status]),ds(order.created_at),
        order.items.reduce((sum,item)=>sum+item.quantity,0),money(order.subtotal),
        action('Деталі',()=>modal(`Замовлення ${brief(order.id)}`,details,true))]});
    }
    const stage=choose('Статус','filterOrders',[['','Усі статуси'],...Object.entries(orderStatus)],'');
    const list=h('div',{});
    const apply=()=>{
      const selected=stage.querySelector('select').value;
      const visible=entries.filter(row=>!selected||row.status===selected);
      list.replaceChildren(visible.length?table(['Замовлення','Статус','Створено','Одиниць','Сума','Дії'],visible.map(row=>row.cells),'Замовлення SLX')
        : card(empty('Замовлень за цим статусом немає.')));
    };
    stage.addEventListener('change',apply);apply();
    return [...output,h('div',{className:'console-toolbar'},stage),list];
  }
  function customers(data) {
    if (!data.customers.length) return [card(empty('Клієнтів ще немає.',mode==='test'?'Тестовий режим не показує дані покупців.':null,'users'))];
    return [table(['Email','Робочих замовлень','Зареєстровано'],data.customers.map(user=>[h('strong',{},user.email),user.orders,ds(user.created_at)]),'Клієнти SLX')];
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
      const totals=data.totals, expenses=Object.keys(cost).reduce((sum,key)=>sum+Number(totals[key]??0),0)+Number(totals.refunds??0)+Number(totals.referrals??0);
      result.replaceChildren(h('dl',{className:'console-kpis'},[['Дохід',totals.revenue],['Витрати',expenses],['Прибуток',totals.profit]].map(([label,value])=>
        h('div',{},h('dt',{},label),h('dd',{},money(value)),h('small',{},mode==='test'?'Тестові дані':'Поточний звіт')))),
        balanceCard(fund,()=>refresh(range)),card(heading('Звіт за період'),
        h('dl',{className:'finance-grid'},Object.entries(labels).map(([key,label])=>h('div',{},h('dt',{},label),h('dd',{},money(data.totals[key]))))),
        h('a',{className:'secondary',href:endpoint('admin-finance-csv',{mode,...range})},'Завантажити CSV')));
    }
    refresh({from,to}).catch(unauthorized);
    const dates=form([field('Від','from',from,{type:'date',required:true}),field('До','to',to,{type:'date',required:true})],
      h('button',{type:'submit',className:'primary'},'Застосувати'),refresh,{refresh:false});
    dates.classList.add('console-filters');
    return [mode==='test' ? note('Показано лише тестовий фінансовий облік.') : null,dates,result];
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
    const checklist={prices_ready:'Підтверджено роздрібні ціни',sample_ready:'Перевірено якість тестового виробу',
      terms_ready:'Підтверджено умови доставки й повернення',seller_ready:'Перевірено дані продавця',
      payment_ready:'Підтверджено оформлення прийому платежів',manufacturer_ready:'Підтверджено готовність виробництва'};
    const completed=data.launchChecks.filter(key=>data.config[key]===true).length;
    const general=()=>card(heading('Чекліст запуску'),note(`Підтверджено ${completed} з ${data.launchChecks.length}`),mode==='live'?form([
      checkbox('Приймати неоплачені запити','sales',data.config.sales),
      ...data.launchChecks.map(key=>checkbox(checklist[key],key,Boolean(data.config[key]))),
      field('Відрахування у резерв, %','reserve_bps',(data.config.reserve_bps ?? 0)/100,{...percent,required:true}),
      field('Ціль Relocation Fund, грн','fund_goal',fromMinor(data.config.fund_goal),numeric),
      field('Комісія SLX Circle за замовчуванням, %','referral_bps',data.config.referral_bps/100,{...percent,required:true}),
    ],summary(),values=>post('admin-settings',{
      sales:values.sales==='on',...Object.fromEntries(data.launchChecks.map(key=>[key,values[key]==='on'])),
      reserve_bps:toMinor(values.reserve_bps),fund_goal:toMinor(values.fund_goal),referral_bps:toMinor(values.referral_bps),
    })):note('Для зміни налаштувань перейдіть у робочий режим.'));
    const staffPanel=()=>card(heading('Доступ команди'),...data.staff.map(staff=>staff.role==='owner'||mode!=='live' ? note(`${staff.email} · ${roles[staff.role]}`)
      : form([note(staff.email),choose('Роль','role',Object.entries(roles).filter(([key])=>key!=='owner'),staff.role),checkbox('Активний','active',staff.active)],
        summary(),values=>post('admin-staff',{id:staff.id,role:values.role,active:values.active==='on'}))));
    const content=h('div',{});
    const panels=[['Загальні',general],['Безпека',()=>card(heading('Політика доступу'),note('Права перевіряються сервером. Сеанси команди завершуються через 8 годин.'),
      action('Завершити поточний сеанс',logout))],['Інтеграції',()=>card(heading('Інтеграції'),note(data.telegramReady?'Telegram підключено.':'Telegram не налаштовано.'),
      action('Відкрити стан сервісів',()=>openSection('system')))],['Користувачі',staffPanel],['Середовище',()=>card(heading('Поточне середовище'),
      badge(labels[environment]??'TEST'),note(data.envAllowsSales?'Робочий режим дозволено конфігурацією Vercel.':'У Vercel робочі замовлення ще не дозволені.'))]];
    const group=h('div',{className:'console-tab-row',role:'group',ariaLabel:'Розділи налаштувань'});
    function show(index) {
      for(const [i,button] of [...group.children].entries()) button.setAttribute('aria-pressed',String(i===index));
      content.replaceChildren(panels[index][1]());
    }
    group.append(...panels.map(([label],i)=>h('button',{className:'secondary',type:'button',onclick:()=>show(i)},label)));
    show(0);return [group,content];
  }
  const views = {dashboard,analytics,subscribers,social,system,products,collections:data=>editorial(data,'collection'),designs:data=>editorial(data,'product'),
    website:data=>editorial(data,'website'),media,email,orders,customers,manufacturing:data=>orders(data,true),partners,finance,referrals:circles,settings:configuration};
  function allowedTabs() {
    const role = me.role;
    const limited={operator:['dashboard','orders','manufacturing'],analyst:['dashboard','analytics','system'],editor:['dashboard','collections','designs','website','media','social','system']};
    return Object.keys(tabs).filter(id=>(id!=='subscribers' || subscriberAccess || mode==='live')
      && (role==='owner' || (role==='manager' ? id!=='settings' : limited[role]?.includes(id))));
  }
  function openSection(id) {
    if (mobileNav.open) mobileNav.close();
    const group=navigationGroups.find(([,items])=>id in items);
    if (group) closedGroups.delete(group[0]);
    tab=id;message.textContent='';
    window.scrollTo(0,0);
    return render();
  }
  async function logout() {
    try { await api('logout',{body:{}}); location.reload(); } catch (error) { unauthorized(error); }
  }
  function navigationItems(isMobile=false) {
    const list=allowedTabs();
    const modeSelect = choose('Режим','mode',[['test','Тестові дані'],['live','Робочі дані']],mode);
    modeSelect.addEventListener('change',event=>{
      mode=event.target.value;
      if (tab==='subscribers' && !subscriberAccess && mode!=='live') tab='dashboard';
      message.textContent='';render();
    });
    const brand=h('div',{className:'console-brand'},h('img',{src:'/assets/brand/logo-480.webp',width:38,height:28,alt:'SLX'}),
      h('span',{},h('strong',{},'SLX Division'),h('small',{},'Management Console')),
      isMobile ? iconButton('x','Закрити навігацію',()=>mobileNav.close()) : null);
    const groups=navigationGroups.map(([group,items])=>{
      const shown=Object.entries(items).filter(([id])=>list.includes(id));
      if (!shown.length) return null;
      const children=h('div',{className:'console-nav-links'},shown.map(([id,glyph])=>{
        const button=h('button',{type:'button',className:'console-nav-link',title:tabs[id][0],ariaLabel:tabs[id][0]},icon(glyph),h('span',{},tabs[id][0]));
        if (tab===id) button.setAttribute('aria-current','page');
        button.addEventListener('click',()=>openSection(id));return button;
      }));
      const groupButton=h('button',{className:'console-group-toggle',type:'button'},group,icon('chevron-down'));
      const toggle=()=>{
        const open=!closedGroups.has(group)||(!isMobile&&compact);
        children.hidden=!open;groupButton.setAttribute('aria-expanded',String(open));
      };
      groupButton.addEventListener('click',()=>{if(closedGroups.has(group))closedGroups.delete(group);else closedGroups.add(group);toggle();});
      toggle();return h('section',{className:'console-nav-group'},groupButton,children);
    });
    return [brand,h('nav',{className:'console-side-links',ariaLabel:'Модулі'},groups),h('div',{className:'console-sidebar-foot'},
      h('div',{className:'console-identity'},h('span',{className:'console-avatar'},icon('user-round')),h('span',{},h('strong',{},roles[me.role]),h('small',{},me.email))),
      h('div',{className:'console-side-options'},modeSelect,badge(labels[environment]??'TEST','neutral')),
      h('button',{className:'console-nav-link console-logout',type:'button',title:'Вийти',ariaLabel:'Вийти',onclick:logout},icon('log-out'),h('span',{},'Вийти')))];
  }
  function commandPalette() {
    if (document.querySelector('.console-command')) return;
    const input=h('input',{type:'search',placeholder:'Знайти розділ',ariaLabel:'Знайти розділ'});
    const results=h('div',{className:'console-command-results'});
    const dialog=modal('Перейти до розділу',h('div',{className:'console-command'},input,results));
    function filter() {
      const query=input.value.trim().toLowerCase();
      const found=allowedTabs().filter(id=>tabs[id][0].toLowerCase().includes(query));
      results.replaceChildren(...(found.length ? found.map(id=>h('button',{type:'button',className:'console-nav-link',onclick:()=>{dialog.close();openSection(id);}},tabs[id][0]))
        : [note('Розділів не знайдено.')]));
    }
    input.addEventListener('input',filter);
    input.addEventListener('keydown',event=>{
      if(event.key==='ArrowDown') results.querySelector('button')?.focus();
      if(event.key==='Enter') results.querySelector('button')?.click();
    });
    filter();input.focus();
  }
  function navigation() {
    consoleLayout.classList.toggle('sidebar-compact',compact);
    nav.replaceChildren(...navigationItems());
    if (mobileNav.open) mobileNav.replaceChildren(...navigationItems(true));
    const group=navigationGroups.find(([,items])=>tab in items)?.[0];
    const collapse=iconButton('panel-left',compact?'Розгорнути панель':'Згорнути панель',()=>{
      compact=!compact;try {localStorage.setItem(compactKey,compact?'1':'0');} catch {} navigation();
      topbar.querySelector('.console-desktop-toggle')?.focus();
    });
    collapse.classList.add('console-desktop-toggle');collapse.setAttribute('aria-expanded',String(!compact));
    const mobile=iconButton('menu','Відкрити навігацію',()=>{mobileNav.replaceChildren(...navigationItems(true));mobileNav.showModal();});
    mobile.classList.add('console-mobile-toggle');
    const shortcut=h('button',{type:'button',className:'console-search',ariaLabel:'Пошук розділів',onclick:commandPalette},icon('search'),h('span',{},'Пошук розділів'),h('kbd',{},'Ctrl K'));
    const user=h('details',{className:'console-user-menu'},h('summary',{className:'console-icon-button',ariaLabel:'Обліковий запис',title:'Обліковий запис'},icon('user-round')),
      h('div',{className:'console-menu-items'},h('strong',{},roles[me.role]),note(me.email),
        h('button',{type:'button',className:'console-nav-link',onclick:logout},icon('log-out'),'Завершити сеанс')));
    topbar.replaceChildren(collapse,mobile,h('nav',{className:'console-crumbs',ariaLabel:'Розташування'},h('span',{},group),icon('chevron-right'),h('strong',{},tabs[tab][0])),
      h('div',{className:'console-top-actions'},shortcut,badge(labels[environment]??'TEST'),h('span',{className:`console-health is-${backendState}`,
        title:backendState==='ok'?'Backend API відповідає':backendState==='error'?'Backend API недоступний':'Перевірка Backend API'},
      h('i',{}),h('span',{},'API')),user));
  }
  async function render() {
    const version = ++loadNumber;
    if (me) navigation();
    panel.setAttribute('aria-busy','true');
    panel.replaceChildren(h('p',{className:'console-skeleton',role:'status'},h('span',{className:'console-sr-only'},'Завантажуємо…')));
    try {
      let summaryData;
      if (!me) {
        summaryData = await read('admin-summary');
        me = summaryData.user;
        preview = summaryData.preview;
        environment=summaryData.environment;
        backendState='ok';
        subscriberAccess = Boolean(summaryData.signups);
        navigation();
      }
      const data = tab==='products' ? await Promise.all([read('admin-products'),read('admin-content'),read('admin-summary')])
        .then(([products,editorial,overview])=>({...products,editorial,fulfillment:overview.fulfillment}))
        : tab==='finance' ? null : tab==='dashboard' && summaryData ? summaryData
        : await read(tabs[tab][1],tab==='subscribers' ? subscriberFilters : undefined);
      if (version===loadNumber) {
        backendState='ok';
        panel.replaceChildren(h('div',{className:'console-page-heading'},h('h1',{},tab==='dashboard'?'Огляд SLX Division':tabs[tab][0])),...views[tab](data));
      }
    } catch (error) { if (version===loadNumber) {
      if (!error.status || error.status>=500) backendState='error';
      panel.replaceChildren(card(empty('Не вдалося завантажити розділ',error.message,'triangle-alert'),action('Спробувати ще раз',render)));
      unauthorized(error);
    } } finally { if(version===loadNumber) {panel.setAttribute('aria-busy','false');if(me) topbar.querySelector('.console-health')?.classList.toggle('is-error',backendState==='error');} }
  }
  document.addEventListener('keydown',event=>{if(me && (event.ctrlKey||event.metaKey) && event.key.toLowerCase()==='k'){event.preventDefault();commandPalette();}});
  render();
})();
