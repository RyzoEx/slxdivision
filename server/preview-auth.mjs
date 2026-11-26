import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { emailAddress, newId, requireThat } from './security.mjs';

const derive = promisify(scrypt);
const params = {N:65536,r:8,p:1,maxmem:96*1024*1024};

export async function provisionPreviewStaff(db, address, role, password) {
  const email = emailAddress(address);
  requireThat(['owner','manager','operator'].includes(role),400,'Choose a staff role.');
  requireThat(typeof password === 'string' && password.length >= 20 && password.length <= 128,400,'Set a unique 20–128 character Preview password.');
  const salt = randomBytes(32).toString('hex');
  const hash = (await derive(password,salt,32,params)).toString('hex');
  await db.transaction(async tx=>{
    const {rows:[user]} = await tx.query(`INSERT INTO slx_users(id,email,role) VALUES ($1,$2,$3)
      ON CONFLICT(email) DO UPDATE SET role=EXCLUDED.role,active=true RETURNING id`,[newId(),email,role]);
    await tx.query(`INSERT INTO slx_preview_credentials VALUES ($1,$2,$3)
      ON CONFLICT(user_id) DO UPDATE SET salt=EXCLUDED.salt,password_hash=EXCLUDED.password_hash`,[user.id,salt,hash]);
    await tx.query('DELETE FROM slx_sessions WHERE user_id=$1',[user.id]);
  });
}

export function previewAuth(db) {
  return {
    authReady:false,
    storageReady:false,
    async password(email,password) {
      const {rows:[user]} = await db.query(`SELECT u.id,u.email,c.salt,c.password_hash FROM slx_users u
        JOIN slx_preview_credentials c ON c.user_id=u.id WHERE u.email=$1 AND u.active`,[email]);
      const actual = await derive(password,user?.salt ?? 'slx-missing-preview-credential',32,params);
      const expected = Buffer.from(user?.password_hash ?? '00'.repeat(32),'hex');
      const matches = timingSafeEqual(actual,expected);
      requireThat(user && matches,401,'Не вдалося підтвердити вхід.');
      return {id:user.id,email:user.email,email_confirmed_at:true};
    },
  };
}
