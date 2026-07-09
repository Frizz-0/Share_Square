import type { CurrencyCode, DirectDebt, Expense, Roommate, SplitType } from '../types';

export function convertToGBP(amount: number, fromCurrency: CurrencyCode, fxRates: Record<string, number>): number {
  const rate = fxRates[fromCurrency] || 1;
  return amount / rate;
}

export function computeSplits(
  splitType: SplitType,
  amountInGBP: number,
  activeMembers: Roommate[],
  options: {
    selectiveMembers?: Record<string, boolean>;
    customValues?: Record<string, string>;
    currency?: CurrencyCode;
    fxRates?: Record<string, number>;
  } = {}
): Record<string, number> {
  const computedSplitsGBP: Record<string, number> = {};

  if (splitType === 'EQUAL') {
    const perPersonShareGBP = amountInGBP / activeMembers.length;
    activeMembers.forEach(m => { computedSplitsGBP[m.name] = perPersonShareGBP; });
  } else if (splitType === 'SELECTIVE') {
    const selectiveMembers = options.selectiveMembers || {};
    const selectedList = activeMembers.filter(m => selectiveMembers[m.name] !== false);
    const denominator = selectedList.length > 0 ? selectedList.length : 1;
    const perPersonShareGBP = amountInGBP / denominator;
    activeMembers.forEach(m => {
      computedSplitsGBP[m.name] = selectiveMembers[m.name] !== false ? perPersonShareGBP : 0;
    });
  } else {
    const customValues = options.customValues || {};
    const currency = options.currency || 'GBP';
    const fxRates = options.fxRates || { GBP: 1 };
    activeMembers.forEach(m => {
      computedSplitsGBP[m.name] = convertToGBP(parseFloat(customValues[m.name]) || 0, currency, fxRates);
    });
  }

  return computedSplitsGBP;
}

export function getMinimizedDebts(
  expenses: Expense[],
  activeMembers: Roommate[],
  activeGroupId: string,
  activeInstanceId: string
): DirectDebt[] {
  const netBalances: Record<string, number> = {};
  activeMembers.forEach(m => { netBalances[m.name] = 0; });

  const targetedExpenses = expenses.filter(e => e.groupId === activeGroupId && e.instanceId === activeInstanceId);

  targetedExpenses.forEach(exp => {
    if (!exp.splits) return;
    activeMembers.forEach(m => {
      const share = exp.splits[m.name] || 0;
      if (exp.paidBy === m.name) netBalances[m.name] += (exp.convertedAmountGBP - share);
      else netBalances[m.name] -= share;
    });
  });

  const debtors = activeMembers.map(m => ({ name: m.name, bal: netBalances[m.name] })).filter(x => x.bal < -0.01).sort((a, b) => a.bal - b.bal);
  const creditors = activeMembers.map(m => ({ name: m.name, bal: netBalances[m.name] })).filter(x => x.bal > 0.01).sort((a, b) => b.bal - a.bal);

  const optimizedDebts: DirectDebt[] = [];
  let i = 0, j = 0;

  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];
    const amountToSettle = Math.min(Math.abs(debtor.bal), creditor.bal);

    optimizedDebts.push({ from: debtor.name, to: creditor.name, amount: amountToSettle });
    debtor.bal += amountToSettle;
    creditor.bal -= amountToSettle;

    if (Math.abs(debtor.bal) < 0.01) i++;
    if (creditor.bal < 0.01) j++;
  }
  return optimizedDebts;
}

export function computeUserNetGBP(
  expenses: Expense[],
  activeGroupId: string,
  activeInstanceId: string,
  activeUserName: string
): number {
  let balanceGBP = 0;

  expenses
    .filter(e => e.groupId === activeGroupId && e.instanceId === activeInstanceId)
    .forEach(exp => {
      if (!exp.splits) return;
      const share = exp.splits[activeUserName] || exp.splits['You'] || 0;
      if (exp.paidBy === activeUserName || exp.paidBy === 'You') {
        balanceGBP += (exp.convertedAmountGBP - share);
      } else {
        balanceGBP -= share;
      }
    });

  return balanceGBP;
}

export function getUnallocatedPoolAmount(amount: string, customValues: Record<string, string>, activeMembers: Roommate[]): number {
  const totalInputBill = parseFloat(amount) || 0;
  const allocatedSum = activeMembers.reduce((sum, m) => sum + (parseFloat(customValues[m.name]) || 0), 0);
  return totalInputBill - allocatedSum;
}
