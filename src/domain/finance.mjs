/**
 * Pure domain rules. Monetary values are always integer centavos (BRL).
 * These functions do not mutate data or interact with a database.
 */
export function financialWeek(dateString) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) throw new Error('Data inválida');
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) throw new Error('Data inválida');
  return Math.min(5, Math.floor((day - 1) / 7) + 1);
}
export function assertCentavos(value, label = 'valor') {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(label + ': valor deve ser inteiro não negativo em centavos');
  return value;
}
export function validateAllocations(totalCents, allocations) {
  assertCentavos(totalCents, 'total');
  if (totalCents === 0) throw new Error('Obrigação deve ter valor positivo');
  if (!Array.isArray(allocations) || allocations.length === 0) throw new Error('Ao menos um rateio é obrigatório');
  let sum = 0;
  for (const allocation of allocations) {
    if (!allocation || !allocation.categoryId) throw new Error('Categoria obrigatória em cada rateio');
    const amount = assertCentavos(allocation.amountCents, 'rateio');
    if (amount === 0) throw new Error('Rateio deve ser positivo');
    sum += amount;
    if (!Number.isSafeInteger(sum)) throw new Error('Soma excede precisão segura');
  }
  if (sum !== totalCents) throw new Error('Soma dos rateios deve corresponder ao total da obrigação');
  return true;
}
export function validateInstallments(totalCents, installments) {
  assertCentavos(totalCents, 'total');
  if (!Array.isArray(installments) || installments.length === 0) throw new Error('Ao menos uma parcela é obrigatória');
  let sum = 0;
  const numbers = new Set();
  for (const part of installments) {
    if (!Number.isSafeInteger(part.number) || part.number < 1 || numbers.has(part.number)) throw new Error('Número de parcela inválido ou duplicado');
    numbers.add(part.number);
    if (part.amountCents === 0) throw new Error('Parcela deve ser positiva');
    sum += assertCentavos(part.amountCents, 'parcela');
    financialWeek(part.dueDate);
  }
  if (!Number.isSafeInteger(sum) || sum !== totalCents) throw new Error('Soma das parcelas deve corresponder ao total');
  return true;
}
export function allocateEvenly(totalCents, count) {
  assertCentavos(totalCents);
  if (!Number.isSafeInteger(count) || count < 1 || count > totalCents) throw new Error('Quantidade de parcelas inválida');
  const base = Math.floor(totalCents / count);
  const remainder = totalCents % count;
  return Array.from({ length: count }, (_, index) => base + (index < remainder ? 1 : 0));
}
export function outstandingCents(installmentCents, paymentCents) {
  assertCentavos(installmentCents, 'parcela');
  if (!Array.isArray(paymentCents)) throw new Error('Pagamentos inválidos');
  const paid = paymentCents.reduce((sum, amount) => sum + assertCentavos(amount, 'pagamento'), 0);
  if (!Number.isSafeInteger(paid) || paid > installmentCents) throw new Error('Pagamento excede saldo da parcela');
  return installmentCents - paid;
}
