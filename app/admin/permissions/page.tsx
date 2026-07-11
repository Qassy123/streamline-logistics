"use client";

import {
  KeyRound,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserX,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
  "http://localhost:5000";

const ADMIN_ROLES = [
  "SUPER_ADMIN",
  "OFFICE_MANAGER",
  "DISPATCHER",
  "ACCOUNTS",
  "DRIVER",
  "READ_ONLY",
] as const;

type AdminRole = (typeof ADMIN_ROLES)[number];

type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  active: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  _count: {
    sessions: number;
    auditLogs: number;
  };
};

type Pagination = {
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
};

type Summary = {
  total: number;
  active: number;
  inactive: number;
  byRole: Record<string, number>;
};

type FormState = {
  name: string;
  email: string;
  password: string;
  role: AdminRole;
  active: boolean;
  reason: string;
};

const emptyForm: FormState = {
  name: "",
  email: "",
  password: "",
  role: "READ_ONLY",
  active: true,
  reason: "",
};

function readableLabel(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDate(value: string | null): string {
  if (!value) {
    return "Never";
  }

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function AdminPermissionsPage() {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    pageSize: 20,
    total: 0,
    pageCount: 1,
  });
  const [summary, setSummary] = useState<Summary>({
    total: 0,
    active: 0,
    inactive: 0,
    byRole: {},
  });
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState("");
  const [selectedAdmin, setSelectedAdmin] = useState<AdminUser | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const getAdminKey = useCallback(() => {
    return window.localStorage.getItem("streamline_admin_key") || "";
  }, []);

  const loadAdmins = useCallback(
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

        if (roleFilter) {
          parameters.set("role", roleFilter);
        }

        if (activeFilter) {
          parameters.set("active", activeFilter);
        }

        const response = await fetch(
          `${API_BASE_URL}/api/admin/permissions?${parameters.toString()}`,
          {
            headers: {
              "x-admin-key": getAdminKey(),
            },
            cache: "no-store",
          },
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.message || "Unable to load admin users.");
        }

        setAdmins(data.admins);
        setPagination(data.pagination);
        setSummary(data.summary);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load admin users.",
        );
      } finally {
        setLoading(false);
      }
    },
    [
      activeFilter,
      getAdminKey,
      pagination.page,
      pagination.pageSize,
      roleFilter,
      search,
    ],
  );

  useEffect(() => {
    void loadAdmins(1);
  }, [search, roleFilter, activeFilter]);

  function clearMessages() {
    setError("");
    setSuccessMessage("");
  }

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearch(searchInput.trim());
  }

  function openCreate() {
    clearMessages();
    setSelectedAdmin(null);
    setForm(emptyForm);
    setModalMode("create");
  }

  function openEdit(admin: AdminUser) {
    clearMessages();
    setSelectedAdmin(admin);
    setForm({
      name: admin.name,
      email: admin.email,
      password: "",
      role: admin.role,
      active: admin.active,
      reason: "",
    });
    setModalMode("edit");
  }

  async function submitForm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearMessages();
    setSaving(true);

    try {
      const isEdit = modalMode === "edit" && selectedAdmin;
      const response = await fetch(
        isEdit
          ? `${API_BASE_URL}/api/admin/permissions/${selectedAdmin.id}`
          : `${API_BASE_URL}/api/admin/permissions`,
        {
          method: isEdit ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
            "x-admin-key": getAdminKey(),
          },
          body: JSON.stringify({
            name: form.name,
            email: form.email,
            password: form.password || undefined,
            role: form.role,
            active: form.active,
            reason: form.reason || undefined,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to save admin user.");
      }

      setModalMode(null);
      setSelectedAdmin(null);
      setSuccessMessage(
        isEdit ? "Admin user updated." : "Admin user created.",
      );
      await loadAdmins(isEdit ? pagination.page : 1);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save admin user.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function revokeSessions(admin: AdminUser) {
    const confirmed = window.confirm(
      `Revoke all active sessions for ${admin.name}?`,
    );

    if (!confirmed) {
      return;
    }

    clearMessages();
    setWorkingId(admin.id);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/admin/permissions/${admin.id}/revoke-sessions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-admin-key": getAdminKey(),
          },
          body: JSON.stringify({
            reason: "Revoked from admin permissions page",
          }),
        },
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to revoke sessions.");
      }

      setSuccessMessage(data.message || "Sessions revoked.");
      await loadAdmins(pagination.page);
    } catch (revokeError) {
      setError(
        revokeError instanceof Error
          ? revokeError.message
          : "Unable to revoke sessions.",
      );
    } finally {
      setWorkingId(null);
    }
  }

  async function deleteAdmin(admin: AdminUser) {
    const confirmed = window.confirm(
      `Delete ${admin.name}? This permanently removes the admin account.`,
    );

    if (!confirmed) {
      return;
    }

    clearMessages();
    setWorkingId(admin.id);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/admin/permissions/${admin.id}`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            "x-admin-key": getAdminKey(),
          },
          body: JSON.stringify({
            reason: "Deleted from admin permissions page",
          }),
        },
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to delete admin user.");
      }

      setSuccessMessage("Admin user deleted.");
      await loadAdmins(
        admins.length === 1 && pagination.page > 1
          ? pagination.page - 1
          : pagination.page,
      );
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Unable to delete admin user.",
      );
    } finally {
      setWorkingId(null);
    }
  }

  const summaryCards = [
    { label: "Total admins", value: summary.total },
    { label: "Active", value: summary.active },
    { label: "Inactive", value: summary.inactive },
    {
      label: "Super admins",
      value: summary.byRole.SUPER_ADMIN || 0,
    },
    {
      label: "Office managers",
      value: summary.byRole.OFFICE_MANAGER || 0,
    },
    {
      label: "Read only",
      value: summary.byRole.READ_ONLY || 0,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#E55300]">
            Administration
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">
            Permissions
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Manage administrator accounts, roles, access status, passwords and
            active sessions.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#FF6A00] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#E85F00]"
        >
          <Plus size={18} />
          Add admin user
        </button>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
        Role records are stored in Prisma, but current admin API access still
        uses the shared ADMIN_API_KEY. These roles become enforceable after the
        admin login/session middleware replaces the shared key.
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

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
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
                  placeholder="Search admin name or email"
                  className="w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-[#FF6A00] focus:ring-2 focus:ring-orange-100"
                />
              </div>
              <button
                type="submit"
                className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Search
              </button>
            </form>

            <select
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#FF6A00] focus:ring-2 focus:ring-orange-100"
            >
              <option value="">All roles</option>
              {ADMIN_ROLES.map((role) => (
                <option key={role} value={role}>
                  {readableLabel(role)}
                </option>
              ))}
            </select>

            <select
              value={activeFilter}
              onChange={(event) => setActiveFilter(event.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#FF6A00] focus:ring-2 focus:ring-orange-100"
            >
              <option value="">All statuses</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>

            <button
              type="button"
              onClick={() => void loadAdmins(pagination.page)}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
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
                  "Administrator",
                  "Role",
                  "Status",
                  "Sessions",
                  "Last login",
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

            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-16 text-center">
                    <Loader2
                      size={25}
                      className="mx-auto animate-spin text-[#FF6A00]"
                    />
                  </td>
                </tr>
              ) : admins.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-5 py-16 text-center text-sm text-slate-500"
                  >
                    No admin users match the current filters.
                  </td>
                </tr>
              ) : (
                admins.map((admin) => (
                  <tr key={admin.id} className="hover:bg-slate-50">
                    <td className="px-5 py-4">
                      <div className="flex min-w-[220px] items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                          <ShieldCheck size={20} />
                        </span>
                        <div>
                          <p className="text-sm font-bold text-slate-950">
                            {admin.name}
                          </p>
                          <p className="text-xs text-slate-500">
                            {admin.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="rounded-full bg-orange-50 px-2.5 py-1 text-xs font-bold text-[#D95200]">
                        {readableLabel(admin.role)}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={[
                          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold",
                          admin.active
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-100 text-slate-600",
                        ].join(" ")}
                      >
                        {admin.active ? (
                          <UserCheck size={14} />
                        ) : (
                          <UserX size={14} />
                        )}
                        {admin.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-600">
                      {admin._count.sessions}
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-600">
                      {formatDate(admin.lastLoginAt)}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(admin)}
                          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-950"
                          title="Edit admin user"
                        >
                          <Pencil size={17} />
                        </button>
                        <button
                          type="button"
                          onClick={() => void revokeSessions(admin)}
                          disabled={
                            workingId === admin.id ||
                            admin._count.sessions === 0
                          }
                          className="rounded-lg p-2 text-amber-600 hover:bg-amber-50 disabled:opacity-30"
                          title="Revoke sessions"
                        >
                          <KeyRound size={17} />
                        </button>
                        <button
                          type="button"
                          onClick={() => void deleteAdmin(admin)}
                          disabled={workingId === admin.id}
                          className="rounded-lg p-2 text-red-500 hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
                          title="Delete admin user"
                        >
                          {workingId === admin.id ? (
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
            Page {pagination.page} of {pagination.pageCount} ·{" "}
            {pagination.total} result{pagination.total === 1 ? "" : "s"}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pagination.page <= 1 || loading}
              onClick={() => void loadAdmins(pagination.page - 1)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={
                pagination.page >= pagination.pageCount || loading
              }
              onClick={() => void loadAdmins(pagination.page + 1)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </section>

      {modalMode ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
              <h2 className="text-xl font-bold text-slate-950">
                {modalMode === "create"
                  ? "Add admin user"
                  : "Edit admin user"}
              </h2>
              <button
                type="button"
                onClick={() => setModalMode(null)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              >
                <X size={21} />
              </button>
            </div>

            <form onSubmit={submitForm} className="space-y-5 p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Name">
                  <input
                    value={form.name}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    required
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#FF6A00] focus:ring-2 focus:ring-orange-100"
                  />
                </Field>

                <Field label="Email address">
                  <input
                    type="email"
                    value={form.email}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        email: event.target.value,
                      }))
                    }
                    required
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#FF6A00] focus:ring-2 focus:ring-orange-100"
                  />
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Role">
                  <select
                    value={form.role}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        role: event.target.value as AdminRole,
                      }))
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#FF6A00] focus:ring-2 focus:ring-orange-100"
                  >
                    {ADMIN_ROLES.map((role) => (
                      <option key={role} value={role}>
                        {readableLabel(role)}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field
                  label={
                    modalMode === "create"
                      ? "Initial password"
                      : "New password (optional)"
                  }
                >
                  <input
                    type="password"
                    value={form.password}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        password: event.target.value,
                      }))
                    }
                    required={modalMode === "create"}
                    minLength={10}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#FF6A00] focus:ring-2 focus:ring-orange-100"
                  />
                </Field>
              </div>

              <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-4">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      active: event.target.checked,
                    }))
                  }
                  className="h-4 w-4 accent-[#FF6A00]"
                />
                <span>
                  <span className="block text-sm font-bold text-slate-800">
                    Active admin account
                  </span>
                  <span className="block text-xs text-slate-500">
                    Inactive accounts cannot use admin sessions.
                  </span>
                </span>
              </label>

              <Field label="Change reason">
                <textarea
                  value={form.reason}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      reason: event.target.value,
                    }))
                  }
                  rows={3}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#FF6A00] focus:ring-2 focus:ring-orange-100"
                />
              </Field>

              <div className="flex justify-end gap-3 border-t border-slate-200 pt-5">
                <button
                  type="button"
                  onClick={() => setModalMode(null)}
                  className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
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
                    <ShieldCheck size={17} />
                  )}
                  {modalMode === "create" ? "Create admin" : "Save changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
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