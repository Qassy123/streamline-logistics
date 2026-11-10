import { adminSections, canAdminRequest } from "./centralAdmin";

type Workflow = {
  id: string;
  title: string;
  section: string;
  href: string;
  method: "GET" | "POST" | "PATCH";
  route: string;
  roles?: readonly string[];
  steps: readonly string[];
};

const workflows: readonly Workflow[] = [
  {
    id: "dispatch-booking", title: "Assign or reassign a booking to a driver", section: "drivers",
    href: "/admin/drivers", method: "POST", route: "/api/admin/drivers/example/assign-job",
    steps: [
      "Open Drivers → Driver dispatch → Assign vans & jobs. Search for the released booking by reference or address. Use Unassigned only to narrow the list.",
      "Choose Select job, or Review / reassign if it already has a driver. An active journey cannot be reassigned here.",
      "Choose an active driver and a van that meets the booking's requirements. If the van has changed, choose Save van to driver first.",
      "Review the job timing and enter a reason if reassigning it to a different driver. Choose Assign job and check the result. Address any eligibility or compliance error shown by dispatch before retrying.",
    ],
  },
  {
    id: "consolidate-invoices", title: "Generate a consolidated invoice for a Trade account", section: "invoices",
    href: "/admin/customers", method: "POST", route: "/api/invoices/admin/monthly-summary/example",
    steps: [
      "Open Customers and select the Trade account. In its account view, expand Consolidated invoices.",
      "Choose the Invoice month. The dropdown lists eligible months with a balance due.",
      "Choose Generate consolidated invoice and review the draft and the included balances before finalising it.",
      "Choose Finalise. Check the customer and recipient details before choosing Email customer.",
    ],
  },
  {
    id: "finalise-invoice", title: "Review, finalise and send a draft invoice", section: "invoices",
    href: "/admin/invoices", method: "POST", route: "/api/invoices/admin/example/finalise",
    steps: [
      "Open Invoices and select the draft. Check the customer, charges, VAT and total.",
      "For a contract invoice, resolve any cancelled or unused shift charges first. Trade invoices can only be finalised from their scheduled issue date.",
      "Choose Finalise and confirm. This locks the financial values.",
      "Use Send Invoice when ready and confirm the recipient.",
    ],
  },
  {
    id: "record-invoice-payment", title: "Record a payment against an individual invoice", section: "invoices",
    href: "/admin/invoices", method: "POST", route: "/api/invoices/admin/example/record-payment",
    steps: [
      "Open Invoices and select the individual invoice. Check its reference and outstanding balance against the payment actually received.",
      "Choose Record Payment, enter the actual amount and the payment details requested by the form, then review the entry.",
      "Submit using Record Payment and check the updated paid and outstanding amounts.",
    ],
  },
  {
    id: "approve-timesheet", title: "Review, approve and lock a driver timesheet", section: "driver-hours",
    href: "/admin/driver-hours", method: "POST", route: "/api/admin/driver-hours/example/review",
    roles: ["SUPER_ADMIN", "OFFICE_MANAGER", "ACCOUNTS"],
    steps: [
      "Open Driver Hours, choose the driver and date range, then open Timesheets.",
      "Review attendance, recorded work, breaks, payable time, overtime and calculated gross. Resolve displayed warnings before approving.",
      "Enter a review reason of at least five characters. Choose Approve & lock payroll and confirm, or Reject for correction if the period needs changes.",
      "Once approved, use Download approved CSV if you need the locked payroll snapshot. Approval does not make a bank payment.",
    ],
  },
  {
    id: "contract-weekly-mileage", title: "Review commercial contract weekly mileage and shift charges", section: "commercial-tariffs",
    href: "/admin/customers", method: "PATCH", route: "/api/admin/commercial-contracts/example/example/weekly-review",
    steps: [
      "Open the customer account and its commercial contract. Select the relevant month and find Monthly Billing Review.",
      "Use Needs billing review for shifts that need a charge decision. Confirm or waive charges for cancelled or unused shifts after checking the circumstances.",
      "Where weekly mileage is enabled, choose Review week. Check estimated, included and actual miles and enter the actual mileage for the week.",
      "Check any excess mileage and its charge, then choose Save weekly mileage. Weekly mileage goes on the invoice for the month the week ends in, while shift fares stay with their service dates.",
    ],
  },
  {
    id: "download-delivery-evidence", title: "Find proof of delivery and download an evidence pack", section: "vehicle-records",
    href: "/admin/vehicle-records", method: "GET", route: "/api/admin/vehicle-records/evidence",
    steps: [
      "Open Vehicle Records and select the Evidence view. Find the booking by its reference.",
      "Choose View collection, delivery & signatures to inspect the saved stop records, photos, signatures and any exceptions.",
      "Choose Download PDF evidence pack to keep a copy of the available evidence.",
    ],
  },
];

export function adminAssistantWorkflows(role: string) {
  const sections = adminSections(role);
  return workflows.filter(workflow =>
    sections.includes(workflow.section) &&
    (!workflow.roles || workflow.roles.includes(role)) &&
    canAdminRequest(role, workflow.route, workflow.method));
}
