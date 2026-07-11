"use client";

import {
  Download,
  ExternalLink,
  File,
  FileImage,
  FileText,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
  "http://localhost:5000";

const DOCUMENT_TYPES = [
  "CUSTOMER",
  "DRIVER",
  "VEHICLE",
  "INSURANCE",
  "MOT",
  "INVOICE",
  "PROOF_OF_DELIVERY",
  "PHOTO",
  "SIGNATURE",
  "OTHER",
] as const;

type DocumentType = (typeof DOCUMENT_TYPES)[number];

type RelatedUser = {
  id: string;
  accountNumber: string | null;
  name: string;
  companyName: string | null;
  email: string;
};

type RelatedDriver = {
  id: string;
  name: string;
  email: string;
  licenceNumber: string | null;
};

type RelatedVehicle = {
  id: string;
  name: string;
  registration: string | null;
  vehicleType: string;
};

type RelatedBooking = {
  id: string;
  reference: string;
  collectionAddress: string;
  deliveryAddress: string;
};

type RelatedQuote = {
  id: string;
  customerName: string;
  customerEmail: string;
  collectionAddress: string;
  deliveryAddress: string;
};

type RelatedInvoice = {
  id: string;
  invoiceNumber: string;
  status: string;
  total: string | number;
};

type AdminDocument = {
  id: string;
  type: DocumentType;
  name: string;
  fileUrl: string;
  mimeType: string | null;
  fileSize: number | null;
  notes: string | null;
  uploadedByAdminId: string | null;
  createdAt: string;
  updatedAt: string;
  user: RelatedUser | null;
  driver: RelatedDriver | null;
  vehicle: RelatedVehicle | null;
  booking: RelatedBooking | null;
  quote: RelatedQuote | null;
  invoice: RelatedInvoice | null;
};

type Pagination = {
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
};

type Summary = {
  total: number;
  customer: number;
  driver: number;
  vehicle: number;
  booking: number;
  invoice: number;
  byType: Record<string, number>;
};

type OptionsResponse = {
  success: boolean;
  documentTypes: DocumentType[];
  users: RelatedUser[];
  drivers: RelatedDriver[];
  vehicles: RelatedVehicle[];
  bookings: RelatedBooking[];
  quotes: RelatedQuote[];
  invoices: RelatedInvoice[];
};

type EntityType =
  | "GENERAL"
  | "CUSTOMER"
  | "DRIVER"
  | "VEHICLE"
  | "BOOKING"
  | "QUOTE"
  | "INVOICE";

type UploadFormState = {
  name: string;
  type: DocumentType;
  notes: string;
  entityType: EntityType;
  entityId: string;
  file: File | null;
};

const emptyUploadForm: UploadFormState = {
  name: "",
  type: "OTHER",
  notes: "",
  entityType: "GENERAL",
  entityId: "",
  file: null,
};

function readableLabel(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatBytes(value: number | null): string {
  if (!value) {
    return "—";
  }

  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function relatedLabel(document: AdminDocument): string {
  if (document.user) {
    return (
      document.user.companyName ||
      document.user.name ||
      document.user.email
    );
  }

  if (document.driver) {
    return document.driver.name;
  }

  if (document.vehicle) {
    return document.vehicle.registration
      ? `${document.vehicle.name} · ${document.vehicle.registration}`
      : document.vehicle.name;
  }

  if (document.booking) {
    return `Booking ${document.booking.reference}`;
  }

  if (document.quote) {
    return `Quote · ${document.quote.customerName}`;
  }

  if (document.invoice) {
    return `Invoice ${document.invoice.invoiceNumber}`;
  }

  return "General document";
}

function documentIcon(mimeType: string | null) {
  if (mimeType?.startsWith("image/")) {
    return <FileImage size={20} />;
  }

  if (mimeType === "application/pdf") {
    return <FileText size={20} />;
  }

  return <File size={20} />;
}

export default function AdminDocumentsPage() {
  const [documents, setDocuments] = useState<AdminDocument[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    pageSize: 20,
    total: 0,
    pageCount: 1,
  });
  const [summary, setSummary] = useState<Summary>({
    total: 0,
    customer: 0,
    driver: 0,
    vehicle: 0,
    booking: 0,
    invoice: 0,
    byType: {},
  });
  const [options, setOptions] = useState<OptionsResponse | null>(null);
  const [selectedDocument, setSelectedDocument] =
    useState<AdminDocument | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [uploadForm, setUploadForm] =
    useState<UploadFormState>(emptyUploadForm);
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState<DocumentType>("OTHER");
  const [editNotes, setEditNotes] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [entityFilter, setEntityFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const getAdminKey = useCallback(() => {
    return window.localStorage.getItem("streamline_admin_key") || "";
  }, []);

  const loadDocuments = useCallback(
    async (requestedPage = pagination.page) => {
      setLoading(true);
      setError("");

      try {
        const parameters = new URLSearchParams({
          page: String(requestedPage),
          pageSize: String(pagination.pageSize),
        });

        if (search) {
          parameters.set("search", search);
        }

        if (typeFilter) {
          parameters.set("type", typeFilter);
        }

        if (entityFilter) {
          parameters.set("entity", entityFilter);
        }

        const response = await fetch(
          `${API_BASE_URL}/api/admin/documents?${parameters.toString()}`,
          {
            headers: {
              "x-admin-key": getAdminKey(),
            },
            cache: "no-store",
          },
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.message || "Unable to load documents.");
        }

        setDocuments(data.documents);
        setPagination(data.pagination);
        setSummary(data.summary);

        if (selectedDocument) {
          const refreshedSelection = data.documents.find(
            (document: AdminDocument) =>
              document.id === selectedDocument.id,
          );

          if (refreshedSelection) {
            setSelectedDocument(refreshedSelection);
          }
        }
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load documents.",
        );
      } finally {
        setLoading(false);
      }
    },
    [
      entityFilter,
      getAdminKey,
      pagination.page,
      pagination.pageSize,
      search,
      selectedDocument,
      typeFilter,
    ],
  );

  const loadOptions = useCallback(async () => {
    setOptionsLoading(true);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/admin/documents/options`,
        {
          headers: {
            "x-admin-key": getAdminKey(),
          },
          cache: "no-store",
        },
      );

      const data = (await response.json()) as OptionsResponse & {
        message?: string;
      };

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to load upload options.");
      }

      setOptions(data);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load upload options.",
      );
    } finally {
      setOptionsLoading(false);
    }
  }, [getAdminKey]);

  useEffect(() => {
    void loadDocuments(1);
  }, [search, typeFilter, entityFilter]);

  useEffect(() => {
    if (uploadOpen && !options) {
      void loadOptions();
    }
  }, [loadOptions, options, uploadOpen]);

  const currentEntityOptions = useMemo(() => {
    if (!options) {
      return [];
    }

    switch (uploadForm.entityType) {
      case "CUSTOMER":
        return options.users.map((item) => ({
          id: item.id,
          label: `${item.companyName || item.name} · ${item.email}`,
        }));
      case "DRIVER":
        return options.drivers.map((item) => ({
          id: item.id,
          label: `${item.name} · ${item.email}`,
        }));
      case "VEHICLE":
        return options.vehicles.map((item) => ({
          id: item.id,
          label: item.registration
            ? `${item.name} · ${item.registration}`
            : item.name,
        }));
      case "BOOKING":
        return options.bookings.map((item) => ({
          id: item.id,
          label: `${item.reference} · ${item.collectionAddress}`,
        }));
      case "QUOTE":
        return options.quotes.map((item) => ({
          id: item.id,
          label: `${item.customerName} · ${item.customerEmail}`,
        }));
      case "INVOICE":
        return options.invoices.map((item) => ({
          id: item.id,
          label: `${item.invoiceNumber} · ${item.status}`,
        }));
      default:
        return [];
    }
  }, [options, uploadForm.entityType]);

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearch(searchInput.trim());
  }

  function clearMessages() {
    setError("");
    setSuccessMessage("");
  }

  function openUpload() {
    clearMessages();
    setUploadForm(emptyUploadForm);
    setUploadOpen(true);
  }

  function openEdit(document: AdminDocument) {
    clearMessages();
    setSelectedDocument(document);
    setEditName(document.name);
    setEditType(document.type);
    setEditNotes(document.notes || "");
    setEditOpen(true);
  }

  async function submitUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearMessages();

    if (!uploadForm.file) {
      setError("Select a file.");
      return;
    }

    if (
      uploadForm.entityType !== "GENERAL" &&
      !uploadForm.entityId
    ) {
      setError("Select the record this document belongs to.");
      return;
    }

    setSaving(true);

    try {
      const formData = new FormData();
      formData.append("file", uploadForm.file);
      formData.append("name", uploadForm.name || uploadForm.file.name);
      formData.append("type", uploadForm.type);
      formData.append("notes", uploadForm.notes);

      const entityFieldMap: Partial<Record<EntityType, string>> = {
        CUSTOMER: "userId",
        DRIVER: "driverId",
        VEHICLE: "vehicleId",
        BOOKING: "bookingId",
        QUOTE: "quoteId",
        INVOICE: "invoiceId",
      };

      const entityField = entityFieldMap[uploadForm.entityType];

      if (entityField && uploadForm.entityId) {
        formData.append(entityField, uploadForm.entityId);
      }

      const response = await fetch(
        `${API_BASE_URL}/api/admin/documents`,
        {
          method: "POST",
          headers: {
            "x-admin-key": getAdminKey(),
          },
          body: formData,
        },
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to upload document.");
      }

      setUploadOpen(false);
      setUploadForm(emptyUploadForm);
      setSuccessMessage("Document uploaded.");
      await loadDocuments(1);
      setSelectedDocument(data.document);
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Unable to upload document.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function submitEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedDocument) {
      return;
    }

    clearMessages();
    setSaving(true);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/admin/documents/${selectedDocument.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "x-admin-key": getAdminKey(),
          },
          body: JSON.stringify({
            name: editName,
            type: editType,
            notes: editNotes,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to update document.");
      }

      setSelectedDocument(data.document);
      setEditOpen(false);
      setSuccessMessage("Document updated.");
      await loadDocuments(pagination.page);
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Unable to update document.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteDocument(document: AdminDocument) {
    const confirmed = window.confirm(
      `Delete "${document.name}"? This removes the database record and attempts to remove the stored file.`,
    );

    if (!confirmed) {
      return;
    }

    clearMessages();
    setDeletingId(document.id);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/admin/documents/${document.id}`,
        {
          method: "DELETE",
          headers: {
            "x-admin-key": getAdminKey(),
          },
        },
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to delete document.");
      }

      if (selectedDocument?.id === document.id) {
        setSelectedDocument(null);
      }

      setSuccessMessage("Document deleted.");
      await loadDocuments(
        documents.length === 1 && pagination.page > 1
          ? pagination.page - 1
          : pagination.page,
      );
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Unable to delete document.",
      );
    } finally {
      setDeletingId(null);
    }
  }

  const summaryCards = [
    { label: "Total documents", value: summary.total },
    { label: "Customer", value: summary.customer },
    { label: "Driver", value: summary.driver },
    { label: "Vehicle", value: summary.vehicle },
    { label: "Booking", value: summary.booking },
    { label: "Invoice", value: summary.invoice },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#E55300]">
            Administration
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">
            Documents
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Store and manage customer, booking, driver, vehicle, invoice and
            operational documents.
          </p>
        </div>

        <button
          type="button"
          onClick={openUpload}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#FF6A00] px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#E85F00]"
        >
          <Plus size={18} />
          Upload document
        </button>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
          {error}
        </div>
      ) : null}

      {successMessage ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          {successMessage}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        {summaryCards.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-500">
              {card.label}
            </p>
            <p className="mt-3 text-3xl font-bold text-slate-950">
              {card.value}
            </p>
          </div>
        ))}
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-4 sm:p-5">
          <div className="flex flex-col gap-3 xl:flex-row">
            <form
              onSubmit={submitSearch}
              className="flex min-w-0 flex-1 gap-2"
            >
              <div className="relative min-w-0 flex-1">
                <Search
                  size={18}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Search names, notes, customers, references or registrations"
                  className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-[#FF6A00] focus:ring-2 focus:ring-orange-100"
                />
              </div>
              <button
                type="submit"
                className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Search
              </button>
            </form>

            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#FF6A00] focus:ring-2 focus:ring-orange-100"
            >
              <option value="">All document types</option>
              {DOCUMENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {readableLabel(type)}
                </option>
              ))}
            </select>

            <select
              value={entityFilter}
              onChange={(event) => setEntityFilter(event.target.value)}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#FF6A00] focus:ring-2 focus:ring-orange-100"
            >
              <option value="">All related records</option>
              <option value="GENERAL">General</option>
              <option value="CUSTOMER">Customer</option>
              <option value="DRIVER">Driver</option>
              <option value="VEHICLE">Vehicle</option>
              <option value="BOOKING">Booking</option>
              <option value="QUOTE">Quote</option>
              <option value="INVOICE">Invoice</option>
            </select>

            <button
              type="button"
              onClick={() => void loadDocuments(pagination.page)}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <RefreshCw size={17} />
              Refresh
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                {[
                  "Document",
                  "Type",
                  "Related record",
                  "Size",
                  "Uploaded",
                  "Actions",
                ].map((heading) => (
                  <th
                    key={heading}
                    className="px-5 py-3 text-left text-xs font-bold uppercase tracking-[0.08em] text-slate-500"
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-16 text-center">
                    <Loader2
                      size={24}
                      className="mx-auto animate-spin text-[#FF6A00]"
                    />
                    <p className="mt-3 text-sm text-slate-500">
                      Loading documents
                    </p>
                  </td>
                </tr>
              ) : documents.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-5 py-16 text-center text-sm text-slate-500"
                  >
                    No documents match the current filters.
                  </td>
                </tr>
              ) : (
                documents.map((document) => (
                  <tr
                    key={document.id}
                    className="cursor-pointer transition hover:bg-slate-50"
                    onClick={() => setSelectedDocument(document)}
                  >
                    <td className="px-5 py-4">
                      <div className="flex min-w-[240px] items-center gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                          {documentIcon(document.mimeType)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-slate-950">
                            {document.name}
                          </p>
                          <p className="truncate text-xs text-slate-500">
                            {document.mimeType || "Unknown file type"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex rounded-full bg-orange-50 px-2.5 py-1 text-xs font-bold text-[#D95200]">
                        {readableLabel(document.type)}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-700">
                      {relatedLabel(document)}
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-600">
                      {formatBytes(document.fileSize)}
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-600">
                      {formatDate(document.createdAt)}
                    </td>
                    <td
                      className="px-5 py-4"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <div className="flex items-center gap-1">
                        <a
                          href={document.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-950"
                          title="Open document"
                        >
                          <ExternalLink size={17} />
                        </a>
                        <button
                          type="button"
                          onClick={() => openEdit(document)}
                          className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-950"
                          title="Edit document"
                        >
                          <Pencil size={17} />
                        </button>
                        <button
                          type="button"
                          onClick={() => void deleteDocument(document)}
                          disabled={deletingId === document.id}
                          className="rounded-lg p-2 text-red-500 transition hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
                          title="Delete document"
                        >
                          {deletingId === document.id ? (
                            <Loader2 size={17} className="animate-spin" />
                          ) : (
                            <Trash2 size={17} />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-500">
            Showing page {pagination.page} of {pagination.pageCount} ·{" "}
            {pagination.total} result{pagination.total === 1 ? "" : "s"}
          </p>

          <div className="flex gap-2">
            <button
              type="button"
              disabled={pagination.page <= 1 || loading}
              onClick={() => void loadDocuments(pagination.page - 1)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={
                pagination.page >= pagination.pageCount || loading
              }
              onClick={() => void loadDocuments(pagination.page + 1)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </section>

      {selectedDocument ? (
        <aside className="fixed inset-y-0 right-0 z-50 w-full max-w-xl overflow-y-auto border-l border-slate-200 bg-white shadow-2xl">
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#E55300]">
                Document details
              </p>
              <h2 className="mt-1 truncate text-xl font-bold text-slate-950">
                {selectedDocument.name}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setSelectedDocument(null)}
              className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-950"
            >
              <X size={21} />
            </button>
          </div>

          <div className="space-y-6 p-5">
            {selectedDocument.mimeType?.startsWith("image/") ? (
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                <img
                  src={selectedDocument.fileUrl}
                  alt={selectedDocument.name}
                  className="max-h-[420px] w-full object-contain"
                />
              </div>
            ) : (
              <div className="flex min-h-52 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50">
                <div className="text-center text-slate-500">
                  <FileText size={42} className="mx-auto" />
                  <p className="mt-3 text-sm font-semibold">
                    Preview opens in a new tab
                  </p>
                </div>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <Detail label="Type" value={readableLabel(selectedDocument.type)} />
              <Detail
                label="File size"
                value={formatBytes(selectedDocument.fileSize)}
              />
              <Detail
                label="Related record"
                value={relatedLabel(selectedDocument)}
              />
              <Detail
                label="Uploaded"
                value={formatDate(selectedDocument.createdAt)}
              />
              <Detail
                label="MIME type"
                value={selectedDocument.mimeType || "—"}
              />
              <Detail
                label="Last updated"
                value={formatDate(selectedDocument.updatedAt)}
              />
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-500">
                Notes
              </p>
              <p className="mt-2 whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                {selectedDocument.notes || "No notes recorded."}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <a
                href={selectedDocument.fileUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-800"
              >
                <Download size={18} />
                Open document
              </a>

              <button
                type="button"
                onClick={() => openEdit(selectedDocument)}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              >
                <Pencil size={18} />
                Edit details
              </button>
            </div>

            <button
              type="button"
              onClick={() => void deleteDocument(selectedDocument)}
              disabled={deletingId === selectedDocument.id}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 transition hover:bg-red-100 disabled:opacity-50"
            >
              {deletingId === selectedDocument.id ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Trash2 size={18} />
              )}
              Delete document
            </button>
          </div>
        </aside>
      ) : null}

      {uploadOpen ? (
        <Modal title="Upload document" onClose={() => setUploadOpen(false)}>
          <form onSubmit={submitUpload} className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-bold text-slate-700">
                File
              </label>
              <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center transition hover:border-[#FF6A00] hover:bg-orange-50">
                <Upload size={28} className="text-slate-500" />
                <span className="mt-3 text-sm font-bold text-slate-700">
                  {uploadForm.file
                    ? uploadForm.file.name
                    : "Choose a document"}
                </span>
                <span className="mt-1 text-xs text-slate-500">
                  Maximum file size: 15 MB
                </span>
                <input
                  type="file"
                  className="hidden"
                  onChange={(event) => {
                    const selectedFile = event.target.files?.[0] || null;

                    setUploadForm((current) => ({
                      ...current,
                      file: selectedFile,
                      name: current.name || selectedFile?.name || "",
                    }));
                  }}
                  accept=".pdf,.jpg,.jpeg,.png,.webp,.gif,.txt,.doc,.docx,.xls,.xlsx"
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Display name">
                <input
                  value={uploadForm.name}
                  onChange={(event) =>
                    setUploadForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  required
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#FF6A00] focus:ring-2 focus:ring-orange-100"
                />
              </Field>

              <Field label="Document type">
                <select
                  value={uploadForm.type}
                  onChange={(event) =>
                    setUploadForm((current) => ({
                      ...current,
                      type: event.target.value as DocumentType,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#FF6A00] focus:ring-2 focus:ring-orange-100"
                >
                  {DOCUMENT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {readableLabel(type)}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Related record type">
                <select
                  value={uploadForm.entityType}
                  onChange={(event) =>
                    setUploadForm((current) => ({
                      ...current,
                      entityType: event.target.value as EntityType,
                      entityId: "",
                    }))
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#FF6A00] focus:ring-2 focus:ring-orange-100"
                >
                  <option value="GENERAL">General</option>
                  <option value="CUSTOMER">Customer</option>
                  <option value="DRIVER">Driver</option>
                  <option value="VEHICLE">Vehicle</option>
                  <option value="BOOKING">Booking</option>
                  <option value="QUOTE">Quote</option>
                  <option value="INVOICE">Invoice</option>
                </select>
              </Field>

              {uploadForm.entityType !== "GENERAL" ? (
                <Field label="Related record">
                  <select
                    value={uploadForm.entityId}
                    onChange={(event) =>
                      setUploadForm((current) => ({
                        ...current,
                        entityId: event.target.value,
                      }))
                    }
                    required
                    disabled={optionsLoading}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#FF6A00] focus:ring-2 focus:ring-orange-100 disabled:bg-slate-100"
                  >
                    <option value="">
                      {optionsLoading
                        ? "Loading records..."
                        : "Select a record"}
                    </option>
                    {currentEntityOptions.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </Field>
              ) : (
                <div />
              )}
            </div>

            <Field label="Notes">
              <textarea
                value={uploadForm.notes}
                onChange={(event) =>
                  setUploadForm((current) => ({
                    ...current,
                    notes: event.target.value,
                  }))
                }
                rows={4}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#FF6A00] focus:ring-2 focus:ring-orange-100"
              />
            </Field>

            <div className="flex justify-end gap-3 border-t border-slate-200 pt-5">
              <button
                type="button"
                onClick={() => setUploadOpen(false)}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-[#FF6A00] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#E85F00] disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 size={17} className="animate-spin" />
                ) : (
                  <Upload size={17} />
                )}
                Upload
              </button>
            </div>
          </form>
        </Modal>
      ) : null}

      {editOpen && selectedDocument ? (
        <Modal title="Edit document" onClose={() => setEditOpen(false)}>
          <form onSubmit={submitEdit} className="space-y-5">
            <Field label="Display name">
              <input
                value={editName}
                onChange={(event) => setEditName(event.target.value)}
                required
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#FF6A00] focus:ring-2 focus:ring-orange-100"
              />
            </Field>

            <Field label="Document type">
              <select
                value={editType}
                onChange={(event) =>
                  setEditType(event.target.value as DocumentType)
                }
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#FF6A00] focus:ring-2 focus:ring-orange-100"
              >
                {DOCUMENT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {readableLabel(type)}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Notes">
              <textarea
                value={editNotes}
                onChange={(event) => setEditNotes(event.target.value)}
                rows={5}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#FF6A00] focus:ring-2 focus:ring-orange-100"
              />
            </Field>

            <div className="flex justify-end gap-3 border-t border-slate-200 pt-5">
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-[#FF6A00] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#E85F00] disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 size={17} className="animate-spin" />
                ) : (
                  <Pencil size={17} />
                )}
                Save changes
              </button>
            </div>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 break-words text-sm font-semibold text-slate-800">
        {value}
      </p>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-slate-700">
        {label}
      </span>
      {children}
    </label>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
          <h2 className="text-xl font-bold text-slate-950">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-950"
          >
            <X size={21} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}