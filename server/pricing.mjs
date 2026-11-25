import { basisPoints, money, requireThat, text } from './security.mjs';

export const volumes = [10,30,60,90,150,300];
export const pricingCosts = ['garment','printing','fulfillment','other'];
export const commissionAmount = (price, {fixed = null, bps = 0}) =>
  fixed ?? Math.round(price * bps / 10000);

export function calculatePrice(input, reserveBps) {
  requireThat(input && typeof input === 'object' && !Array.isArray(input),400,'Заповніть розрахунок.');
  const retail = money(input.retail);
  const advance = money(input.advance);
  requireThat(retail > 0 && advance < retail,400,'Вкажіть ціну та передоплату, меншу за повну вартість.');
  const costs = Object.fromEntries(pricingCosts.map(key=>[key,money(input[key] ?? 0)]));
  const taxBps = basisPoints(input.taxBps ?? 0);
  const feeBps = basisPoints(input.feeBps ?? 0);
  const kind = input.commissionKind ?? 'percent';
  requireThat(['percent','fixed'].includes(kind),400,'Оберіть тип винагороди.');
  const commissionValue = kind === 'fixed' ? money(input.commissionValue ?? 0) : basisPoints(input.commissionValue ?? 0);
  const contributor = commissionAmount(retail,kind === 'fixed' ? {fixed:commissionValue} : {bps:commissionValue});
  const taxes = Math.round(retail * taxBps / 10000);
  const fees = Math.round(retail * feeBps / 10000);
  const profit = retail - Object.values(costs).reduce((sum,amount)=>sum+amount,0) - taxes - fees - contributor;
  const reserve = Math.round(Math.max(0,profit) * reserveBps / 10000);
  const relocation = Math.max(0,profit)-reserve;
  const values = {retail,advance,...costs,taxBps,feeBps,commissionKind:kind,commissionValue};
  return {values,retail,advance,remainder:retail-advance,taxes,fees,contributor,profit,reserve,relocation,
    marginBps:Math.round(profit * 10000 / retail),
    projections:volumes.map(units=>({units,profit:profit*units,reserve:reserve*units,relocation:relocation*units})),
  };
}

export async function manufacturers(db) {
  const {rows} = await db.query("SELECT id,data FROM slx_manufacturers ORDER BY data->>'name',id");
  return rows.map(({id,data})=>({id,...data}));
}

export function manufacturerData(input) {
  return {
    name:text(input.name,120,true), contact:text(input.contact,500), assortment:text(input.assortment,1500),
    priceList:text(input.priceList,2000), payment:text(input.payment,1000), returns:text(input.returns,1000),
    leadTime:text(input.leadTime,160), packaging:money(input.packaging,true), directShipping:input.directShipping===true,
  };
}
