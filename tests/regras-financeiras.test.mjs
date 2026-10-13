import test from 'node:test';import assert from 'node:assert/strict';
const week=d=>Math.min(5,Math.floor((d-1)/7)+1);
const rateio=(total,parts)=>Number.isInteger(total)&&parts.every(Number.isInteger)&&parts.reduce((a,b)=>a+b,0)===total;
test('semanas financeiras',()=>{assert.equal(week(1),1);assert.equal(week(7),1);assert.equal(week(8),2);assert.equal(week(28),4);assert.equal(week(29),5);assert.equal(week(31),5)});
test('rateio em centavos sem perda',()=>{assert.equal(rateio(10001,[5000,5001]),true);assert.equal(rateio(10001,[5000,5000]),false)});
test('rateio não aceita frações de centavos',()=>assert.equal(rateio(100,[50.5,49.5]),false));
