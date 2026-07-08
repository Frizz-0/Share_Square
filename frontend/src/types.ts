export interface Roommate {
    id: number;
    name: string;
    avatar: string;
}

export interface GroupInstance {
    id: string;
    name: string;
}

export interface Group {
    id: string;
    name: string;
    icon: string;
    memberIds: number[];
    instances: GroupInstance[];
}

export type SplitType = 'EQUAL' | 'EXACT' | 'SELECTIVE';
export type CurrencyCode = 'GBP' | 'USD' | 'EUR' | 'INR' | 'JPY';
export type AnalyticsTimeframe = 'WEEK' | 'MONTH' | 'SELECT_MONTH';

export interface Expense {
    id: number;
    groupId: string;
    instanceId: string;
    title: string;
    paidBy: string; // Dynamic trace key matching Roommate.name strings
    amount: number;
    currency: CurrencyCode;
    convertedAmountGBP: number;
    date: string;
    note?: string;
    splitType: SplitType;
    splits: Record<string, number>;
    isSettlement?: boolean;
    isRecurring?: boolean;
    recurringDay?: number;
    attachmentName?: string;
}

export interface AuditLog {
    id: number;
    groupId: string;
    timestamp: string;
    action: string;
    details: string;
}

export interface DirectDebt {
    from: string;
    to: string;
    amount: number;
}