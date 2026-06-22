import { type NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { wallets, tokens } = await request.json();

    if (!wallets || !tokens) {
      return Response.json({ error: 'Missing wallets or tokens data' }, { status: 400 });
    }

    // Build header row
    const tokenHeaders = tokens.map((t: any) => `${t.symbol} (${t.mint.slice(0, 4)}...)`).join(',');
    const csvHeader = `Wallet Address,Tokens Held,Estimated Total USD,${tokenHeaders}`;

    const csvRows = wallets.map((w: any) => {
      const walletAddr = w.wallet;
      const count = w.count;
      const totalUsd = w.estimatedTotalUsd?.toFixed(2) ?? '0.00';

      // Balance per token
      const balances = tokens.map((t: any) => {
        const held = w.tokens.find((ht: any) => ht.mint === t.mint);
        return held ? held.balance.toFixed(4) : '0';
      }).join(',');

      return `"${walletAddr}",${count},${totalUsd},${balances}`;
    });

    const csv = [csvHeader, ...csvRows].join('\n');

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="holder-overlap.csv"',
      },
    });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}