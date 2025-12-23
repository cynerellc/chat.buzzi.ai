import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, gte, lte } from "drizzle-orm";

import { requireCompanyAdmin } from "@/lib/auth/guards";
import { getCurrentCompany } from "@/lib/auth/tenant";
import { db } from "@/lib/db";
import { paymentHistory } from "@/lib/db/schema";

export interface PaymentHistoryItem {
  id: string;
  amount: string;
  currency: string;
  status: string;
  invoiceNumber: string | null;
  invoiceUrl: string | null;
  periodStart: string;
  periodEnd: string;
  createdAt: string;
}

export async function GET(request: NextRequest) {
  try {
    await requireCompanyAdmin();
    const company = await getCurrentCompany();

    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "12", 10);
    const year = searchParams.get("year");

    const offset = (page - 1) * limit;

    // Build conditions
    const conditions = [eq(paymentHistory.companyId, company.id)];

    if (year) {
      const startDate = new Date(`${year}-01-01`);
      const endDate = new Date(`${year}-12-31`);
      conditions.push(gte(paymentHistory.createdAt, startDate));
      conditions.push(lte(paymentHistory.createdAt, endDate));
    }

    // Get payment history
    const payments = await db
      .select()
      .from(paymentHistory)
      .where(and(...conditions))
      .orderBy(desc(paymentHistory.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count
    const allPayments = await db
      .select({ id: paymentHistory.id })
      .from(paymentHistory)
      .where(and(...conditions));

    const total = allPayments.length;

    // Calculate totals
    const totalPaid = payments
      .filter((p) => p.status === "paid")
      .reduce((sum, p) => sum + parseFloat(p.amount), 0);

    const response: PaymentHistoryItem[] = payments.map((payment) => ({
      id: payment.id,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      invoiceNumber: payment.invoiceNumber,
      invoiceUrl: payment.invoiceUrl,
      periodStart: payment.periodStart.toISOString(),
      periodEnd: payment.periodEnd.toISOString(),
      createdAt: payment.createdAt.toISOString(),
    }));

    return NextResponse.json({
      payments: response,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      summary: {
        totalPaid: totalPaid.toFixed(2),
        currency: payments[0]?.currency || "USD",
        paymentCount: payments.filter((p) => p.status === "paid").length,
      },
    });
  } catch (error) {
    console.error("Error fetching payment history:", error);
    return NextResponse.json(
      { error: "Failed to fetch payment history" },
      { status: 500 }
    );
  }
}
