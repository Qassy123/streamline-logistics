import PDFDocument = require("pdfkit");
import { v2 as cloudinary } from "cloudinary";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

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

async function renderInvoicePdf(
  invoice: PdfInvoiceInput,
): Promise<Buffer> {
  const settings = await prisma.companySettings.findFirst();

  if (!settings) {
    throw new Error(
      "Company settings must be configured before an invoice can be finalised.",
    );
  }

  if (!settings.companyName?.trim()) {
    throw new Error("Company name is required in Company Info / Settings.");
  }

  const chunks: Buffer[] = [];
  const doc = new PDFDocument({
    size: "A4",
    margin: 46,
    info: {
      Title: `Invoice ${invoice.invoiceNumber}`,
      Author: settings.companyName,
      Subject: `Invoice ${invoice.invoiceNumber}`,
    },
  });

  doc.on("data", (chunk: Buffer) => chunks.push(chunk));

  const completed = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const navy = "#071D49";
  const blue = "#006CFF";
  const grey = "#64748B";
  const light = "#F4F8FF";
  const pageWidth = doc.page.width - 92;

  doc.fillColor(navy).font("Helvetica-Bold").fontSize(22);
  doc.text(settings.companyName, 46, 46, { width: 330 });
  doc.fillColor(blue).fontSize(26).text("INVOICE", 390, 46, {
    width: 158,
    align: "right",
  });

  doc.moveDown(0.5);
  doc.fillColor(grey).font("Helvetica").fontSize(9);
  const companyDetails = [
    settings.companyAddress,
    settings.telephone ? `Tel: ${settings.telephone}` : null,
    settings.email ? `Email: ${settings.email}` : null,
    settings.website ? `Web: ${settings.website}` : null,
    settings.companyRegistrationNumber
      ? `Company No: ${settings.companyRegistrationNumber}`
      : null,
    settings.vatNumber ? `VAT No: ${settings.vatNumber}` : null,
  ].filter(Boolean) as string[];
  doc.text(companyDetails.join("\n"), 46, 82, { width: 320 });

  const infoX = 360;
  const infoY = 90;
  const infoRows = [
    ["Invoice No", invoice.invoiceNumber],
    ["Issue Date", date(invoice.issuedAt)],
    ["Supply Date", date(invoice.supplyDate)],
    ["Due Date", date(invoice.dueDate)],
  ];
  infoRows.forEach(([label, value], index) => {
    const y = infoY + index * 17;
    doc.fillColor(grey).font("Helvetica").fontSize(8).text(label, infoX, y, {
      width: 70,
    });
    doc.fillColor(navy).font("Helvetica-Bold").text(value, infoX + 72, y, {
      width: 116,
      align: "right",
    });
  });

  let y = Math.max(174, doc.y + 14);
  doc.roundedRect(46, y, pageWidth, 86, 6).fill(light);
  doc.fillColor(navy).font("Helvetica-Bold").fontSize(10).text("BILL TO", 60, y + 13);
  doc.fillColor(navy).font("Helvetica").fontSize(9);
  const accountName =
    invoice.user?.companyName || invoice.user?.name || "Guest customer";
  const customerDetails = [
    accountName,
    [
      invoice.user?.registeredAddressLine1,
      invoice.user?.registeredAddressLine2,
      invoice.user?.registeredTownCity,
      invoice.user?.registeredCounty,
      invoice.user?.registeredPostcode,
      invoice.user?.registeredCountry,
    ]
      .filter(Boolean)
      .join(", "),
    invoice.user?.email,
    invoice.user?.accountNumber
      ? `Account: ${invoice.user.accountNumber}`
      : null,
  ].filter(Boolean) as string[];
  doc.text(customerDetails.join("\n"), 60, y + 31, { width: 245 });

  const refs = [
    invoice.purchaseOrderNumber
      ? `PO / Order Ref: ${invoice.purchaseOrderNumber}`
      : null,
    invoice.customerReference
      ? `Customer Ref: ${invoice.customerReference}`
      : null,
    invoice.paymentTerms ? `Payment Terms: ${invoice.paymentTerms}` : null,
  ].filter(Boolean) as string[];
  doc.text(refs.length ? refs.join("\n") : "", 330, y + 31, {
    width: 205,
    align: "right",
  });

  y += 108;

  const drawTableHeader = () => {
    doc.rect(46, y, pageWidth, 24).fill(navy);
    doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(8);
    doc.text("Description", 55, y + 8, { width: 245 });
    doc.text("Qty", 310, y + 8, { width: 40, align: "right" });
    doc.text("Unit", 360, y + 8, { width: 70, align: "right" });
    doc.text("VAT", 440, y + 8, { width: 40, align: "right" });
    doc.text("Gross", 488, y + 8, { width: 50, align: "right" });
    y += 24;
  };

  const newPageIfNeeded = (height = 34) => {
    if (y + height <= doc.page.height - 120) return;
    doc.addPage();
    y = 50;
    drawTableHeader();
  };

  drawTableHeader();

  const lines = invoice.lines.length
    ? invoice.lines
    : [
        {
          description: invoice.booking
            ? `Courier service · ${invoice.booking.reference}`
            : "Courier service",
          quantity: new Prisma.Decimal(1),
          unitPrice: invoice.subtotal,
          vatRate: invoice.subtotal.equals(0)
            ? new Prisma.Decimal(0)
            : invoice.vatAmount.div(invoice.subtotal).mul(100),
          grossAmount: invoice.total,
          bookingReference: invoice.booking?.reference || null,
        },
      ];

  lines.forEach((line) => {
    newPageIfNeeded();
    const description = line.bookingReference
      ? `${line.description}\nBooking: ${line.bookingReference}`
      : line.description;
    const rowHeight = line.bookingReference ? 38 : 30;
    doc.fillColor(navy).font("Helvetica").fontSize(8);
    doc.text(description, 55, y + 7, { width: 245 });
    doc.text(Number(line.quantity).toString(), 310, y + 7, {
      width: 40,
      align: "right",
    });
    doc.text(money(line.unitPrice), 360, y + 7, {
      width: 70,
      align: "right",
    });
    doc.text(`${Number(line.vatRate).toFixed(0)}%`, 440, y + 7, {
      width: 40,
      align: "right",
    });
    doc.text(money(line.grossAmount), 488, y + 7, {
      width: 50,
      align: "right",
    });
    doc.strokeColor("#E2E8F0").moveTo(46, y + rowHeight).lineTo(548, y + rowHeight).stroke();
    y += rowHeight;
  });

  y += 16;
  newPageIfNeeded(115);

  const amountPaid = invoice.allocations.reduce(
    (sum, allocation) => sum.add(allocation.amount),
    new Prisma.Decimal(0),
  );
  const credited = invoice.creditNotes
    .filter((note) => note.status === "ISSUED")
    .reduce((sum, note) => sum.add(note.amount), new Prisma.Decimal(0));
  const outstanding = Prisma.Decimal.max(
    new Prisma.Decimal(0),
    invoice.total.sub(amountPaid).sub(credited),
  );

  const totalsX = 340;
  const totals = [
    ["Net", money(invoice.subtotal)],
    ["VAT", money(invoice.vatAmount)],
    ["Total", money(invoice.total)],
    ["Payments", money(amountPaid)],
    ["Credits", money(credited)],
    ["Outstanding", money(outstanding)],
  ];
  totals.forEach(([label, value], index) => {
    const rowY = y + index * 18;
    const important = label === "Total" || label === "Outstanding";
    doc.fillColor(important ? navy : grey)
      .font(important ? "Helvetica-Bold" : "Helvetica")
      .fontSize(important ? 10 : 9)
      .text(label, totalsX, rowY, { width: 90 });
    doc.fillColor(navy)
      .font("Helvetica-Bold")
      .text(value, totalsX + 95, rowY, { width: 110, align: "right" });
  });

  if (invoice.invoiceBookings.length > 0) {
    doc.fillColor(navy).font("Helvetica-Bold").fontSize(9).text(
      invoice.invoiceBookings.length > 1 ? "BOOKINGS INCLUDED" : "BOOKING",
      46,
      y,
      { width: 250 },
    );
    doc.fillColor(grey).font("Helvetica").fontSize(8);
    const bookingText = invoice.invoiceBookings
      .map((booking) => {
        const po = booking.poReference ? ` · PO ${booking.poReference}` : "";
        return `${booking.bookingReference}${po}\n${date(booking.bookingDate)} · ${booking.routeDescription}`;
      })
      .join("\n\n");
    doc.text(bookingText, 46, y + 18, { width: 265 });
  }

  y = Math.max(y + 130, doc.y + 24);
  if (y > doc.page.height - 170) {
    doc.addPage();
    y = 50;
  }

  doc.fillColor(navy).font("Helvetica-Bold").fontSize(9).text("PAYMENT DETAILS", 46, y);
  doc.fillColor(grey).font("Helvetica").fontSize(8);
  const bankDetails = [
    settings.bankName ? `Bank: ${settings.bankName}` : null,
    settings.bankAccountName
      ? `Account Name: ${settings.bankAccountName}`
      : null,
    settings.sortCode ? `Sort Code: ${settings.sortCode}` : null,
    settings.accountNumber ? `Account Number: ${settings.accountNumber}` : null,
  ].filter(Boolean) as string[];
  doc.text(
    bankDetails.length
      ? bankDetails.join("\n")
      : "Payment instructions are available from Streamline Logistics Group.",
    46,
    y + 17,
    { width: 300 },
  );

  if (settings.footerMessage) {
    doc.text(settings.footerMessage, 46, y + 82, { width: pageWidth });
  }

  doc.fillColor(grey).font("Helvetica").fontSize(7).text(
    `${settings.companyName}${settings.companyRegistrationNumber ? ` · Company No ${settings.companyRegistrationNumber}` : ""}${settings.vatNumber ? ` · VAT No ${settings.vatNumber}` : ""}`,
    46,
    doc.page.height - 54,
    { width: pageWidth, align: "center" },
  );

  doc.end();
  return completed;
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

export async function getStoredInvoicePdfBuffer(invoice: {
  pdfUrl: string | null;
  status: string;
}) {
  if (!invoice.pdfUrl) {
    throw new Error("This invoice does not have a stored issued PDF.");
  }

  if (invoice.status === "DRAFT") {
    throw new Error("Draft invoices cannot be sent as issued PDFs.");
  }

  const response = await fetch(invoice.pdfUrl);

  if (!response.ok) {
    throw new Error(`Stored invoice PDF returned HTTP ${response.status}.`);
  }

  return Buffer.from(await response.arrayBuffer());
}
