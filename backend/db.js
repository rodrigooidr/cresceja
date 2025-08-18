import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, "..", "data.json");

function ensureFile(){
  if (!fs.existsSync(DB_PATH)){
    const seed = {
      tenants: [
        {
          id: "t1",
          name: "Acme",
          plans: [
            {
              id: "starter",
              name: "Starter",
              monthlyPrice: 49,
              currency: "BRL",
              is_published: true,
              sort_order: 1,
              is_free: false,
              trial_days: 14,
              billing_period_months: 1,
              modules: {
                omnichannel: { enabled: true, chat_sessions: 200 },
                crm: { enabled: true, opportunities: 500 },
                marketing: { enabled: true, posts_per_month: 20 },
                approvals: { enabled: true },
                ai_credits: { enabled: true, credits: 10000 },
                governance: { enabled: true }
              }
            }
          ],
          subscriptions: [], // por simplicidade
          users: [
            { id: "owner1", email: "owner@acme.com", role: "owner", tenantId: "t1", password: "123" },
            { id: "admin1", email: "admin@acme.com", role: "client_admin", tenantId: "t1", password: "123" },
            { id: "user1",  email: "user@acme.com",  role: "user", tenantId: "t1", password: "123",
              permissions: { crm: true, marketing: false, approvals: false, governance: false, omnichannel: false } }
          ]
        }
      ]
    };
    fs.writeFileSync(DB_PATH, JSON.stringify(seed, null, 2));
  }
}
ensureFile();

export function readDb(){
  return JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
}
export function writeDb(db){
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}
