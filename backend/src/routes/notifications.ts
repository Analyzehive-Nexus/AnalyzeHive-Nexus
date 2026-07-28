import { Router } from "express";

export const notificationsRouter = Router();

interface Notification {
  id: number;
  title: string;
  message: string;
  time: string;
  read: boolean;
}

const notifications: Notification[] = [
  { id: 1, title: "Batch flagged", message: "P-001245 (Amoxicillin) crossed 90% expiry risk.", time: "2m ago", read: false },
  { id: 2, title: "Sync complete", message: "Salesforce data sync finished with 0 errors.", time: "12m ago", read: false },
  { id: 3, title: "New audit flag", message: "R. Patel's hierarchy audit was flagged for review.", time: "34m ago", read: false },
];

notificationsRouter.get("/", (_req, res) => {
  res.json({ notifications, unread: notifications.filter((n) => !n.read).length });
});

notificationsRouter.post("/:id/read", (req, res) => {
  const notification = notifications.find((n) => n.id === Number(req.params.id));
  if (!notification) {
    return res.status(404).json({ detail: "Notification not found" });
  }
  notification.read = true;
  res.json(notification);
});
