import {PGlite} from '@electric-sql/pglite';
import {migrate,schemaQuery} from './db.mjs';

export async function embeddedDatabase(path='memory://') {
  const client=await PGlite.create(path);
  const wrap=target=>({query:(sql,values)=>target.query(schemaQuery(sql),values),exec:sql=>target.exec(sql)});
  const db={...wrap(client),transaction:run=>client.transaction(tx=>run(wrap(tx))),close:()=>client.close()};
  try { await migrate(db); } catch (error) { await db.close(); throw error; }
  return db;
}
