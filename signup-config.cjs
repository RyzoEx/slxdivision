const {launchSignup} = require('./content/storefront.json');
module.exports = launchSignup || (process.env.VERCEL_ENV==='preview'
  && process.env.VERCEL_GIT_COMMIT_REF==='codex/backend-infrastructure'
  && process.env.SLX_PREVIEW_SIGNUP==='1');
