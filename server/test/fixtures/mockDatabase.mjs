import actualSql from 'mssql';
let adapter;
export function configureDatabase(value){adapter=value;}
class Transaction{
  async begin(){await adapter.begin?.();}
  async commit(){await adapter.commit?.();}
  async rollback(){await adapter.rollback?.();}
}
class Request{
  constructor(){this.values={};}
  input(name,_type,value){this.values[name]=value;return this;}
  query(text){return adapter.query(text,this.values);}
}
export const sql={...actualSql,Transaction,Request};
export const getPool=async()=>({request:()=>new Request()});
