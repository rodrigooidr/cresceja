// backend/routes/inbox.js
import { Router } from "express";
import { requireRole } from "../middleware/requireRole.js";
import * as ctrl from "../controllers/inboxController.js";

const router = Router();

// Listar conversas
router.get("/conversations", async (req, res) => {
  try {
    const fakeConversations = [
      {
        id: 1,
        client_name: "Cliente Teste",
        channel: "whatsapp",
        tags: ["vip"],
        unread_count: 2,
        last_message_text: "Oi, preciso de ajuda",
        last_message_at: new Date(),
        status: "open",
      },
    ];
    res.json(fakeConversations);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Mensagens de uma conversa
router.get("/conversations/:id/messages", async (req, res) => {
  try {
    const fakeMessages = [
      { id: "m1", direction: "in",  type: "text", text: "Olá!",          created_at: new Date(), status: "delivered" },
      { id: "m2", direction: "out", type: "text", text: "Oi, tudo bem?", created_at: new Date(), status: "sent" },
    ];
    res.json(fakeMessages);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Enviar mensagem
router.post("/conversations/:id/messages", async (req, res) => {
  try {
    const { text = "" } = req.body || {};
    const newMsg = {
      id: `m-${Date.now()}`,
      direction: "out",
      type: "text",
      text,
      created_at: new Date(),
      status: "sent",
    };
    res.json(newMsg);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
