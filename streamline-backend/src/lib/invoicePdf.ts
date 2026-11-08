import {bookingPriceBreakdown} from "./bookingPriceBreakdown";
import {orderedRoute} from "./invoicePresentation";
import {randomUUID} from "crypto";
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

export async function renderInvoicePdf(
  invoice: PdfInvoiceInput,
  summary?: { month: string; invoices: PdfInvoiceInput[] },
): Promise<Buffer> {
  const settings = await prisma.companySettings.findFirst();
  if (!settings?.companyName?.trim()) throw new Error("Company settings and name are required before rendering invoices.");
  const companyName = "Streamline Logistics Group LTD";
  const archived = invoice.archivedCustomerId ? await prisma.customerArchive.findUnique({ where: { id: invoice.archivedCustomerId }, select: { snapshot: true } }) : null;
  const snapshot = archived?.snapshot;
  const user = invoice.user || (snapshot && typeof snapshot === "object" && !Array.isArray(snapshot) ? snapshot as unknown as InvoiceForPdf["user"] : null);
  const manual = getManualInvoiceDetails(invoice);
  const paid = invoice.allocations.reduce((n, row) => n.add(row.amount), new Prisma.Decimal(0));
  const credited = invoice.creditNotes.filter(row => row.status === "ISSUED").reduce((n, row) => n.add(row.amount), new Prisma.Decimal(0));
  const outstanding = Prisma.Decimal.max(new Prisma.Decimal(0), invoice.total.sub(paid).sub(credited));
  const issuedAt = invoice.issuedAt || invoice.finalisedAt || invoice.createdAt;
  const dueDate = user?.accountType === "BUSINESS" ? invoiceTerms("BUSINESS", issuedAt).dueDate : invoice.dueDate;
  const sources = summary?.invoices || [invoice];
  const ids = [...new Set(sources.flatMap(source => source.invoiceBookings.map(row => row.bookingId)))];
  const linkedBookings = ids.length
    ? await prisma.booking.findMany({ where: { id: { in: ids } }, include: { quote: true }, orderBy: { collectionDate: "asc" } })
    : [];
  const bookingGroups = sources.map(source => {
    const linked = linkedBookings.filter(booking => source.invoiceBookings.some(row => row.bookingId === booking.id));
    return { source, bookings: linked.length ? linked : source.booking ? [source.booking] : [] };
  });
  const primary = summary ? undefined : bookingGroups[0].bookings[0];
  const q = primary?.quote;
  const name = manual?.recipientName || user?.companyName || user?.name || q?.companyName || q?.customerName || "Guest customer";
  const billingAddress = manual?.recipientAddress || [user?.registeredAddressLine1, user?.registeredAddressLine2, user?.registeredTownCity, user?.registeredCounty, user?.registeredPostcode, user?.registeredCountry].filter(Boolean).join(", ");
  const customer = [name, billingAddress, manual?.recipientEmail || user?.accountsEmail || user?.email || q?.customerEmail,
    manual?.recipientPhone || user?.phone || q?.customerPhone ? `Tel: ${manual?.recipientPhone || user?.phone || q?.customerPhone}` : null, user?.accountNumber ? `Account: ${user.accountNumber}` : null].filter(Boolean).join("\n");
  const paymentReference = summary ? invoice.invoiceNumber : `INV-${invoice.invoiceNumber}`;
  const chunks: Buffer[] = [];
  const doc = new PDFDocument({ size: "A4", margins: { top: 40, bottom: 30, left: 42, right: 42 }, info: { Title: `Invoice ${invoice.invoiceNumber}`, Author: companyName } });
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const completed = new Promise<Buffer>((resolve, reject) => { doc.on("end", () => resolve(Buffer.concat(chunks))); doc.on("error", reject); });
  const navy="#071D49",blue="#006CFF",grey="#526179",light="#F1F6FD",border="#DCE3ED";
  const left=42,right=doc.page.width-42,width=right-left;
  let y=40,page=1;
  const wrap=(value:string,available:number,size=8.5,bold=false)=>{
    doc.font(bold?"Helvetica-Bold":"Helvetica").fontSize(size);
    const result:string[]=[];
    for(const paragraph of pdfText(value).split("\n")){
      let line="";
      for(const word of paragraph.split(/\s+/).filter(Boolean)){
        if(doc.widthOfString(line?`${line} ${word}`:word)<=available){line=line?`${line} ${word}`:word;continue;}
        if(line)result.push(line);line="";
        for(const char of word){if(line&&doc.widthOfString(line+char)>available){result.push(line);line="";}line+=char;}
      }
      result.push(line);
    }
    return result;
  };
  const text=(value:string,x:number,top:number,w:number,size=8.5,bold=false,color=navy,align:"left"|"right"="left")=>{
    doc.font(bold?"Helvetica-Bold":"Helvetica").fontSize(size).fillColor(color).text(pdfText(value),x,top,{width:w,align,lineBreak:false});
  };
  const companyFooter=[`${settings.footerMessage||"Thank you for your business."} | ${companyName}`,settings.companyAddress,[settings.telephone,settings.email,settings.website].filter(Boolean).join(" | "),
    [settings.companyRegistrationNumber?`Company No ${settings.companyRegistrationNumber}`:null,settings.vatNumber?`VAT No ${settings.vatNumber}`:null].filter(Boolean).join(" | ")].filter(Boolean).flatMap(v=>wrap(v!,width-35,6.5));
  const footerTop=()=>doc.page.height-30-companyFooter.length*9;
  const bottom=()=>footerTop()-20;
  const footer=()=>{companyFooter.forEach((v,i)=>text(v,left,footerTop()+i*9,width-35,6.5,false,grey));text(String(page),right-25,footerTop(),25,7,false,grey,"right");};
  const nextPage=()=>{footer();doc.addPage();page++;y=40;text(`INVOICE ${invoice.invoiceNumber} - continued`,left,y,width,10,true);y+=28;};
  const ensure=(h:number)=>{if(y+h>bottom())nextPage();};
  const flow=(value:string,size=8.5,bold=false,color=navy)=>{for(const line of wrap(value,width,size,bold)){ensure(size+5);text(line,left,y,width,size,bold,color);y+=size+4;}};
  const rule=()=>{doc.strokeColor(border).lineWidth(0.6).moveTo(left,y).lineTo(right,y).stroke();};
  // Use the existing supplied logo, with its transparent image margins clipped.
  const logo=path.resolve(__dirname,"../../assets/invoice-logo.png");
  if (fs.existsSync(logo)) {
    doc.roundedRect(left, 40, 235, 54, 4).fill(navy);
    doc.save().rect(left, 40, 235, 54).clip();
    doc.image(logo, left, 40 - 53, { width: 235 });
    doc.restore();
    // Keep the existing mark and wordmark, and print the full legal suffix on its second line.
    doc.rect(left + 94, 64, 105, 8).fill(navy);
    text("L O G I S T I C S  G R O U P  L T D", left + 95, 65, 105, 6.3, true, "#008CFF");
    doc.strokeColor("#008CFF").lineWidth(0.6).moveTo(left + 198, 68).lineTo(left + 205, 68).stroke();
  } else {
    text(companyName, left, 43, 270, 15, true);
  }
  text(summary ? "CONSOLIDATED INVOICE" : "INVOICE",330,40,right-330,summary ? 13 : 27,true,navy,"right");
  text(invoice.invoiceNumber,330,73,right-330,16,true,blue,"right");
  const status=invoiceDisplayStatus(invoice.status),statusColor=status==="PAID"?"#15803D":status==="UNPAID/DUE"?"#9A4A00":blue;
  text(status,330,96,right-330,9,true,statusColor,"right");
  y=119;doc.strokeColor(blue).lineWidth(1.5).moveTo(left,y).lineTo(right,y).stroke();y+=20;
  const accountType=invoice.billingAccountType||user?.accountType;
  const accountLabel=accountType==="TRADE"?"Trade account":accountType==="BUSINESS"?"Business account":user?"Customer account":"Guest customer";
  const meta = [["Issue date", date(summary ? invoice.issuedAt : issuedAt)], ["Due date", date(dueDate)], ["Account type", accountLabel]];
  if (summary) meta.push(["Invoice month", summary.month]);
  if (invoice.invoiceType !== "CONSOLIDATED") meta.splice(2, 0, ["Supply date", date(invoice.supplyDate || primary?.collectionDate)]);
  text("BILL TO",left,y,260,9,true);const customerLines=wrap(customer,260,8.5);const customerStart=y+19;
  if(customerLines.length<16){customerLines.forEach((v,i)=>text(v,left,customerStart+i*12,260,8.5,i===0));meta.forEach(([label,value],i)=>{text(label,335,y+i*19,85,8,false,grey);text(value,420,y+i*19,right-420,8.5,true,navy,"right");});y+=Math.max(80,customerLines.length*12+22);}
  else{y+=19;flow(customer);y+=8;for(const [label,value]of meta)flow(`${label}: ${value}`);y+=12;}
  if(invoice.purchaseOrderNumber)flow(`PO / order: ${invoice.purchaseOrderNumber}`,8,false,grey);
  if(invoice.customerReference)flow(`Customer reference: ${invoice.customerReference}`,8,false,grey);
  // Terms are shown once; saved dates and financial values are never recalculated here.
  flow(`Payment terms: ${accountType==="BUSINESS"?"Due immediately":invoice.paymentTerms||"As agreed"}`,7.5,false,grey);y+=16;
  type DisplayLine={description:string;quantity:number;unitPrice:Prisma.Decimal;net:Prisma.Decimal;vatRate?:number};
  const dec=(v:Prisma.Decimal|number|string)=>new Prisma.Decimal(v);
  const rateSet=[...new Set(invoice.lines.map(l=>Number(l.vatRate)).filter(Number.isFinite))];
  const savedLine=(l:InvoiceForPdf["lines"][number]):DisplayLine=>{
    const net=l.chargeType==="DISCOUNT"?l.netAmount.abs().negated():l.netAmount,quantity=Number(l.quantity);
    const savedRate=l.chargeType==="DISCOUNT"?l.unitPrice.abs().negated():l.unitPrice;
    // Percentage adjustments store a percentage as unitPrice; display its monetary rate.
    const unitPrice=quantity&&!savedRate.mul(quantity).toDecimalPlaces(2).equals(net)?net.div(quantity):savedRate;
    const description = /mileage/i.test(l.description) || l.chargeType === "MILEAGE"
      ? l.description.replace(/\((?:miles|mi)\)/gi, "(per mile)")
      : l.description;
    return {description:l.chargeType === "MILEAGE" && !/per mile/i.test(description) ? `${description} (per mile)` : description,quantity,unitPrice,net,vatRate:Number(l.vatRate)};
  };
  const header=()=>{ensure(50);doc.rect(left,y,width,23).fill(navy);for(const [label,x,w,align]of [["Description",left+8,260,"left"],["Qty",310,40,"right"],["Rate (net)",358,86,"right"],["Net",450,right-458,"right"]] as const)text(label,x,y+7,w,8,true,"white",align);y+=23;};
  const table=(rows:DisplayLine[])=>{
    if(!rows.length)return;header();
    for(const row of rows){
      const desc=row.description+(rateSet.length>1&&row.vatRate!==undefined?`\nVAT ${row.vatRate}%`:"");
      const pieces=wrap(desc,260,8.5);let first=true;
      while(pieces.length){
        if(y+32>bottom()){nextPage();header();}
        const count=Math.max(1,Math.floor((bottom()-y-14)/12));const segment=pieces.splice(0,count),h=Math.max(27,segment.length*12+14);
        segment.forEach((v,i)=>text(v,left+8,y+8+i*12,260,8.5));
        if(first){text(new Intl.NumberFormat("en-GB",{maximumFractionDigits:3}).format(row.quantity),310,y+8,40,8.5,false,navy,"right");text(money(row.unitPrice),358,y+8,86,8.5,false,navy,"right");text(money(row.net),450,y+8,right-458,8.5,true,navy,"right");first=false;}
        y+=h;rule();
      }
    }
    y+=15;
  };
  for (const { source, bookings } of bookingGroups) {
    const used = new Set<InvoiceForPdf["lines"][number]>();
    if (summary) {
      ensure(120);
      flow(`INVOICE ${source.invoiceNumber}`, 11, true, blue);
      if (source.purchaseOrderNumber) flow(`PO / order: ${source.purchaseOrderNumber}`, 8, false, grey);
      if (source.customerReference) flow(`Customer reference: ${source.customerReference}`, 8, false, grey);
      y += 5;
    }
    for(const booking of bookings){
      ensure(105);flow(summary||bookings.length>1?`BOOKING ${booking.reference}`:"SERVICE DETAILS",10,true);
      if(!summary&&bookings.length===1)flow(`Booking ${booking.reference}`,8,false,grey);
      const routes=orderedRoute(booking).map(pdfText),details=invoiceServiceDetails(booking).filter(d=>!routes.includes(d));
      // Compact service metadata, with each full address and instruction retained.
      for(const detail of details.filter(d=>/^Collection:/.test(d)))flow(detail,8,false,grey);
      const service=details.filter(d=>/^(Service:|Journey type:|Vehicle:)/.test(d)).map(d=>d.replace(/^(Service:|Journey type:|Vehicle:) /,""));
      if(service.length)flow(service.join(" | "),8,false,grey);
      y+=5;for(const route of routes)flow(route,8.5);
      const extras=details.filter(d=>!/^(Collection:|Service:|Journey type:|Vehicle:)/.test(d));
      if(extras.length){y+=4;const short=extras.filter(d=>!/^Special instructions:|^Handover notes:/.test(d));if(short.length)flow(short.join(" | "),7.5,false,grey);for(const extra of extras.filter(d=>/^Special instructions:|^Handover notes:/.test(d)))flow(extra,7.5,false,grey);}
      y+=10;
      const matches=source.lines.filter(l=>l.bookingId===booking.id||l.bookingReference===booking.reference);
      const baseLines=matches.filter(l=>l.chargeType==="BASE_SERVICE"&&l.sourceType!=="ADJUSTMENT"&&l.sourceType!=="MANUAL");
      const rows:DisplayLine[]=[];
      if((baseLines.length&&!matches.some(l=>["MILEAGE","EXTRA_STOP"].includes(l.chargeType)))||(!source.lines.length&&booking.quote)){
        const b=bookingPriceBreakdown(booking),snapshot=source.invoiceBookings.find(r=>r.bookingId===booking.id);
        const savedNet=baseLines.length?baseLines.reduce((n,l)=>n.add(l.netAmount),dec(0)):snapshot?.netAmount??dec(b.subtotal);
        const add=(description:string,quantity:number,unitPrice:number,net:number)=>{if(net!==0)rows.push({description,quantity,unitPrice:dec(unitPrice),net:dec(net),vatRate:baseLines.length?Number(baseLines[0].vatRate):b.vatRate});};
        add(`Base fare - ${booking.vehicleType||booking.quote?.vehicleSize||"Courier service"}`,1,b.base,b.base);
        add("Journey mileage (per mile)",b.miles||1,b.miles?b.mileageRate:b.mileage,b.mileage);
        add("Additional stops",b.stopCount||1,b.stopCount?b.stops/b.stopCount:b.stops,b.stops);
        add("Booking discount",1,-b.discount,-b.discount);
        const difference=dec(savedNet).sub(dec(b.base).add(b.mileage).add(b.stops).sub(b.discount)).toDecimalPlaces(2);
        if(!difference.isZero())rows.push({description:"Booking price adjustment",quantity:1,unitPrice:difference,net:difference});
        if(!rows.length)rows.push({description:"Courier service",quantity:1,unitPrice:dec(savedNet),net:dec(savedNet)});
        baseLines.forEach(l=>used.add(l));
      }
      for(const l of matches){if(used.has(l))continue;rows.push(savedLine(l));used.add(l);}
      if(bookings.length===1&&source.invoiceBookings.every(r=>r.bookingId===booking.id))for(const l of source.lines){if(!used.has(l)){rows.push(savedLine(l));used.add(l);}}
      table(rows);
    }
    for(const row of source.invoiceBookings.filter(r=>!bookings.some(b=>b.id===r.bookingId))){ensure(60);flow(`BOOKING ${row.bookingReference}`,10,true);flow(`Collected ${date(row.bookingDate)}`,8,false,grey);if(row.routeDescription)flow(row.routeDescription,8.5);if(row.serviceDescription)flow(row.serviceDescription,8,false,grey);if(row.poReference)flow(`PO / order: ${row.poReference}`,8,false,grey);y+=9;const rows=source.lines.filter(l=>!used.has(l)&&(l.bookingId===row.bookingId||l.bookingReference===row.bookingReference));rows.forEach(l=>used.add(l));table(rows.map(savedLine));}
    const remaining=source.lines.filter(l=>!used.has(l));
    if(remaining.length){if(bookings.length){ensure(65);flow("ADDITIONAL CHARGES & DISCOUNTS",9,true);y+=7;}table(remaining.map(savedLine));}
    else if(!source.lines.length&&!bookings.length)table([{description:"Courier service",quantity:1,unitPrice:source.subtotal,net:source.subtotal}]);
  }
  y+=4;
  const totals:[string,Prisma.Decimal][]=[["Subtotal",invoice.subtotal],[!summary&&rateSet.length===1?`VAT (${rateSet[0]}%)`:"VAT",invoice.vatAmount],["TOTAL",invoice.total]];
  if(paid.greaterThan(0))totals.push(["Payments received",paid]);if(credited.greaterThan(0))totals.push(["Credit notes",credited]);
  ensure(totals.length*21+15);
  for(const [label,value]of totals){const strong=label==="TOTAL";if(strong){doc.strokeColor(border).moveTo(330,y-4).lineTo(right,y-4).stroke();}text(label,330,y,130,strong?10:8.5,strong,navy);text(money(value),465,y,right-465,strong?11:9,true,navy,"right");y+=strong?23:19;}
  y+=10;
  if (!summary && status === "PAID") {
    const references = [...new Set(invoice.allocations.flatMap(({ payment }) =>
      payment?.provider === "MANUAL" && payment.notes?.startsWith("Cleared by consolidated invoice ") && payment.reference
        ? [payment.reference]
        : [],
    ))];
    if (references.length) {
      flow(`Cleared by consolidated payment: ${references.join(", ")}`, 8.5, true);
      y += 8;
    }
  }
  const bank=[`Business name: ${companyName}`,settings.bankAccountName && !/^streamline logistics group(?: ltd)?$/i.test(settings.bankAccountName.trim())?`Account name: ${settings.bankAccountName}`:null,settings.bankName?`Bank: ${settings.bankName}`:null,settings.sortCode?`Sort code: ${settings.sortCode}`:null,settings.accountNumber?`Account number: ${settings.accountNumber}`:null].filter((v):v is string=>Boolean(v)).flatMap(v=>wrap(v,270,8));
  const bankHeight=Math.max(103,bank.length*12+59);ensure(bankHeight+14);rule();y+=15;
  text("PAYMENT DETAILS",left,y,270,9,true);bank.forEach((v,i)=>text(v,left,y+20+i*12,270,8,false,grey));
  const refY=y+22+bank.length*12;text(`BACS reference: ${paymentReference}`,left,refY,270,9,true,blue);text(summary ? "Use this reference for one full transfer." : "Use this exact reference when paying.",left,refY+16,270,7.5,false,grey);
  doc.rect(335,y, right-335,88).fill(light);text("AMOUNT DUE",347,y+12,right-359,9,true);text(money(outstanding),347,y+31,right-359,23,true,blue);text(status==="PAID"?"Paid in full":`Pay by ${date(dueDate)}`,347,y+65,right-359,8.5,false,grey);
  y+=bankHeight+10;
  if(invoice.notes){ensure(32);flow("INVOICE NOTES",9,true);flow(invoice.notes,8,false,grey);y+=8;}
  footer();doc.end();return completed;
}

async function uploadPdf(buffer: Buffer, invoiceNumber: string) {
  ensureCloudinaryConfigured();

  const publicId = `streamline-logistics/invoices/${invoiceNumber}/${randomUUID()}`;

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
