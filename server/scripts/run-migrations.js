import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { getPool, sql } from '../db.js';

const directory=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../database/migrations');
const files=(await fs.readdir(directory)).filter(name=>/^\d+_.+\.sql$/i.test(name)).sort();
if(!files.length) throw new Error('No versioned database migrations found');

if(process.argv.includes('--check')){
  const numbers=files.map(name=>Number(name.match(/^\d+/)[0]));
  if(new Set(numbers).size!==numbers.length) throw new Error('Duplicate migration version detected');
  for(const file of files){
    const sqlText=await fs.readFile(path.join(directory,file),'utf8');
    if(!sqlText.trim()) throw new Error(`${file} is empty`);
  }
  console.log(`Validated ${files.length} migration files: ${files.join(', ')}`);
  process.exit(0);
}

const pool=await getPool();
try{
  await pool.request().query(`IF OBJECT_ID('dbo.SchemaMigrations') IS NULL
    CREATE TABLE dbo.SchemaMigrations(
      MigrationName NVARCHAR(255) NOT NULL PRIMARY KEY,
      AppliedAt DATETIME2 NOT NULL CONSTRAINT DF_SchemaMigrations_AppliedAt DEFAULT SYSUTCDATETIME()
    )`);
  for(const file of files){
    const applied=await pool.request().input('name',sql.NVarChar,file)
      .query('SELECT 1 AS Applied FROM dbo.SchemaMigrations WHERE MigrationName=@name');
    if(applied.recordset[0]) continue;
    const sqlText=await fs.readFile(path.join(directory,file),'utf8');
    const batches=sqlText.split(/^\s*GO\s*$/gim).filter(batch=>batch.trim());
    for(const batch of batches) await pool.request().batch(batch);
    await pool.request().input('name',sql.NVarChar,file)
      .query('INSERT dbo.SchemaMigrations(MigrationName) VALUES(@name)');
    console.log(`Applied ${file}`);
  }
}finally{await pool.close();}
