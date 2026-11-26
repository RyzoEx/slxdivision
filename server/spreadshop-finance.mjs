import { validDate, validateReportRange } from './finance.mjs';
import { requireThat, text } from './security.mjs';

const currencies = ['GBP','EUR'];
const kinds = ['credit','adjustment','payout'];

export async function spreadshopReport(db,mode,from,to,{exportRows=false} = {}) {
  validateReportRange(from,to);
  const {rows:totals}=await db.query(`SELECT currency,kind,SUM(amount) AS amount FROM slx_spreadshop_entries
    WHERE mode=$1 AND day BETWEEN $2::date AND $3::date GROUP BY currency,kind`,[mode,from,to]);
  const {rows}=await db.query(`SELECT kind,currency,reference,day::text AS day,amount FROM slx_spreadshop_entries
    WHERE mode=$1 AND day BETWEEN $2::date AND $3::date ORDER BY day DESC,created_at DESC,currency,kind,reference
    ${exportRows ? '' : 'LIMIT 200'}`,[mode,from,to]);
  const byCurrency=currencies.map(currency=>{
    const amounts=Object.fromEntries(kinds.map(kind=>[kind,Number(totals.find(row=>row.currency===currency && row.kind===kind)?.amount ?? 0)]));
    return {currency,...amounts,earned:amounts.credit+amounts.adjustment};
  });
  return {provider:'spreadshop',mode,from,to,byCurrency,entries:rows};
}

export async function recordSpreadshopEntry(db,actor,mode,data) {
  const reference=text(data.reference,80,true);
  requireThat(/^[a-z0-9][a-z0-9._/-]{0,79}$/i.test(reference),400,'Вкажіть номер документа без пробілів.');
  requireThat(currencies.includes(data.currency) && kinds.includes(data.kind) && validDate(data.day),400,'Перевірте тип, валюту й дату.');
  requireThat(Number.isSafeInteger(data.amount) && Math.abs(data.amount)<=100000000 && data.amount!==0
    && (data.kind==='adjustment' || data.amount>0),400,'Перевірте суму.');
  return db.transaction(async tx=>{
    const values=[mode,data.kind,data.currency,reference,data.day,data.amount,actor.id];
    const {rows}=await tx.query(`INSERT INTO slx_spreadshop_entries(mode,kind,currency,reference,day,amount,actor_id)
      VALUES ($1,$2,$3,$4,$5::date,$6,$7) ON CONFLICT DO NOTHING RETURNING reference`,values);
    if (rows.length) await tx.query("INSERT INTO slx_audit(actor_id,action,subject) VALUES ($1,'spreadshop.record',$2)",[actor.id,reference]);
    else {
      const previous=(await tx.query(`SELECT day::text AS day,amount FROM slx_spreadshop_entries
        WHERE mode=$1 AND kind=$2 AND currency=$3 AND reference=$4`,values.slice(0,4))).rows[0];
      requireThat(previous?.day===data.day && Number(previous.amount)===data.amount,409,'Запис за цим документом уже існує.');
    }
    return {ok:true};
  });
}

export function spreadshopCsv(data) {
  return '\uFEFF'+[
    'mode,day,kind,currency,reference,amount',
    ...data.entries.map(row=>[data.mode,row.day,row.kind,row.currency,row.reference,(Number(row.amount)/100).toFixed(2)].join(',')),
  ].join('\r\n')+'\r\n';
}
