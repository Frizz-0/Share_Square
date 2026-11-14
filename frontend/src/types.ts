export interface Roommate {
    name: string;
    avatar: string;
    clerkId: string;
}

export interface GroupInstance {
    id: string;
    name: string;
}

export interface Group {
    id: string;
    name: string;
    icon: string;
    inviteCode?: string;
    memberIds: string[];
    instances: GroupInstance[];
}

export type SplitType = 'EQUAL' | 'EXACT' | 'SELECTIVE';
export type CurrencyCode = 'GBP' | 'USD' | 'EUR' | 'INR' | 'JPY';
export type AnalyticsTimeframe = 'WEEK' | 'MONTH' | 'SELECT_MONTH';

export interface ExpenseItem {
    id: string;
    name: string;
    qty?: number;
    price?: number;
}

export interface Expense {
    id: number;
    groupId: string;
    instanceId: string;
    title: string;
    paidBy: string;
    userId?: string;
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
    items?: ExpenseItem[];
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

export type NoticeCategory = 'ANNOUNCEMENT' | 'EVENT' | 'TASK' | 'URGENT';
export interface Notice {
    groupId: string;
    expenseId: string;
    text: string;
    category?: NoticeCategory;
    eventDate?: string;
    acks?: string[];
    postedBy: string;
    postedByName: string;
    date: string;
}