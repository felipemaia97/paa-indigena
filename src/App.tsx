import * as React from "react";
import { useState, useMemo, useEffect } from "react";
import {
  Truck,
  Users,
  Package,
  GraduationCap,
  PlusCircle,
  Trash2,
  Edit2,
  Search,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  Layers,
  TrendingDown,
  X,
  Download,
  Upload,
  FileSpreadsheet,
  Database,
  Info,
} from "lucide-react";

// 1. CONFIGURAR O CLIENTE COM AS CREDENCIAIS DO SUPABASE
const supabaseUrl = "https://tvhocudavwayzvsuzwnw.supabase.co";
const supabaseKey = "sb_publishable_guh35_NMirVT28hBPmoARQ_2falUv2J";

const getSupabase = () => {
  if (!window.supabase) return null;
  if (
    !supabaseUrl.startsWith("http://") &&
    !supabaseUrl.startsWith("https://")
  ) {
    return null;
  }
  try {
    return window.supabase.createClient(supabaseUrl, supabaseKey);
  } catch (e) {
    return null;
  }
};

// Formatação para Real Brasileiro (BRL)
const formatMoney = (val) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    val || 0
  );
const formatDate = (dateStr) => {
  if (!dateStr) return "";
  const [year, month, day] = dateStr.split("-");
  return `${day}/${month}/${year}`;
};

export default function App() {
  const [loading, setLoading] = useState(true);
  const [hasValidConfig, setHasValidConfig] = useState(false);

  // Estados dos dados
  const [producers, setProducers] = useState([]);
  const [products, setProducts] = useState([]);
  const [schools, setSchools] = useState([]);
  const [deliveries, setDeliveries] = useState([]);

  const [activeTab, setActiveTab] = useState("deliveries");
  const [feedback, setFeedback] = useState({
    show: false,
    type: "success",
    message: "",
  });

  const showNotification = (message, type = "success") => {
    setFeedback({ show: true, type, message });
    setTimeout(
      () => setFeedback({ show: false, type: "success", message: "" }),
      4500
    );
  };

  // --- BUSCAR DADOS DO SUPABASE ---
  const loadData = async () => {
    setLoading(true);
    try {
      const client = getSupabase();
      if (!client) {
        setHasValidConfig(false);
        setLoading(false);
        return;
      }

      setHasValidConfig(true);
      const [prodRes, itemRes, schoolRes, delivRes] = await Promise.all([
        client.from("producers").select("*"),
        client.from("products").select("*"),
        client.from("schools").select("*"),
        client
          .from("deliveries")
          .select("*")
          .order("date", { ascending: false }),
      ]);

      if (prodRes.data) setProducers(prodRes.data);
      if (itemRes.data) setProducts(itemRes.data);
      if (schoolRes.data) setSchools(schoolRes.data);
      if (delivRes.data) setDeliveries(delivRes.data);
    } catch (error) {
      console.error("Erro ao buscar dados", error);
      showNotification("Erro de conexão ao banco de dados.", "error");
    } finally {
      setLoading(false);
    }
  };

  // Carregar ao iniciar
  useEffect(() => {
    if (!window.supabase) {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
      script.onload = () => loadData();
      document.head.appendChild(script);
    } else {
      loadData();
    }
  }, []);

  // --- CÁLCULOS DERIVADOS ---
  const producerStats = useMemo(() => {
    return producers.map((prod) => {
      const used = deliveries
        .filter((d) => d.producerId === prod.id)
        .reduce((acc, curr) => acc + (Number(curr.totalValue) || 0), 0);
      const remaining = Math.max(0, Number(prod.maxQuota) - used);
      const percentage =
        prod.maxQuota > 0 ? Math.min(100, (used / prod.maxQuota) * 100) : 0;
      return {
        ...prod,
        usedQuota: used,
        remainingQuota: remaining,
        percentageUsed: percentage,
      };
    });
  }, [producers, deliveries]);

  const productStats = useMemo(() => {
    return products.map((prod) => {
      const deliveredQty = deliveries
        .filter((d) => d.productId === prod.id)
        .reduce((acc, curr) => acc + Number(curr.quantity || 0), 0);
      const remainingStock = Math.max(0, Number(prod.maxStock) - deliveredQty);
      const percentage =
        prod.maxStock > 0
          ? Math.min(100, (deliveredQty / prod.maxStock) * 100)
          : 0;
      return {
        ...prod,
        deliveredQty,
        remainingStock,
        percentageDelivered: percentage,
      };
    });
  }, [products, deliveries]);

  // --- REGISTRAR ENTREGA ---
  const [formDate, setFormDate] = useState(
    () => new Date().toISOString().split("T")[0]
  );
  const [formProducer, setFormProducer] = useState("");
  const [formProduct, setFormProduct] = useState("");
  const [formQty, setFormQty] = useState("");
  const [formSchool, setFormSchool] = useState("");

  const preview = useMemo(() => {
    const selectedProd = producerStats.find((p) => p.id === formProducer);
    const selectedItem = productStats.find((i) => i.id === formProduct);
    const qty = Number(formQty) || 0;
    const total = selectedItem ? qty * Number(selectedItem.unitPrice) : 0;

    let quotaError = false,
      stockError = false;
    if (selectedProd && total > selectedProd.remainingQuota) quotaError = true;
    if (selectedItem && qty > selectedItem.remainingStock) stockError = true;

    return { selectedProd, selectedItem, qty, total, quotaError, stockError };
  }, [formProducer, formProduct, formQty, producerStats, productStats]);

  const handleRegisterDelivery = async (e) => {
    e.preventDefault();
    const { selectedProd, selectedItem, qty, total, quotaError, stockError } =
      preview;

    if (!formDate || !formProducer || !formProduct || !formSchool || qty <= 0)
      return showNotification("Preencha os campos corretamente.", "error");
    if (stockError) return showNotification(`Estoque insuficiente!`, "error");
    if (quotaError) return showNotification(`Cota excedida!`, "error");

    const newDelivery = {
      id: Date.now().toString(),
      date: formDate,
      producerId: formProducer,
      productId: formProduct,
      quantity: qty,
      unitPrice: selectedItem.unitPrice,
      totalValue: total,
      schoolId: formSchool,
      createdAt: new Date().toISOString(),
    };

    const client = getSupabase();
    const { error } = await client.from("deliveries").insert([newDelivery]);
    if (error) {
      showNotification("Erro ao salvar no Supabase.", "error");
    } else {
      setDeliveries([newDelivery, ...deliveries]);
      setFormQty("");
      showNotification("Entrega registrada com sucesso!", "success");
      setActiveTab("deliveries");
    }
  };

  const handleDeleteDelivery = async (id) => {
    if (confirm("Cancelar entrega e restaurar saldo?")) {
      const client = getSupabase();
      const { error } = await client.from("deliveries").delete().eq("id", id);
      if (error) showNotification("Erro ao excluir do Supabase.", "error");
      else {
        setDeliveries(deliveries.filter((d) => d.id !== id));
        showNotification("Entrega cancelada.", "info");
      }
    }
  };

  // --- FILTROS HISTÓRICO ---
  const [filterSearch, setFilterSearch] = useState("");
  const [filterProducer, setFilterProducer] = useState("");
  const [filterSchool, setFilterSchool] = useState("");

  const filteredDeliveries = useMemo(() => {
    return deliveries.filter((d) => {
      const prod = producers.find((p) => p.id === d.producerId);
      const prodMatch = filterProducer ? d.producerId === filterProducer : true;
      const schoolMatch = filterSchool ? d.schoolId === filterSchool : true;
      const searchMatch =
        !filterSearch ||
        prod?.name.toLowerCase().includes(filterSearch.toLowerCase()) ||
        d.date.includes(filterSearch);
      return prodMatch && schoolMatch && searchMatch;
    });
  }, [deliveries, producers, filterProducer, filterSchool, filterSearch]);

  // --- CADASTROS MANUAIS ---
  const [registerModal, setRegisterModal] = useState({
    open: false,
    type: null,
    mode: "create",
    data: null,
  });
  const [modalInput1, setModalInput1] = useState("");
  const [modalInput2, setModalInput2] = useState("");
  const [modalInput3, setModalInput3] = useState("");

  const openRegisterModal = (type, mode = "create", item = null) => {
    setRegisterModal({ open: true, type, mode, data: item });
    if (mode === "edit" && item) {
      setModalInput1(item.name);
      if (type === "producer") setModalInput2(item.maxQuota);
      if (type === "product") {
        setModalInput2(item.unitPrice);
        setModalInput3(item.maxStock);
      }
    } else {
      setModalInput1("");
      setModalInput2("");
      setModalInput3("");
    }
  };

  const handleSaveModal = async (e) => {
    e.preventDefault();
    const { type, mode, data } = registerModal;
    const tableName = type + "s";
    const id = data?.id || Date.now().toString();
    const payload = { id, name: modalInput1.trim() };

    if (type === "producer") payload.maxQuota = parseFloat(modalInput2);
    else if (type === "product") {
      payload.unitPrice = parseFloat(modalInput2);
      payload.maxStock = parseFloat(modalInput3);
    }

    const client = getSupabase();
    const { error } = await client.from(tableName).upsert(payload);
    if (error) showNotification("Erro ao salvar.", "error");
    else {
      showNotification("Salvo com sucesso na nuvem!");
      loadData();
      setRegisterModal({ open: false, type: null, mode: "create", data: null });
    }
  };

  const handleDeleteEntity = async (type, id) => {
    const hasDeliveries = deliveries.some((d) =>
      type === "producer"
        ? d.producerId === id
        : type === "product"
        ? d.productId === id
        : d.schoolId === id
    );
    if (hasDeliveries)
      return showNotification(
        "Não é possível excluir: existem entregas vinculadas.",
        "error"
      );

    const client = getSupabase();
    const { error } = await client
      .from(type + "s")
      .delete()
      .eq("id", id);
    if (error) showNotification("Erro ao excluir.", "error");
    else {
      showNotification("Removido com sucesso!", "info");
      loadData();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-100 flex flex-col items-center justify-center text-stone-700">
        <Truck className="w-12 h-12 text-emerald-600 animate-bounce mb-4" />
        <h2 className="text-xl font-bold">Conectando ao Supabase...</h2>
      </div>
    );
  }

  if (!hasValidConfig) {
    return (
      <div className="min-h-screen bg-stone-100 flex flex-col items-center justify-center p-4 text-center">
        <div className="bg-white p-8 rounded-2xl shadow-md max-w-lg border border-stone-200">
          <Database className="w-12 h-12 text-amber-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-stone-900 mb-2">
            Configuração do Supabase Necessária
          </h2>
          <p className="text-sm text-stone-600 mb-4">
            Verifique as credenciais no topo do código.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-100 text-stone-800 flex flex-col font-sans">
      {feedback.show && (
        <div
          className={`fixed top-4 right-4 z-50 max-w-md px-4 py-3 rounded-xl shadow-lg flex items-center space-x-3 text-sm border ${
            feedback.type === "error"
              ? "bg-rose-50 border-rose-300 text-rose-800"
              : "bg-emerald-50 border-emerald-300 text-emerald-800"
          }`}
        >
          {feedback.type === "error" ? (
            <AlertTriangle className="w-5 h-5 flex-shrink-0 text-rose-600" />
          ) : (
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-600" />
          )}
          <span className="font-medium">{feedback.message}</span>
        </div>
      )}

      <header className="bg-emerald-900 text-white shadow-md border-b border-emerald-800">
        <div className="max-w-6xl mx-auto px-4 py-5 flex items-center space-x-3">
          <div className="p-2.5 bg-emerald-800/80 rounded-xl border border-emerald-700">
            <Truck className="w-7 h-7 text-emerald-300" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
              PAA Indígena{" "}
              <span className="text-xs bg-emerald-700/80 px-2 py-0.5 rounded-full text-emerald-200 border border-emerald-600">
                Supabase
              </span>
            </h1>
            <p className="text-xs md:text-sm text-emerald-200">
              Sistema Online em Tempo Real
            </p>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 mt-2">
          <nav className="flex space-x-1 overflow-x-auto pb-0">
            {[
              { id: "new-delivery", icon: PlusCircle, label: "Nova Entrega" },
              {
                id: "deliveries",
                icon: Layers,
                label: `Histórico (${deliveries.length})`,
              },
              { id: "balances", icon: TrendingDown, label: "Saldos" },
              { id: "registers", icon: Users, label: "Cadastros" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 rounded-t-xl text-sm font-semibold transition-colors ${
                  activeTab === tab.id
                    ? "bg-stone-100 text-emerald-950 shadow-sm"
                    : "text-emerald-100 hover:bg-emerald-800/60"
                }`}
              >
                <tab.icon
                  className={`w-4 h-4 ${
                    activeTab === tab.id
                      ? "text-emerald-600"
                      : "text-emerald-300"
                  }`}
                />{" "}
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto p-4 md:p-6 space-y-6">
        {activeTab === "new-delivery" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in">
            <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-stone-200">
              <h2 className="text-lg font-bold text-stone-900 flex items-center gap-2 border-b pb-4 mb-6">
                <Truck className="w-5 h-5 text-emerald-700" /> Registrar Nova
                Entrega
              </h2>
              <form onSubmit={handleRegisterDelivery} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase text-stone-600 mb-1">
                      Data
                    </label>
                    <input
                      type="date"
                      required
                      value={formDate}
                      onChange={(e) => setFormDate(e.target.value)}
                      className="w-full bg-stone-50 border rounded-xl px-3.5 py-2.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase text-stone-600 mb-1">
                      Escola
                    </label>
                    <select
                      required
                      value={formSchool}
                      onChange={(e) => setFormSchool(e.target.value)}
                      className="w-full bg-stone-50 border rounded-xl px-3.5 py-2.5 text-sm"
                    >
                      <option value="">Selecione...</option>
                      {schools.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-stone-600 mb-1">
                    Produtor
                  </label>
                  <select
                    required
                    value={formProducer}
                    onChange={(e) => setFormProducer(e.target.value)}
                    className="w-full bg-stone-50 border rounded-xl px-3.5 py-2.5 text-sm"
                  >
                    <option value="">Selecione...</option>
                    {producerStats.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} — Saldo: {formatMoney(p.remainingQuota)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase text-stone-600 mb-1">
                      Produto
                    </label>
                    <select
                      required
                      value={formProduct}
                      onChange={(e) => setFormProduct(e.target.value)}
                      className="w-full bg-stone-50 border rounded-xl px-3.5 py-2.5 text-sm"
                    >
                      <option value="">Selecione...</option>
                      {productStats.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} ({formatMoney(item.unitPrice)}) — Disp:{" "}
                          {item.remainingStock}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase text-stone-600 mb-1">
                      Quantidade
                    </label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={formQty}
                      onChange={(e) => setFormQty(e.target.value)}
                      className="w-full bg-stone-50 border rounded-xl px-3.5 py-2.5 text-sm"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={
                    preview.quotaError || preview.stockError || preview.qty <= 0
                  }
                  className={`w-full py-3.5 px-6 rounded-xl font-bold flex justify-center gap-2 mt-4 ${
                    preview.quotaError || preview.stockError || preview.qty <= 0
                      ? "bg-stone-300 text-stone-500"
                      : "bg-emerald-700 text-white"
                  }`}
                >
                  <CheckCircle2 className="w-5 h-5" /> Registrar Entrega
                </button>
              </form>
            </div>

            <div className="bg-stone-50 rounded-2xl p-6 border border-stone-200 flex flex-col justify-between">
              <h3 className="text-sm font-bold uppercase text-stone-700 mb-4 pb-2 border-b flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-700" /> Resumo
              </h3>
              {preview.selectedItem && (
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between py-1.5 border-b border-stone-200">
                    <span className="text-stone-500">Preço Unitário:</span>
                    <span className="font-semibold">
                      {formatMoney(preview.selectedItem.unitPrice)}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 bg-emerald-50 px-3 rounded-lg">
                    <span className="text-emerald-900 font-bold">Total:</span>
                    <span className="text-emerald-900 font-extrabold">
                      {formatMoney(preview.total)}
                    </span>
                  </div>
                </div>
              )}
              {preview.selectedProd && (
                <div className="mt-4 pt-3 border-t border-stone-200">
                  <span className="text-xs font-bold text-stone-600 block mb-1">
                    Cota do Produtor:
                  </span>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-stone-500">Saldo Atual:</span>
                    <span className="font-medium">
                      {formatMoney(preview.selectedProd.remainingQuota)}
                    </span>
                  </div>
                  {preview.qty > 0 && (
                    <div className="flex justify-between text-xs mb-2">
                      <span className="text-stone-500">Após Entrega:</span>
                      <span
                        className={`font-bold ${
                          preview.quotaError
                            ? "text-rose-600"
                            : "text-emerald-700"
                        }`}
                      >
                        {formatMoney(
                          preview.selectedProd.remainingQuota - preview.total
                        )}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "deliveries" && (
          <div className="space-y-4 animate-in fade-in">
            <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
              <table className="w-full text-left text-xs md:text-sm">
                <thead className="bg-stone-100 text-stone-600 uppercase text-[11px] font-bold border-b">
                  <tr>
                    <th className="px-4 py-3">Data</th>
                    <th className="px-4 py-3">Produtor</th>
                    <th className="px-4 py-3">Produto & Qtd</th>
                    <th className="px-4 py-3">Total</th>
                    <th className="px-4 py-3">Escola</th>
                    <th className="px-4 py-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredDeliveries.map((del) => {
                    const prod = producers.find((p) => p.id === del.producerId);
                    const item = products.find((p) => p.id === del.productId);
                    const school = schools.find((s) => s.id === del.schoolId);
                    return (
                      <tr key={del.id} className="hover:bg-stone-50/80">
                        <td className="px-4 py-3.5 text-stone-700 font-medium">
                          {formatDate(del.date)}
                        </td>
                        <td className="px-4 py-3.5 font-semibold">
                          {prod ? prod.name : "Excluído"}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="font-medium">
                            {item ? item.name : "Excluído"}
                          </div>
                          <div className="text-[11px] text-stone-500">
                            {del.quantity} × {formatMoney(del.unitPrice)}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 font-bold text-emerald-800">
                          {formatMoney(del.totalValue)}
                        </td>
                        <td className="px-4 py-3.5 text-stone-600">
                          {school ? school.name : "Excluída"}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <button
                            onClick={() => handleDeleteDelivery(del.id)}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "balances" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-200">
              <h3 className="font-bold text-base mb-4 border-b pb-4 flex gap-2">
                <Users className="w-5 h-5 text-emerald-700" /> Saldos Produtores
              </h3>
              <div className="space-y-4">
                {producerStats.map((prod) => (
                  <div
                    key={prod.id}
                    className="p-4 rounded-xl border bg-stone-50 flex justify-between"
                  >
                    <div className="font-bold text-sm text-stone-800">
                      {prod.name}
                    </div>
                    <div className="text-emerald-800 font-bold text-sm">
                      {formatMoney(prod.remainingQuota)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "registers" && (
          <div className="space-y-6 animate-in fade-in">
            <div className="bg-white rounded-2xl p-5 border">
              <div className="flex justify-between mb-4">
                <h3 className="font-bold flex items-center gap-2">
                  <Users className="w-5 h-5 text-emerald-700" /> Produtores
                </h3>
                <button
                  onClick={() => openRegisterModal("producer", "create")}
                  className="px-3 py-2 bg-emerald-700 text-white rounded-xl text-xs font-bold"
                >
                  Novo
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {producers.map((prod) => (
                  <div
                    key={prod.id}
                    className="p-4 border rounded-xl flex justify-between"
                  >
                    <div>
                      <h4 className="font-bold text-sm">{prod.name}</h4>
                    </div>
                    <button
                      onClick={() => handleDeleteEntity("producer", prod.id)}
                      className="text-rose-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-2xl p-5 border">
              <div className="flex justify-between mb-4">
                <h3 className="font-bold flex items-center gap-2">
                  <Package className="w-5 h-5 text-emerald-700" /> Produtos
                </h3>
                <button
                  onClick={() => openRegisterModal("product", "create")}
                  className="px-3 py-2 bg-emerald-700 text-white rounded-xl text-xs font-bold"
                >
                  Novo
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {products.map((prod) => (
                  <div
                    key={prod.id}
                    className="p-4 border rounded-xl flex justify-between"
                  >
                    <div>
                      <h4 className="font-bold text-sm">{prod.name}</h4>
                    </div>
                    <button
                      onClick={() => handleDeleteEntity("product", prod.id)}
                      className="text-rose-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-2xl p-5 border">
              <div className="flex justify-between mb-4">
                <h3 className="font-bold flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-emerald-700" /> Escolas
                </h3>
                <button
                  onClick={() => openRegisterModal("school", "create")}
                  className="px-3 py-2 bg-emerald-700 text-white rounded-xl text-xs font-bold"
                >
                  Nova
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {schools.map((school) => (
                  <div
                    key={school.id}
                    className="p-4 border rounded-xl flex justify-between"
                  >
                    <div>
                      <h4 className="font-bold text-sm">{school.name}</h4>
                    </div>
                    <button
                      onClick={() => handleDeleteEntity("school", school.id)}
                      className="text-rose-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {registerModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl border overflow-hidden animate-in zoom-in-95">
            <div className="p-5 border-b flex justify-between bg-stone-50">
              <h3 className="font-bold">
                {registerModal.mode === "create" ? "Novo" : "Editar"}
              </h3>
              <button
                onClick={() => setRegisterModal({ open: false })}
                className="p-1 text-stone-400 hover:text-stone-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveModal} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase mb-1">
                  Nome
                </label>
                <input
                  type="text"
                  required
                  value={modalInput1}
                  onChange={(e) => setModalInput1(e.target.value)}
                  className="w-full bg-stone-50 border rounded-xl px-3.5 py-2.5 text-sm outline-none"
                />
              </div>
              {registerModal.type === "producer" && (
                <div>
                  <label className="block text-xs font-bold uppercase mb-1">
                    Cota Máxima (R$)
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={modalInput2}
                    onChange={(e) => setModalInput2(e.target.value)}
                    className="w-full bg-stone-50 border rounded-xl px-3.5 py-2.5 text-sm outline-none"
                  />
                </div>
              )}
              {registerModal.type === "product" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase mb-1">
                      Preço Un (R$)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={modalInput2}
                      onChange={(e) => setModalInput2(e.target.value)}
                      className="w-full bg-stone-50 border rounded-xl px-3.5 py-2.5 text-sm outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase mb-1">
                      Qtd Máxima
                    </label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={modalInput3}
                      onChange={(e) => setModalInput3(e.target.value)}
                      className="w-full bg-stone-50 border rounded-xl px-3.5 py-2.5 text-sm outline-none"
                    />
                  </div>
                </div>
              )}
              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRegisterModal({ open: false })}
                  className="px-4 py-2.5 rounded-xl border text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-emerald-700 text-white text-xs font-bold"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
