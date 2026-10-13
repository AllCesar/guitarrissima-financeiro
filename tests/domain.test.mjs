import test from 'node:test';
import assert from 'node:assert/strict';
import {financialWeek, validateAllocations, validateInstallments, allocateEvenly, outstandingCents} from '../src/domain/finance.mjs';
test('calendário financeiro nunca cria sexta semana',()=>{
  for (const day of [29,30,31]) assert.equal(financialWeek('2026-10-'+day),5);
  assert.equal(financialWeek('2026-10-07'),1);
  assert.equal(financialWeek('2026-10-08'),2);
  assert.equal(financialWeek('2026-10-28'),4);
  assert.throws(()=>financialWeek('2026-02-30'));
});
test('rateios precisam somar centavo a centavo',()=>{
  assert.equal(validateAllocations(10001,[{categoryId:'a',amountCents:5000},{categoryId:'b',amountCents:5001}]),true);
  assert.throws(()=>validateAllocations(10001,[{categoryId:'a',amountCents:5000},{categoryId:'b',amountCents:5000}]));
  assert.throws(()=>validateAllocations(100,[{categoryId:'a',amountCents:50.5},{categoryId:'b',amountCents:49.5}]));
  assert.throws(()=>validateAllocations(100,[{amountCents:100}]));
});
test('parcelas com datas e valores íntegros',()=>{
  assert.equal(validateInstallments(10001,[{number:1,amountCents:5000,dueDate:'2026-10-15'},{number:2,amountCents:5001,dueDate:'2026-11-15'}]),true);
  assert.throws(()=>validateInstallments(100,[{number:1,amountCents:50,dueDate:'2026-10-15'},{number:1,amountCents:50,dueDate:'2026-11-15'}]));
});
test('divisão preserva centavos',()=>{assert.deepEqual(allocateEvenly(10001,3),[3334,3334,3333]);assert.equal(allocateEvenly(10001,3).reduce((a,b)=>a+b,0),10001)});
test('pagamentos parciais não excedem saldo',()=>{assert.equal(outstandingCents(10000,[3000,4000]),3000);assert.throws(()=>outstandingCents(10000,[9000,2000]))});
