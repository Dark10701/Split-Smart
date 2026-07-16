import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatMoney } from './api';
import type { BalanceSheet } from './balances';

function safeFileBase(sheet: BalanceSheet): string {
  const slug = sheet.groupName.replace(/[^\w]+/g, '-').replace(/^-+|-+$/g, '') || 'group';
  return `SplitSmart-${slug}-balance-sheet`;
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Human date like "16 Jul 2026". */
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/** A professional, multi-section PDF balance sheet. */
export function downloadBalanceSheetPdf(sheet: BalanceSheet): void {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 40;
  const money = (m: number): string => formatMoney(m, sheet.currency);

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(20, 24, 40);
  doc.text('SplitSmart', marginX, 50);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(120, 120, 130);
  doc.text('Group balance sheet', marginX, 68);

  doc.setFontSize(15);
  doc.setTextColor(20, 24, 40);
  doc.setFont('helvetica', 'bold');
  doc.text(sheet.groupName, marginX, 96);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(120, 120, 130);
  doc.text(
    `Generated ${fmtDate(sheet.generatedAt)}  ·  ${sheet.members.length} members  ·  Total expenses ${money(
      sheet.totalExpensesMinor,
    )}`,
    marginX,
    112,
  );

  // Members: contributions, shares, net
  autoTable(doc, {
    startY: 132,
    head: [['Member', 'Contributed', 'Share', 'Net']],
    body: sheet.members.map((m) => [
      m.name,
      money(m.contributedMinor),
      money(m.shareMinor),
      `${m.netMinor >= 0 ? '+' : '-'}${money(Math.abs(m.netMinor))}`,
    ]),
    foot: [
      [
        'Total',
        money(sheet.members.reduce((s, m) => s + m.contributedMinor, 0)),
        money(sheet.members.reduce((s, m) => s + m.shareMinor, 0)),
        '',
      ],
    ],
    theme: 'striped',
    headStyles: { fillColor: [22, 104, 214], textColor: 255 },
    footStyles: { fillColor: [240, 242, 247], textColor: [20, 24, 40], fontStyle: 'bold' },
    columnStyles: {
      1: { halign: 'right' },
      2: { halign: 'right' },
      3: { halign: 'right' },
    },
    margin: { left: marginX, right: marginX },
  });

  // Outstanding balances (who owes whom)
  const afterMembers = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable
    .finalY;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(20, 24, 40);
  doc.text('Outstanding balances', marginX, afterMembers + 28);
  autoTable(doc, {
    startY: afterMembers + 36,
    head: [['From', 'To', 'Amount']],
    body:
      sheet.outstanding.length > 0
        ? sheet.outstanding.map((o) => [o.fromName, o.toName, money(o.amountMinor)])
        : [['Everyone is settled up', '', '']],
    theme: 'grid',
    headStyles: { fillColor: [22, 104, 214], textColor: 255 },
    columnStyles: { 2: { halign: 'right' } },
    margin: { left: marginX, right: marginX },
  });

  // Expense history
  const afterOutstanding = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable
    .finalY;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(20, 24, 40);
  doc.text('Expense history', marginX, afterOutstanding + 28);
  autoTable(doc, {
    startY: afterOutstanding + 36,
    head: [['Date', 'Description', 'Paid by', 'Amount']],
    body:
      sheet.expenses.length > 0
        ? sheet.expenses.map((e) => [
            fmtDate(e.date),
            e.description,
            e.payerName,
            money(e.amountMinor),
          ])
        : [['—', 'No expenses yet', '', '']],
    theme: 'striped',
    headStyles: { fillColor: [22, 104, 214], textColor: 255 },
    columnStyles: { 3: { halign: 'right' } },
    margin: { left: marginX, right: marginX },
  });

  // Footer page numbers
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 160);
    doc.text(
      `SplitSmart · ${sheet.groupName} · page ${i} of ${pages}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 20,
      { align: 'center' },
    );
  }

  doc.save(`${safeFileBase(sheet)}.pdf`);
}

/** CSV with clearly labelled sections, quoted fields. */
export function downloadBalanceSheetCsv(sheet: BalanceSheet): void {
  const q = (v: string | number): string => `"${String(v).replace(/"/g, '""')}"`;
  const major = (m: number): string => (m / 100).toFixed(2);
  const lines: string[] = [];

  lines.push(q('SplitSmart — Group balance sheet'));
  lines.push([q('Group'), q(sheet.groupName)].join(','));
  lines.push([q('Currency'), q(sheet.currency)].join(','));
  lines.push([q('Generated'), q(fmtDate(sheet.generatedAt))].join(','));
  lines.push([q('Total expenses'), q(major(sheet.totalExpensesMinor))].join(','));
  lines.push('');

  lines.push(q('Members'));
  lines.push(['Member', 'Contributed', 'Share', 'Net'].map(q).join(','));
  for (const m of sheet.members) {
    lines.push(
      [q(m.name), q(major(m.contributedMinor)), q(major(m.shareMinor)), q(major(m.netMinor))].join(
        ',',
      ),
    );
  }
  lines.push('');

  lines.push(q('Outstanding balances'));
  lines.push(['From', 'To', 'Amount'].map(q).join(','));
  for (const o of sheet.outstanding) {
    lines.push([q(o.fromName), q(o.toName), q(major(o.amountMinor))].join(','));
  }
  lines.push('');

  lines.push(q('Expense history'));
  lines.push(['Date', 'Description', 'Paid by', 'Amount'].map(q).join(','));
  for (const e of sheet.expenses) {
    lines.push(
      [q(fmtDate(e.date)), q(e.description), q(e.payerName), q(major(e.amountMinor))].join(','),
    );
  }

  // BOM so Excel reads UTF-8 (₹, names) correctly.
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, `${safeFileBase(sheet)}.csv`);
}
