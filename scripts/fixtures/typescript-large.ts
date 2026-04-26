import type { RequestHandler } from "express";
import { z, ZodError } from "zod";

// ── Domain types ──────────────────────────────────────────────────────────────

export type TaskStatus = "todo" | "in_progress" | "done" | "cancelled";
export type TaskPriority = "low" | "medium" | "high" | "critical";

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId: string | null;
  projectId: string;
  dueDate: Date | null;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTaskDto {
  title: string;
  description?: string;
  priority?: TaskPriority;
  assigneeId?: string;
  projectId: string;
  dueDate?: string;
  tags?: string[];
}

export interface UpdateTaskDto {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  assigneeId?: string | null;
  dueDate?: string | null;
  tags?: string[];
}

// ── Validation schemas ────────────────────────────────────────────────────────

const CreateTaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional().default(""),
  priority: z.enum(["low", "medium", "high", "critical"]).optional().default("medium"),
  assigneeId: z.string().uuid().optional(),
  projectId: z.string().uuid(),
  dueDate: z.string().datetime({ offset: true }).optional(),
  tags: z.array(z.string().max(50)).max(10).optional().default([]),
});

const UpdateTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  status: z.enum(["todo", "in_progress", "done", "cancelled"]).optional(),
  priority: z.enum(["low", "medium", "high", "critical"]).optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  dueDate: z.string().datetime({ offset: true }).nullable().optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
});

// ── Repository interface ──────────────────────────────────────────────────────

export interface TaskRepository {
  findById(id: string): Promise<Task | null>;
  findByProject(projectId: string, page: number, pageSize: number): Promise<{ items: Task[]; total: number }>;
  create(dto: CreateTaskDto, createdBy: string): Promise<Task>;
  update(id: string, dto: UpdateTaskDto): Promise<Task | null>;
  delete(id: string): Promise<boolean>;
}

// ── Service ───────────────────────────────────────────────────────────────────

export class TaskService {
  constructor(private readonly repo: TaskRepository) {}

  async getTask(id: string): Promise<Task> {
    const task = await this.repo.findById(id);
    if (!task) throw new NotFoundError(`Task ${id} not found`);
    return task;
  }

  async listTasks(
    projectId: string,
    page: number,
    pageSize: number
  ): Promise<{ items: Task[]; total: number; page: number; pageSize: number }> {
    const { items, total } = await this.repo.findByProject(projectId, page, pageSize);
    return { items, total, page, pageSize };
  }

  async createTask(dto: CreateTaskDto, userId: string): Promise<Task> {
    return this.repo.create(dto, userId);
  }

  async updateTask(id: string, dto: UpdateTaskDto): Promise<Task> {
    const updated = await this.repo.update(id, dto);
    if (!updated) throw new NotFoundError(`Task ${id} not found`);
    return updated;
  }

  async deleteTask(id: string): Promise<void> {
    const deleted = await this.repo.delete(id);
    if (!deleted) throw new NotFoundError(`Task ${id} not found`);
  }
}

// ── Custom errors ─────────────────────────────────────────────────────────────

export class NotFoundError extends Error {
  readonly status = 404;
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

export class ValidationError extends Error {
  readonly status = 422;
  readonly issues: z.ZodIssue[];
  constructor(zodError: ZodError) {
    super("Validation failed");
    this.name = "ValidationError";
    this.issues = zodError.issues;
  }
}

// ── Route handlers ────────────────────────────────────────────────────────────

export function makeTaskHandlers(service: TaskService) {
  const getTask: RequestHandler = async (req, res, next) => {
    try {
      const task = await service.getTask(req.params.id);
      res.json(task);
    } catch (err) {
      next(err);
    }
  };

  const listTasks: RequestHandler = async (req, res, next) => {
    try {
      const page = Number(req.query.page ?? 1);
      const pageSize = Number(req.query.pageSize ?? 20);
      const result = await service.listTasks(req.params.projectId, page, pageSize);
      res.json(result);
    } catch (err) {
      next(err);
    }
  };

  const createTask: RequestHandler = async (req, res, next) => {
    try {
      const parsed = CreateTaskSchema.parse(req.body);
      const task = await service.createTask(parsed, (req as any).userId);
      res.status(201).json(task);
    } catch (err) {
      if (err instanceof ZodError) return next(new ValidationError(err));
      next(err);
    }
  };

  const updateTask: RequestHandler = async (req, res, next) => {
    try {
      const parsed = UpdateTaskSchema.parse(req.body);
      const task = await service.updateTask(req.params.id, parsed);
      res.json(task);
    } catch (err) {
      if (err instanceof ZodError) return next(new ValidationError(err));
      next(err);
    }
  };

  const deleteTask: RequestHandler = async (req, res, next) => {
    try {
      await service.deleteTask(req.params.id);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  };

  return { getTask, listTasks, createTask, updateTask, deleteTask };
}

// ── Error middleware ──────────────────────────────────────────────────────────

export const errorHandler: RequestHandler = (err: any, _req: any, res: any, _next: any) => {
  if (err instanceof NotFoundError) {
    return res.status(404).json({ error: err.message });
  }
  if (err instanceof ValidationError) {
    return res.status(422).json({ error: "Validation failed", issues: err.issues });
  }
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
};
