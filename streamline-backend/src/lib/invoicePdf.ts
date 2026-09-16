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
  const border = "#DCE6F5";
  const pageWidth = doc.page.width - 92;

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

  const accountName =
    invoice.user?.companyName || invoice.user?.name || "Guest customer";

  const billingAddress = [
    invoice.user?.registeredAddressLine1,
    invoice.user?.registeredAddressLine2,
    invoice.user?.registeredTownCity,
    invoice.user?.registeredCounty,
    invoice.user?.registeredPostcode,
    invoice.user?.registeredCountry,
  ]
    .filter(Boolean)
    .join(", ");

  const booking = invoice.booking;
  const quote = booking?.quote;
  const routeDescription =
    quote?.collectionAddress && quote?.deliveryAddress
      ? `${quote.collectionAddress} to ${quote.deliveryAddress}`
      : null;

  const drawFooter = () => {
    doc.fillColor(grey).font("Helvetica").fontSize(7).text(
      `${settings.companyName}${settings.companyRegistrationNumber ? ` · Company No ${settings.companyRegistrationNumber}` : ""}${settings.vatNumber ? ` · VAT No ${settings.vatNumber}` : ""}`,
      46,
      doc.page.height - 54,
      { width: pageWidth, align: "center" },
    );
  };

  const addPage = () => {
    drawFooter();
    doc.addPage();
  };

  doc.fillColor(navy).font("Helvetica-Bold").fontSize(22);
  doc.text(settings.companyName, 46, 46, { width: 330 });
  doc.fillColor(blue).fontSize(26).text("INVOICE", 390, 46, {
    width: 158,
    align: "right",
  });

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
  doc.text(companyDetails.join("\n"), 46, 82, { width: 300 });

  const infoX = 350;
  const infoY = 90;
  const infoRows = [
    ["Invoice No", invoice.invoiceNumber],
    ["Status", invoice.status.replace(/_/g, " ")],
    ["Issue Date", date(invoice.issuedAt || invoice.finalisedAt)],
    ["Supply Date", date(invoice.supplyDate)],
    ["Due Date", date(invoice.dueDate)],
  ];
  infoRows.forEach(([label, value], index) => {
    const rowY = infoY + index * 16;
    doc.fillColor(grey).font("Helvetica").fontSize(8).text(label, infoX, rowY, {
      width: 76,
    });
    doc.fillColor(navy).font("Helvetica-Bold").text(value, infoX + 78, rowY, {
      width: 120,
      align: "right",
    });
  });

  let y = 180;
  doc.roundedRect(46, y, pageWidth, 100, 6).fill(light);
  doc.fillColor(navy).font("Helvetica-Bold").fontSize(10).text("BILL TO", 60, y + 13);
  doc.fillColor(navy).font("Helvetica").fontSize(9);
  const customerDetails = [
    accountName,
    billingAddress || null,
    invoice.user?.email,
    invoice.user?.accountNumber
      ? `Account: ${invoice.user.accountNumber}`
      : null,
  ].filter(Boolean) as string[];
  doc.text(customerDetails.join("\n"), 60, y + 31, { width: 250 });

  doc.fillColor(navy).font("Helvetica-Bold").fontSize(10).text("INVOICE DETAILS", 330, y + 13, {
    width: 205,
    align: "right",
  });
  doc.fillColor(navy).font("Helvetica").fontSize(9);
  const refs = [
    invoice.purchaseOrderNumber
      ? `PO / Order Ref: ${invoice.purchaseOrderNumber}`
      : null,
    invoice.customerReference
      ? `Customer Ref: ${invoice.customerReference}`
      : null,
    invoice.paymentTerms ? `Payment Terms: ${invoice.paymentTerms}` : null,
    booking?.reference ? `Booking: ${booking.reference}` : null,
  ].filter(Boolean) as string[];
  doc.text(refs.length ? refs.join("\n") : "-", 330, y + 31, {
    width: 205,
    align: "right",
  });

  y += 118;

  if (booking || routeDescription) {
    doc.roundedRect(46, y, pageWidth, 72, 6).strokeColor(border).stroke();
    doc.fillColor(navy).font("Helvetica-Bold").fontSize(9).text("DELIVERY DETAILS", 60, y + 12);
    doc.fillColor(grey).font("Helvetica").fontSize(8);
    const deliveryDetails = [
      booking?.reference ? `Booking reference: ${booking.reference}` : null,
      routeDescription ? `Journey: ${routeDescription}` : null,
      booking?.collectionDate ? `Collection date: ${date(booking.collectionDate)}` : null,
      booking?.vehicle?.registration
        ? `Vehicle: ${booking.vehicle.registration}`
        : null,
    ].filter(Boolean) as string[];
    doc.text(deliveryDetails.join("\n"), 60, y + 29, { width: pageWidth - 28 });
    y += 88;
  }

  const drawTableHeader = () => {
    doc.rect(46, y, pageWidth, 24).fill(navy);
    doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(8);
    doc.text("Description", 55, y + 8, { width: 235 });
    doc.text("Qty", 300, y + 8, { width: 40, align: "right" });
    doc.text("Unit", 350, y + 8, { width: 76, align: "right" });
    doc.text("VAT", 436, y + 8, { width: 42, align: "right" });
    doc.text("Gross", 486, y + 8, { width: 52, align: "right" });
    y += 24;
  };

  const newPageIfNeeded = (height = 34) => {
    if (y + height <= doc.page.height - 90) return;
    addPage();
    y = 50;
    drawTableHeader();
  };

  drawTableHeader();

  const lines = invoice.lines.length
    ? invoice.lines
    : [
        {
          description: booking
            ? `Courier service · ${booking.reference}`
            : "Courier service",
          quantity: new Prisma.Decimal(1),
          unitPrice: invoice.subtotal,
          vatRate: invoice.subtotal.equals(0)
            ? new Prisma.Decimal(0)
            : invoice.vatAmount.div(invoice.subtotal).mul(100),
          grossAmount: invoice.total,
          bookingReference: booking?.reference || null,
        },
      ];

  lines.forEach((line) => {
    const description = line.bookingReference
      ? `${line.description}\nBooking: ${line.bookingReference}`
      : line.description;
    const rowHeight = line.bookingReference ? 38 : 30;
    newPageIfNeeded(rowHeight + 2);
    doc.fillColor(navy).font("Helvetica").fontSize(8);
    doc.text(description, 55, y + 7, { width: 235 });
    doc.text(Number(line.quantity).toString(), 300, y + 7, {
      width: 40,
      align: "right",
    });
    doc.text(money(line.unitPrice), 350, y + 7, {
      width: 76,
      align: "right",
    });
    doc.text(`${Number(line.vatRate).toFixed(0)}%`, 436, y + 7, {
      width: 42,
      align: "right",
    });
    doc.text(money(line.grossAmount), 486, y + 7, {
      width: 52,
      align: "right",
    });
    doc.strokeColor(border).moveTo(46, y + rowHeight).lineTo(548, y + rowHeight).stroke();
    y += rowHeight;
  });

  y += 16;
  if (y + 145 > doc.page.height - 90) {
    addPage();
    y = 50;
  }

  const totalsX = 334;
  const totals = [
    ["Subtotal (net)", money(invoice.subtotal)],
    ["VAT", money(invoice.vatAmount)],
    ["Total", money(invoice.total)],
    ["Payments received", money(amountPaid)],
    ["Credit notes", money(credited)],
    ["Outstanding", money(outstanding)],
  ];
  totals.forEach(([label, value], index) => {
    const rowY = y + index * 19;
    const important = label === "Total" || label === "Outstanding";
    if (important) {
      doc.roundedRect(totalsX - 8, rowY - 4, 214, 18, 3).fill(light);
    }
    doc.fillColor(important ? navy : grey)
      .font(important ? "Helvetica-Bold" : "Helvetica")
      .fontSize(important ? 10 : 9)
      .text(label, totalsX, rowY, { width: 105 });
    doc.fillColor(navy)
      .font("Helvetica-Bold")
      .text(value, totalsX + 108, rowY, { width: 90, align: "right" });
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
      .map((includedBooking) => {
        const po = includedBooking.poReference ? ` · PO ${includedBooking.poReference}` : "";
        return `${includedBooking.bookingReference}${po}\n${date(includedBooking.bookingDate)} · ${includedBooking.routeDescription}`;
      })
      .join("\n\n");
    doc.text(bookingText, 46, y + 18, { width: 255 });
  } else if (booking) {
    doc.fillColor(navy).font("Helvetica-Bold").fontSize(9).text("BOOKING", 46, y);
    doc.fillColor(grey).font("Helvetica").fontSize(8);
    doc.text(
      `${booking.reference}${routeDescription ? `\n${routeDescription}` : ""}`,
      46,
      y + 18,
      { width: 255 },
    );
  }

  y = Math.max(y + 138, doc.y + 24);
  if (y > doc.page.height - 180) {
    addPage();
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

  doc.fillColor(navy).font("Helvetica-Bold").fontSize(9).text("AMOUNT DUE", 350, y, {
    width: 188,
    align: "right",
  });
  doc.fillColor(blue).font("Helvetica-Bold").fontSize(18).text(
    money(outstanding),
    350,
    y + 18,
    { width: 188, align: "right" },
  );
  doc.fillColor(grey).font("Helvetica").fontSize(8).text(
    `Due ${date(invoice.dueDate)}`,
    350,
    y + 43,
    { width: 188, align: "right" },
  );

  if (settings.footerMessage) {
    doc.fillColor(grey).font("Helvetica").fontSize(8);
    doc.text(settings.footerMessage, 46, y + 82, { width: pageWidth });
  }

  drawFooter();

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
