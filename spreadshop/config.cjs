const shop = Object.freeze({
  name:'slxdivision',
  baseId:'myShop',
  prefix:'https://slxdivision.myspreadshop.co.uk',
  script:'https://slxdivision.myspreadshop.co.uk/shopfiles/shopclient/shopclient.nocache.js',
  locale:'en_GB',
  frameOrigin:'https://slx-spreadshop-frame.vercel.app',
});

const usesSpreadshop = env => env.SLX_FULFILLMENT === 'spreadshop';
const launchApproved = env => usesSpreadshop(env) && env.SLX_SPREADSHOP_LAUNCH_APPROVED === '1'
  && env.SLX_SPREADSHOP_PAYOUT_VERIFIED === '1' && env.SLX_SPREADSHOP_ELIGIBILITY_VERIFIED === '1';

module.exports = {shop, usesSpreadshop, launchApproved};
