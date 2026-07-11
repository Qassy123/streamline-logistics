import { Router, type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import { AdminRole, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";

const router = Router();

const adminRoles = Object.values(AdminRole);

function requireAdminKey(
  request: Request,
  response: Response,
  next: () => void,
) {
  const configuredKey = process.env.ADMIN_API_KEY;
  const suppliedKey = request.header("x-admin-key");

  if (!configuredKey) {
    response.status(500).json({
      success: false,
      message: "ADMIN_API_KEY is not configured.",
    });
    return;
  }

  if (!suppliedKey || suppliedKey !== configuredKey) {
    response.status(401).json({
      success: false,
      message: "Unauthorised.",
    });
    return;
  }

  next();
}

router.use(requireAdminKey);

function normaliseString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normaliseEmail(value: unknown): string | undefined {
  const email = normaliseString(value)?.toLowerCase();

  if (!email) {
    return undefined;
  }

  const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  return isValid ? email : undefined;
}

function parsePositiveInteger(
  value: unknown,
  fallback: number,
  maximum: number,
): number {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.min(parsed, maximum);
}

function isAdminRole(value: unknown): value is AdminRole {
  return typeof value === "string" && adminRoles.includes(value as AdminRole);
}

const safeAdminSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  active: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  _count: {
    select: {
      sessions: true,
      auditLogs: true,
    },
  },
} satisfies Prisma.AdminUserSelect;

router.get("/roles", (_request, response) => {
  response.json({
    success: true,
    roles: adminRoles,
    roleDescriptions: {
      SUPER_ADMIN: "Full access to all administration functions.",
      OFFICE_MANAGER: "Broad operational and customer administration access.",
      DISPATCHER: "Planning, bookings, drivers, fleet and tracking access.",
      ACCOUNTS: "Invoices, payments, pricing, reports and customer finance access.",
      DRIVER: "Restricted driver-facing access.",
      READ_ONLY: "View-only administration access.",
    },
  });
});

router.get("/", async (request, response) => {
  try {
    const page = parsePositiveInteger(request.query.page, 1, 100000);
    const pageSize = parsePositiveInteger(request.query.pageSize, 20, 100);
    const search = normaliseString(request.query.search);
    const role = normaliseString(request.query.role) as AdminRole | undefined;
    const active = normaliseString(request.query.active);

    if (role && !isAdminRole(role)) {
      response.status(400).json({
        success: false,
        message: "Invalid admin role.",
      });
      return;
    }

    const where: Prisma.AdminUserWhereInput = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }

    if (role) {
      where.role = role;
    }

    if (active === "true") {
      where.active = true;
    } else if (active === "false") {
      where.active = false;
    }

    const [admins, total, activeCount, inactiveCount, roleGroups] =
      await Promise.all([
        prisma.adminUser.findMany({
          where,
          select: safeAdminSelect,
          orderBy: [{ active: "desc" }, { name: "asc" }],
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        prisma.adminUser.count({ where }),
        prisma.adminUser.count({ where: { active: true } }),
        prisma.adminUser.count({ where: { active: false } }),
        prisma.adminUser.groupBy({
          by: ["role"],
          _count: { _all: true },
        }),
      ]);

    response.json({
      success: true,
      admins,
      pagination: {
        page,
        pageSize,
        total,
        pageCount: Math.max(1, Math.ceil(total / pageSize)),
      },
      summary: {
        total: activeCount + inactiveCount,
        active: activeCount,
        inactive: inactiveCount,
        byRole: Object.fromEntries(
          roleGroups.map((group) => [group.role, group._count._all]),
        ),
      },
    });
  } catch (error) {
    console.error("GET /api/admin/permissions failed", error);
    response.status(500).json({
      success: false,
      message: "Unable to load admin users.",
    });
  }
});

router.get("/:id", async (request, response) => {
  try {
    const admin = await prisma.adminUser.findUnique({
      where: { id: request.params.id },
      select: {
        ...safeAdminSelect,
        sessions: {
          select: {
            id: true,
            expiresAt: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        },
        auditLogs: {
          select: {
            id: true,
            action: true,
            entityType: true,
            entityId: true,
            reason: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: 50,
        },
      },
    });

    if (!admin) {
      response.status(404).json({
        success: false,
        message: "Admin user not found.",
      });
      return;
    }

    response.json({
      success: true,
      admin,
    });
  } catch (error) {
    console.error("GET /api/admin/permissions/:id failed", error);
    response.status(500).json({
      success: false,
      message: "Unable to load admin user.",
    });
  }
});

router.post("/", async (request, response) => {
  try {
    const name = normaliseString(request.body.name);
    const email = normaliseEmail(request.body.email);
    const password = normaliseString(request.body.password);
    const role = request.body.role;
    const active =
      typeof request.body.active === "boolean" ? request.body.active : true;

    if (!name) {
      response.status(400).json({
        success: false,
        message: "Admin name is required.",
      });
      return;
    }

    if (!email) {
      response.status(400).json({
        success: false,
        message: "Enter a valid email address.",
      });
      return;
    }

    if (!password || password.length < 10) {
      response.status(400).json({
        success: false,
        message: "Password must contain at least 10 characters.",
      });
      return;
    }

    if (!isAdminRole(role)) {
      response.status(400).json({
        success: false,
        message: "Select a valid admin role.",
      });
      return;
    }

    const existing = await prisma.adminUser.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existing) {
      response.status(409).json({
        success: false,
        message: "An admin user already exists with this email address.",
      });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const admin = await prisma.adminUser.create({
      data: {
        name,
        email,
        passwordHash,
        role,
        active,
      },
      select: safeAdminSelect,
    });

    await prisma.auditLog.create({
      data: {
        action: "ADMIN_USER_CREATED",
        entityType: "AdminUser",
        entityId: admin.id,
        newValue: {
          name: admin.name,
          email: admin.email,
          role: admin.role,
          active: admin.active,
        },
        reason: normaliseString(request.body.reason),
      },
    });

    response.status(201).json({
      success: true,
      admin,
    });
  } catch (error) {
    console.error("POST /api/admin/permissions failed", error);
    response.status(500).json({
      success: false,
      message: "Unable to create admin user.",
    });
  }
});

router.patch("/:id", async (request, response) => {
  try {
    const existing = await prisma.adminUser.findUnique({
      where: { id: request.params.id },
      select: safeAdminSelect,
    });

    if (!existing) {
      response.status(404).json({
        success: false,
        message: "Admin user not found.",
      });
      return;
    }

    const name =
      request.body.name !== undefined
        ? normaliseString(request.body.name)
        : undefined;
    const email =
      request.body.email !== undefined
        ? normaliseEmail(request.body.email)
        : undefined;
    const role =
      request.body.role !== undefined ? request.body.role : undefined;
    const active =
      typeof request.body.active === "boolean"
        ? request.body.active
        : undefined;
    const password =
      request.body.password !== undefined
        ? normaliseString(request.body.password)
        : undefined;

    if (request.body.name !== undefined && !name) {
      response.status(400).json({
        success: false,
        message: "Admin name cannot be empty.",
      });
      return;
    }

    if (request.body.email !== undefined && !email) {
      response.status(400).json({
        success: false,
        message: "Enter a valid email address.",
      });
      return;
    }

    if (role !== undefined && !isAdminRole(role)) {
      response.status(400).json({
        success: false,
        message: "Select a valid admin role.",
      });
      return;
    }

    if (
      request.body.password !== undefined &&
      (!password || password.length < 10)
    ) {
      response.status(400).json({
        success: false,
        message: "Password must contain at least 10 characters.",
      });
      return;
    }

    if (email && email !== existing.email) {
      const duplicate = await prisma.adminUser.findUnique({
        where: { email },
        select: { id: true },
      });

      if (duplicate) {
        response.status(409).json({
          success: false,
          message: "Another admin user already uses this email address.",
        });
        return;
      }
    }

    const passwordHash = password
      ? await bcrypt.hash(password, 12)
      : undefined;

    const admin = await prisma.$transaction(async (transaction) => {
      const updated = await transaction.adminUser.update({
        where: { id: request.params.id },
        data: {
          name,
          email,
          role,
          active,
          passwordHash,
        },
        select: safeAdminSelect,
      });

      if (active === false || passwordHash) {
        await transaction.adminSession.deleteMany({
          where: { adminId: request.params.id },
        });
      }

      await transaction.auditLog.create({
        data: {
          action: "ADMIN_USER_UPDATED",
          entityType: "AdminUser",
          entityId: request.params.id,
          oldValue: {
            name: existing.name,
            email: existing.email,
            role: existing.role,
            active: existing.active,
          },
          newValue: {
            name: updated.name,
            email: updated.email,
            role: updated.role,
            active: updated.active,
            passwordChanged: Boolean(passwordHash),
          },
          reason: normaliseString(request.body.reason),
        },
      });

      return updated;
    });

    response.json({
      success: true,
      admin,
    });
  } catch (error) {
    console.error("PATCH /api/admin/permissions/:id failed", error);
    response.status(500).json({
      success: false,
      message: "Unable to update admin user.",
    });
  }
});

router.post("/:id/revoke-sessions", async (request, response) => {
  try {
    const existing = await prisma.adminUser.findUnique({
      where: { id: request.params.id },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    if (!existing) {
      response.status(404).json({
        success: false,
        message: "Admin user not found.",
      });
      return;
    }

    const result = await prisma.$transaction(async (transaction) => {
      const deleted = await transaction.adminSession.deleteMany({
        where: { adminId: request.params.id },
      });

      await transaction.auditLog.create({
        data: {
          action: "ADMIN_SESSIONS_REVOKED",
          entityType: "AdminUser",
          entityId: request.params.id,
          newValue: {
            revokedSessions: deleted.count,
          },
          reason: normaliseString(request.body.reason),
        },
      });

      return deleted;
    });

    response.json({
      success: true,
      revokedSessions: result.count,
      message: `${result.count} session${result.count === 1 ? "" : "s"} revoked.`,
    });
  } catch (error) {
    console.error(
      "POST /api/admin/permissions/:id/revoke-sessions failed",
      error,
    );
    response.status(500).json({
      success: false,
      message: "Unable to revoke admin sessions.",
    });
  }
});

router.delete("/:id", async (request, response) => {
  try {
    const existing = await prisma.adminUser.findUnique({
      where: { id: request.params.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    });

    if (!existing) {
      response.status(404).json({
        success: false,
        message: "Admin user not found.",
      });
      return;
    }

    const superAdminCount = await prisma.adminUser.count({
      where: {
        role: AdminRole.SUPER_ADMIN,
        active: true,
      },
    });

    if (
      existing.role === AdminRole.SUPER_ADMIN &&
      superAdminCount <= 1
    ) {
      response.status(400).json({
        success: false,
        message: "The final active super administrator cannot be deleted.",
      });
      return;
    }

    await prisma.$transaction(async (transaction) => {
      await transaction.adminSession.deleteMany({
        where: { adminId: existing.id },
      });

      await transaction.auditLog.create({
        data: {
          action: "ADMIN_USER_DELETED",
          entityType: "AdminUser",
          entityId: existing.id,
          oldValue: {
            name: existing.name,
            email: existing.email,
            role: existing.role,
          },
          reason: normaliseString(request.body?.reason),
        },
      });

      await transaction.adminUser.delete({
        where: { id: existing.id },
      });
    });

    response.json({
      success: true,
      message: "Admin user deleted.",
    });
  } catch (error) {
    console.error("DELETE /api/admin/permissions/:id failed", error);
    response.status(500).json({
      success: false,
      message: "Unable to delete admin user.",
    });
  }
});

export default router;