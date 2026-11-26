import { validDate, validateReportRange } from './finance.mjs';
import { requireThat, text } from './security.mjs';

const currencies = ['GBP','EUR'];
const kinds = ['credit','adjustment','payout','expense'];

function allocateReceived(net) {
  const distributable = net > 0n ? net : 0n;
  const relocation = distributable / 2n;
  const development = distributable * 3n / 10n;
  const reserve = distributable - relocation - development;
  return {net:Number(net),relocation:Number(relocation),development:Number(development),reserve:Number(reserve)};
}

export async function spreadshopReport(db,mode,from,to,{exportRows=false} = {}) {
  validateReportRange(from,to);
  const {totals,entries}=await db.transaction(async tx=>{
    await tx.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
    const {rows:totals}=await tx.query(`SELECT currency,kind,
      SUM(CASE WHEN day >= $2::date THEN amount ELSE 0 END) AS period_amount,
      SUM(amount) AS total_amount FROM slx_spreadshop_entries
      WHERE mode=$1 AND day <= $3::date GROUP BY currency,kind`,[mode,from,to]);
    const {rows:entries}=await tx.query(`SELECT kind,currency,reference,day::text AS day,amount FROM slx_spreadshop_entries
      WHERE mode=$1 AND day BETWEEN $2::date AND $3::date ORDER BY day DESC,created_at DESC,currency,kind,reference
      ${exportRows ? '' : 'LIMIT 200'}`,[mode,from,to]);
    return {totals,entries};
  });
  const byCurrency=currencies.map(currency=>{
    const ledger = totals.filter(row=>row.currency===currency);
    const sum = (kind,column) => BigInt(ledger.find(row=>row.kind===kind)?.[column] ?? 0);
    const amounts=Object.fromEntries(kinds.map(kind=>[kind,Number(sum(kind,'period_amount'))]));
    const allocation=allocateReceived(sum('payout','total_amount')-sum('expense','total_amount'));
    return {currency,...amounts,earned:amounts.credit+amounts.adjustment,
      receivedNet:amounts.payout-amounts.expense,allocation};
  });
  return {provider:'spreadshop',mode,from,to,byCurrency,entries};
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
    ...data.byCurrency.flatMap(({currency,allocation})=>Object.entries(allocation).map(([kind,amount])=>
      [data.mode,data.to,`allocation_${kind}`,currency,'',(amount/100).toFixed(2)].join(','))),
  ].join('\r\n')+'\r\n';
}
