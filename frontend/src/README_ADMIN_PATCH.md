# CresceJá • Admin & Pricing Patch (Frontend)

Este pacote adiciona:
- **Rotas Admin**: `/admin/clients`, `/admin/plans`, `/admin/usage` (apenas admin).
- **Gerenciador de preços** com `PricingContext` e `pricing.json` (fallback).
- **Componente** `PricingTable` para uso na Landing e outras páginas.

## 1) Adicionar Provider no topo da app
No `src/index.js` (ou onde renderiza `<App />`), envolva com:
```jsx
import { PricingProvider } from "../context/PricingContext";
root.render(
  <React.StrictMode>
    <PricingProvider>
      <App />
    </PricingProvider>
  </React.StrictMode>
);
```

## 2) Criar rotas admin
No `src/App.jsx`, adicione:
```jsx
import AdminRoute from "@/routes/AdminRoute";
import AdminClients from "@/pages/Admin/AdminClients";
import AdminPlans from "@/pages/Admin/AdminPlans";
import AdminUsage from "@/pages/Admin/AdminUsage";

// Dentro de <Routes> ...
<Route element={<AdminRoute><MainLayout /></AdminRoute>}>
  <Route path="/admin/clients" element={<AdminClients />} />
  <Route path="/admin/plans" element={<AdminPlans />} />
  <Route path="/admin/usage" element={<AdminUsage />} />
</Route>
```

## 3) Link no menu (Sidebar)
No `src/components/Sidebar.jsx`, inclua itens visíveis somente para admin (exemplo):
```jsx
const user = JSON.parse(localStorage.getItem("user") || "null");
{user?.role === "admin" && (
  <>
    <MenuItem to="/admin/clients" icon="Users">Clientes</MenuItem>
    <MenuItem to="/admin/plans" icon="BadgeDollarSign">Planos</MenuItem>
    <MenuItem to="/admin/usage" icon="GaugeCircle">Regras de Uso</MenuItem>
  </>
)}
```

Se não usa `MenuItem`, adapte para o seu padrão (Link/NavLink/navigate).

## 4) Landing Page com preços automáticos
Na `LandingPage.jsx`, substitua o bloco de planos estático por:
```jsx
import PricingTable from "../components/PricingTable";
...
<section id="planos" className="...">
  <PricingTable />
</section>
```

## 5) Integração backend (recomendado)
Implemente endpoints:
- `GET /public/plans` → { plans: [...] } para exibir preços publicamente.
- `GET /admin/plans` (auth admin)
- `PUT /admin/plans` (auth admin) → salva configurações
- `POST /admin/plans/publish` (auth admin) → invalida/atualiza cache público
- `GET /admin/clients` (auth admin)
- `PUT /admin/clients/:id` (auth admin) → ativa/desativa, datas e plano

Integre também o webhook do **gateway de pagamento** (Stripe, Mercado Pago etc.) para:
- Confirmar pagamento → definir `active=true`, `start_date=hoje`, `end_date=hoje+30d`.
- Renovação falha → `active=false` após carência.
- Renovação bem-sucedida → estender `end_date`.

## 6) Módulos e limites por plano
O objeto `modules` em cada plano define `enabled` e limites (ex: `chat_sessions`, `credits`). 
Consuma isso nas telas dos módulos para ocultar/limitar funcionalidades de acordo com o plano.

---
Dúvidas? Veja os componentes desta patch e me chame aqui para ajustar ao seu layout atual.
