import fs = require("node:fs");
import path = require("node:path");
import { invoiceServiceDetails } from "./invoicePresentation";
import { pdfText } from "./invoicePresentation";
import { invoiceDisplayStatus, invoiceTerms } from "./billingPolicy";
import PDFDocument = require("pdfkit");
import { v2 as cloudinary } from "cloudinary";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { getManualInvoiceDetails } from "./manualInvoice";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

type InvoiceForPdf = Prisma.InvoiceGetPayload<{
  include: {
    user: true;
    adjustments: true;
    lines: true;
    invoiceBookings: true;
    allocations: { include: { payment: true } };
    creditNotes: true;
    emailLogs: true;
    auditEvents: true;
    booking: {
      include: {
        quote: true;
        payments: true;
        vehicle: true;
        driver: true;
        pod: true;
      };
    };
  };
}>;

type PdfInvoiceInput = Omit<
  InvoiceForPdf,
  "status" | "finalisedAt" | "issuedAt" | "supplyDate"
> & {
  status: string;
  finalisedAt: Date | null;
  issuedAt: Date | null;
  supplyDate: Date | null;
};

function money(value: Prisma.Decimal | number | string) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(Number(value));
}

function date(value: Date | null | undefined) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value);
}

function clean(value: string | null | undefined) {
  return value?.trim() || "-";
}

function ensureCloudinaryConfigured() {
  if (
    !process.env.CLOUDINARY_CLOUD_NAME?.trim() ||
    !process.env.CLOUDINARY_API_KEY?.trim() ||
    !process.env.CLOUDINARY_API_SECRET?.trim()
  ) {
    throw new Error(
      "Cloudinary must be configured before an invoice can be finalised.",
    );
  }
}

export async function renderInvoicePdf(invoice: PdfInvoiceInput): Promise<Buffer> {
  const settings = await prisma.companySettings.findFirst();
  if (!settings?.companyName?.trim()) throw new Error("Company settings and name are required before rendering invoices.");
  const archived = invoice.archivedCustomerId ? await prisma.customerArchive.findUnique({ where: { id: invoice.archivedCustomerId }, select: { snapshot: true } }) : null;
  const snapshot = archived?.snapshot;
  const user = invoice.user || (snapshot && typeof snapshot === "object" && !Array.isArray(snapshot) ? snapshot as unknown as InvoiceForPdf["user"] : null);
  const manual = getManualInvoiceDetails(invoice);
  const paid = invoice.allocations.reduce((n, row) => n.add(row.amount), new Prisma.Decimal(0));
  const credited = invoice.creditNotes.filter(row => row.status === "ISSUED").reduce((n, row) => n.add(row.amount), new Prisma.Decimal(0));
  const outstanding = Prisma.Decimal.max(new Prisma.Decimal(0), invoice.total.sub(paid).sub(credited));
  const issuedAt = invoice.issuedAt || invoice.finalisedAt || invoice.createdAt;
  const dueDate = user?.accountType === "BUSINESS" ? invoiceTerms("BUSINESS", issuedAt).dueDate : invoice.dueDate;
  const ids = [...new Set(invoice.invoiceBookings.map(row => row.bookingId))];
  const bookings = ids.length ? await prisma.booking.findMany({ where: { id: { in: ids } }, include: { quote: true }, orderBy: { collectionDate: "asc" } }) : invoice.booking ? [invoice.booking] : [];
  const primary = bookings[0];
  const q = primary?.quote;
  const name = manual?.recipientName || user?.companyName || user?.name || q?.companyName || q?.customerName || "Guest customer";
  const billingAddress = manual?.recipientAddress || [user?.registeredAddressLine1, user?.registeredAddressLine2, user?.registeredTownCity, user?.registeredCounty, user?.registeredPostcode, user?.registeredCountry].filter(Boolean).join(", ");
  const customer = [name, billingAddress, manual?.recipientEmail || user?.accountsEmail || user?.email || q?.customerEmail,
    manual?.recipientPhone ? `Tel: ${manual.recipientPhone}` : null, user?.accountNumber ? `Account: ${user.accountNumber}` : null].filter(Boolean).join("\n");
  const refs = [user?.accountType ? `Account type: ${user.accountType === "TRADE" ? "Trade Account" : user.accountType === "BUSINESS" ? "Business Account" : "Private Account"}` : "Guest customer",
    `Payment terms: ${user?.accountType === "BUSINESS" ? "Due immediately" : invoice.paymentTerms || "As agreed"}`,
    invoice.purchaseOrderNumber ? `PO / order: ${invoice.purchaseOrderNumber}` : null,
    invoice.customerReference ? `Customer reference: ${invoice.customerReference}` : null].filter(Boolean).join("\n");
  const chunks: Buffer[] = [];
  const doc = new PDFDocument({ size: "A4", margins: { top: 40, bottom: 30, left: 42, right: 42 }, info: { Title: `Invoice ${invoice.invoiceNumber}`, Author: settings.companyName } });
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const completed = new Promise<Buffer>((resolve, reject) => { doc.on("end", () => resolve(Buffer.concat(chunks))); doc.on("error", reject); });
  const navy = "#071D49", blue = "#006CFF", grey = "#526179", light = "#F4F8FF", border = "#DCE6F5";
  const left = 42, right = doc.page.width - 42, width = right - left;
  let y = 40, page = 1;
  const bottom = () => doc.page.height - 64;
  const footer = () => {
    const label = pdfText(`${settings.companyName}${settings.companyRegistrationNumber ? ` | Company No ${settings.companyRegistrationNumber}` : ""}${settings.vatNumber ? ` | VAT No ${settings.vatNumber}` : ""}`);
    doc.font("Helvetica").fontSize(6.5).fillColor(grey).text(label, left, doc.page.height - 43, { width: width - 38, lineBreak: false });
    doc.text(String(page), right - 28, doc.page.height - 43, { width: 28, align: "right", lineBreak: false });
  };
  const nextPage = () => {
    footer(); doc.addPage(); page++; y = 40;
    doc.font("Helvetica-Bold").fontSize(10).fillColor(navy).text(`INVOICE ${invoice.invoiceNumber} - continued`, left, y, { width });
    y += 25;
  };
  const ensure = (height: number) => { if (y + height > bottom()) nextPage(); };
  // Wrap first, then paginate individual lines. Long addresses/instructions cannot overflow a page.
  const wrap = (value: string, available: number, size = 8, bold = false) => {
    doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(size);
    const result: string[] = [];
    for (const paragraph of pdfText(value).split("\n")) {
      let line = "";
      for (const word of paragraph.split(/\s+/).filter(Boolean)) {
        if (doc.widthOfString(line ? `${line} ${word}` : word) <= available) { line = line ? `${line} ${word}` : word; continue; }
        if (line) result.push(line); line = "";
        for (const char of word) {
          if (line && doc.widthOfString(line + char) > available) { result.push(line); line = ""; }
          line += char;
        }
      }
      result.push(line);
    }
    return result;
  };
  const flow = (value: string, size = 8, bold = false, indent = 0) => {
    for (const line of wrap(value, width - indent, size, bold)) {
      ensure(size + 5);
      doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(size).fillColor(bold ? navy : grey).text(line, left + indent, y, { width: width - indent, lineBreak: false });
      y += size + 4;
    }
  };
  // Supplied brand asset, bundled with the backend. Its generous image margins are clipped here.
  const logo = path.resolve(__dirname, "../../assets/invoice-logo.png");
  if (fs.existsSync(logo)) {
    doc.roundedRect(left, 40, 256, 61, 5).fill(navy);
    doc.save().rect(left, 40, 256, 61).clip();
    doc.image(logo, left, -17, { width: 256 }); doc.restore();
  } else {
    doc.font("Helvetica-Bold").fontSize(20).fillColor(navy).text(settings.companyName, left, 42, { width: 265 });
  }
  doc.font("Helvetica-Bold").fontSize(25).fillColor(blue).text("INVOICE", 338, 42, { width: right - 338, align: "right" });
  const company = [settings.companyName, settings.companyAddress, settings.telephone ? `Tel: ${settings.telephone}` : null,
    settings.email, settings.website, settings.companyRegistrationNumber ? `Company No: ${settings.companyRegistrationNumber}` : null,
    settings.vatNumber ? `VAT No: ${settings.vatNumber}` : null].filter(Boolean).join("\n");
  doc.font("Helvetica").fontSize(7.5).fillColor(grey);
  const companyLines = wrap(company, 270, 7.5);
  companyLines.forEach((line, i) => doc.text(line, left, 109 + i * 10, { width: 270, lineBreak: false }));
  const meta = [["Invoice No", invoice.invoiceNumber], ["Status", invoiceDisplayStatus(invoice.status)], ["Issue date", date(issuedAt)],
    ["Supply date", date(invoice.supplyDate || primary?.collectionDate)], ["Due date", date(dueDate)]];
  meta.forEach(([label, value], i) => {
    const row = 85 + i * 16;
    doc.font("Helvetica").fontSize(8).fillColor(grey).text(label, 340, row, { width: 75, lineBreak: false });
    doc.font("Helvetica-Bold").fillColor(navy).text(pdfText(value), 416, row, { width: right - 416, align: "right", lineBreak: false });
  });
  y = Math.max(182, 109 + companyLines.length * 10 + 14);
  const customerLines = wrap(customer, 260, 8), referenceLines = wrap(refs, 205, 8);
  // If exceptional billing details are long, flow them safely instead of overflowing a fixed box.
  const boxHeight = Math.max(customerLines.length, referenceLines.length) * 12 + 40;
  if (boxHeight < 260) {
    ensure(boxHeight);
    doc.roundedRect(left, y, width, boxHeight, 6).fill(light);
    doc.font("Helvetica-Bold").fontSize(9).fillColor(navy).text("BILL TO", left + 12, y + 12, { lineBreak: false });
    doc.text("INVOICE DETAILS", right - 217, y + 12, { width: 205, align: "right", lineBreak: false });
    doc.font("Helvetica").fontSize(8);
    customerLines.forEach((line, i) => doc.text(line, left + 12, y + 31 + i * 12, { width: 260, lineBreak: false }));
    referenceLines.forEach((line, i) => doc.text(line, right - 217, y + 31 + i * 12, { width: 205, align: "right", lineBreak: false }));
    y += boxHeight + 16;
  } else { flow("BILL TO", 9, true); flow(customer); flow("INVOICE DETAILS", 9, true); flow(refs); y += 10; }

  const tableHeader = () => {
    ensure(30);
    doc.rect(left, y, width, 23).fill(navy);
    doc.font("Helvetica-Bold").fontSize(7.5).fillColor("white");
    for (const [label, x, w] of [["Description", left + 8, 270], ["Qty", 320, 30], ["Unit (net)", 357, 62], ["VAT", 426, 40], ["Gross", 474, 71]] as const)
      doc.text(label, x, y + 8, { width: w, align: label === "Description" ? "left" : "right", lineBreak: false });
    y += 23;
  };
  // Booking details are part of the invoice description, once per booking, including multi-drop/return stops.
  for (const booking of bookings) {
    ensure(55); flow(`Courier service - ${booking.reference}`, 9, true);
    for (const detail of invoiceServiceDetails(booking)) flow(detail, 7.5);
    y += 9;
  }
  // Retain saved booking snapshots if an operational booking is no longer available.
  for (const row of invoice.invoiceBookings.filter(row => !bookings.some(b => b.id === row.bookingId))) {
    flow(`Booking ${row.bookingReference}`, 9, true);
    flow(row.routeDescription || "Route not recorded"); y += 8;
  }
  tableHeader();
  const lines = invoice.lines.length ? invoice.lines : [{ description: "Courier service", quantity: new Prisma.Decimal(1), unitPrice: invoice.subtotal,
    vatRate: invoice.subtotal.equals(0) ? new Prisma.Decimal(0) : invoice.vatAmount.div(invoice.subtotal).mul(100), grossAmount: invoice.total, bookingReference: primary?.reference }];
  for (const line of lines) {
    const description = line.bookingReference && !line.description.includes(line.bookingReference) ? `${line.description}\nBooking: ${line.bookingReference}` : line.description;
    const pieces = wrap(description, 264, 8);
    let first = true;
    while (pieces.length) {
      if (y + 30 > bottom()) { nextPage(); tableHeader(); }
      const count = Math.max(1, Math.floor((bottom() - y - 14) / 12));
      const segment = pieces.splice(0, count), height = Math.max(29, segment.length * 12 + 14);
      doc.font("Helvetica").fontSize(8).fillColor(navy);
      segment.forEach((text, i) => doc.text(text, left + 8, y + 7 + i * 12, { width: 264, lineBreak: false }));
      if (first) {
        doc.text(Number(line.quantity).toString(), 320, y + 7, { width: 30, align: "right", lineBreak: false });
        doc.text(money(line.unitPrice), 357, y + 7, { width: 62, align: "right", lineBreak: false });
        doc.text(`${Number(line.vatRate)}%`, 426, y + 7, { width: 40, align: "right", lineBreak: false });
        doc.text(money(line.grossAmount), 474, y + 7, { width: 71, align: "right", lineBreak: false });
        first = false;
      }
      doc.strokeColor(border).moveTo(left, y + height).lineTo(right, y + height).stroke(); y += height;
    }
  }
  y += 12; ensure(124);
  const totals = [["Subtotal (net)", invoice.subtotal], ["VAT", invoice.vatAmount], ["Total", invoice.total], ["Payments received", paid], ["Credit notes", credited], ["Outstanding", outstanding]] as const;
  totals.forEach(([label, value], i) => {
    const row = y + i * 18, strong = label === "Total" || label === "Outstanding";
    if (strong) doc.roundedRect(330, row - 3, right - 330, 18, 3).fill(light);
    doc.font(strong ? "Helvetica-Bold" : "Helvetica").fontSize(8.5).fillColor(strong ? navy : grey).text(label, 338, row, { width: 111, lineBreak: false });
    doc.font("Helvetica-Bold").fillColor(navy).text(money(value), 450, row, { width: right - 458, align: "right", lineBreak: false });
  });
  y += 122;
  const bank = [settings.bankAccountName ? `Account name: ${settings.bankAccountName}` : null, settings.bankName ? `Bank: ${settings.bankName}` : null,
    settings.sortCode ? `Sort code: ${settings.sortCode}` : null, settings.accountNumber ? `Account number: ${settings.accountNumber}` : null,
    `Payment reference: ${invoice.invoiceNumber}`].filter(Boolean).join("\n");
  const bankLines = wrap(bank, 270, 8), bankHeight = Math.max(78, bankLines.length * 12 + 24);
  ensure(bankHeight);
  doc.font("Helvetica-Bold").fontSize(9).fillColor(navy).text("PAYABLE BY BANK TRANSFER TO", left, y, { width: 275, lineBreak: false });
  doc.font("Helvetica").fontSize(8).fillColor(grey);
  bankLines.forEach((line, i) => doc.text(line, left, y + 18 + i * 12, { width: 275, lineBreak: false }));
  doc.roundedRect(338, y - 5, right - 338, 72, 5).fill(light);
  doc.font("Helvetica-Bold").fontSize(9).fillColor(navy).text("AMOUNT DUE", 348, y + 5, { width: right - 358, align: "right", lineBreak: false });
  doc.fontSize(20).fillColor(blue).text(money(outstanding), 348, y + 23, { width: right - 358, align: "right", lineBreak: false });
  doc.font("Helvetica").fontSize(8).fillColor(grey).text(`Due ${date(dueDate)}`, 348, y + 49, { width: right - 358, align: "right", lineBreak: false });
  y += bankHeight + 9;
  if (invoice.notes) { flow("INVOICE NOTES", 9, true); flow(invoice.notes); y += 8; }
  flow(settings.footerMessage || "Thank you for your business", 8);
  footer(); doc.end(); return completed;
}

async function uploadPdf(buffer: Buffer, invoiceNumber: string) {
  ensureCloudinaryConfigured();

  const publicId = `streamline-logistics/invoices/${invoiceNumber}`;

  const result = await new Promise<{ secure_url: string; public_id: string }>(
    (resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          resource_type: "raw",
          public_id: publicId,
          overwrite: false,
          unique_filename: false,
          use_filename: false,
        },
        (error, uploadResult) => {
          if (error || !uploadResult?.secure_url || !uploadResult.public_id) {
            reject(error || new Error("Cloudinary did not return the stored PDF."));
            return;
          }
          resolve({
            secure_url: uploadResult.secure_url,
            public_id: uploadResult.public_id,
          });
        },
      );

      stream.end(buffer);
    },
  );

  return {
    url: result.secure_url,
    storageKey: result.public_id,
  };
}

export async function generateAndStoreInvoicePdf(input: {
  invoice: PdfInvoiceInput;
}) {
  if (input.invoice.pdfUrl || input.invoice.pdfStorageKey) {
    throw new Error(
      "This invoice already has an issued PDF. Financial changes must use a credit note.",
    );
  }

  const buffer = await renderInvoicePdf(input.invoice);
  const stored = await uploadPdf(buffer, input.invoice.invoiceNumber);

  return {
    ...stored,
    buffer,
  };
}

export async function getStoredInvoicePdfBuffer(invoice: PdfInvoiceInput) {
  if (invoice.status === "DRAFT") throw new Error("Pending invoices cannot be emailed as issued invoices.");
  // Render current settlement status; the issued PDF remains an audit snapshot.
  return renderInvoicePdf(invoice);
}
