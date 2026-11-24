import { PGlite } from '@electric-sql/pglite';
import { migrate, schemaQuery } from '../server/db.mjs';

export async function memoryDatabase() {
  const client = await PGlite.create('memory://');
  const wrap = target => ({
    query: (sql,values) => target.query(schemaQuery(sql),values),
    exec: sql => target.exec(sql),
  });
  const db = {...wrap(client), transaction:run=>client.transaction(tx=>run(wrap(tx))), close:()=>client.close()};
  await migrate(db);
  return db;
}
