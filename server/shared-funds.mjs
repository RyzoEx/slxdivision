import { money, requireThat, text } from './security.mjs';

async function balances(db,mode) {
  const {rows:[row]} = await db.query(`SELECT COALESCE(SUM(balance_delta),0) AS balance,
    COALESCE(SUM(reserve_delta),0) AS reserve, COALESCE(SUM(fund_delta),0) AS fund
    FROM slx_balance_entries WHERE mode=$1`,[mode]);
  const balance=Number(row.balance), reserve=Number(row.reserve), fund=Number(row.fund);
  return {balance,reserve,fund,available:balance-reserve-fund};
}

export async function funds(db,mode,config) {
  const [totals,{rows}] = await Promise.all([balances(db,mode),db.query(`SELECT b.id,b.kind,u.email AS actor_email,b.order_id,
    b.balance_delta,b.reserve_delta,b.fund_delta,b.note,b.created_at
    FROM slx_balance_entries b LEFT JOIN slx_users u ON u.id=b.actor_id WHERE b.mode=$1
    ORDER BY b.id DESC LIMIT 200`,[mode])]);
  return {...totals,goal:config.fund_goal ?? null,reserveBps:config.reserve_bps ?? 0,history:rows};
}

async function entry(tx,{mode,key,actor,orderId=null,kind,delta=0,reserve=0,fund=0,note=''}) {
  await tx.query(`INSERT INTO slx_balance_entries(mode,event_key,actor_id,order_id,kind,balance_delta,reserve_delta,fund_delta,note)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(event_key) DO NOTHING`,
  [mode,key,actor.id,orderId,kind,delta,reserve,fund,note]);
}

// Call within the order transaction, while the settings row is locked.
export async function recordSettlement(tx,actor,order,kind,delta,config) {
  const current=await balances(tx,order.mode);
  let reserve=0, fund=0;
  if (delta > 0 && kind==='completion') {
    const allocatable=Math.max(0,Math.min(delta,current.available+delta));
    reserve=Math.round(allocatable*(config.reserve_bps ?? 0)/10000);
    fund=allocatable-reserve;
  } else if (delta < 0) {
    const designatedLoss=Math.max(0,Math.min(-delta,-delta-current.available));
    reserve=-Math.min(current.reserve,designatedLoss);
    fund=-Math.min(current.fund,designatedLoss+reserve);
  }
  await entry(tx,{mode:order.mode,key:`${order.id}:${kind}`,actor,orderId:order.id,kind,delta,reserve,fund});
}

export async function transferFunds(tx,actor,mode,data) {
  const amount=money(data.amount);
  requireThat(amount>0 && ['available','reserve','fund'].includes(data.from)
    && ['available','reserve','fund'].includes(data.to) && data.from!==data.to,400,'Перевірте напрям і суму переказу.');
  const note=text(data.note,240,true);
  const key=`transfer:${actor.id}:${mode}:${data.requestId}`;
  const existing=await tx.query('SELECT 1 FROM slx_balance_entries WHERE event_key=$1',[key]);
  if (existing.rows.length) return false;
  const current=await balances(tx,mode);
  requireThat(current[data.from]>=amount,409,'Недостатньо коштів у вибраному розділі.');
  const move=name=>data.to===name ? amount : data.from===name ? -amount : 0;
  await entry(tx,{mode,key,actor,kind:'transfer',reserve:move('reserve'),fund:move('fund'),note});
  return true;
}
