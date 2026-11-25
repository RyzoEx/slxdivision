import { costKeys } from './orders.mjs';
import { requireThat } from './security.mjs';

const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value ?? '')
  && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
export async function report(db, mode, from, to) {
  requireThat(validDate(from) && validDate(to) && from <= to,400,'Вкажіть коректний діапазон дат.');
  requireThat(Date.parse(to) - Date.parse(from) <= 366 * 86400000,400,'Оберіть період не довший за рік.');
  const { rows } = await db.query(`WITH bounds AS (
    SELECT $2::date::timestamp AT TIME ZONE 'Europe/Kyiv' AS start_at, ($3::date+1)::timestamp AT TIME ZONE 'Europe/Kyiv' AS end_at
  ) SELECT id,closed_at,refunded_at,subtotal,advance,financials,resolution,
    (COALESCE(closed_at,refunded_at)>=start_at AND COALESCE(closed_at,refunded_at)<end_at) AS recognized_in_period,
    (refunded_at>=start_at AND refunded_at<end_at) AS refunded_in_period
    FROM slx_orders,bounds WHERE mode=$1 AND (
    (closed_at>=start_at AND closed_at<end_at) OR (refunded_at>=start_at AND refunded_at<end_at))`,[mode,from,to]);
  const referralRows = (await db.query(`SELECT e.order_id,SUM(CASE WHEN e.kind='credit' THEN e.amount ELSE -e.amount END) AS amount
    FROM slx_referral_entries e JOIN slx_orders o ON o.id=e.order_id
    WHERE o.mode=$1 AND e.created_at>=($2::date::timestamp AT TIME ZONE 'Europe/Kyiv')
    AND e.created_at<(($3::date+1)::timestamp AT TIME ZONE 'Europe/Kyiv') GROUP BY e.order_id`,[mode,from,to])).rows;
  const detail = new Map();
  const line = id => {
    if (!detail.has(id)) detail.set(id,Object.fromEntries(['revenue','refunds',...costKeys,'referrals'].map(key => [key,0])));
    return detail.get(id);
  };
  for (const order of rows) {
    const entry = line(order.id);
    if (order.recognized_in_period) {
      entry.revenue = Number(order.closed_at ? order.subtotal : order.advance ?? order.subtotal);
      for (const key of costKeys) entry[key] = Number(order.financials[key] ?? 0);
    }
    if (order.refunded_in_period) entry.refunds = Number(order.resolution?.refund ?? order.subtotal);
  }
  for (const referral of referralRows) line(referral.order_id).referrals = Number(referral.amount);
  const totals = line('total');
  for (const [id, entry] of detail) {
    if (id !== 'total') for (const key of Object.keys(totals)) totals[key] += entry[key];
    entry.profit = entry.revenue - entry.refunds - costKeys.reduce((sum,key) => sum + entry[key],0) - entry.referrals;
  }
  detail.delete('total');
  return {mode,from,to,totals,details:[...detail].map(([id,entry]) => ({id,...entry}))};
}
export function csv(report) {
  const columns = ['revenue','refunds',...costKeys,'referrals','profit'];
  const amount = value => (value / 100).toFixed(2);
  return '\uFEFF' + [
    ['mode','from','to','order_id',...columns].join(','),
    ...report.details.map(row => [report.mode,report.from,report.to,row.id,...columns.map(key => amount(row[key]))].join(',')),
    [report.mode,report.from,report.to,'TOTAL',...columns.map(key => amount(report.totals[key]))].join(','),
  ].join('\r\n') + '\r\n';
}
