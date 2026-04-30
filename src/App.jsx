import { useState, useEffect, useCallback } from "react";
import DeliveryApp from "./DeliveryApp";
import RestaurantApp from "./RestaurantApp";
import RiderApp from "./RiderApp";
import AdminPanel from "./AdminPanel";

// ─── localStorage helpers ─────────────────────────────────────────────────────
function loadFromStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (e) {
    console.warn("Failed to load from storage:", key, e);
    return fallback;
  }
}

function saveToStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn("Failed to save to storage:", key, e);
  }
}

// Revive Date objects that were serialised as strings
function reviveDates(obj) {
  if (!obj || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(reviveDates);
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v)) {
      out[k] = new Date(v);
    } else if (typeof v === "object" && v !== null) {
      out[k] = reviveDates(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

// ─── Persisted state hook ─────────────────────────────────────────────────────
function usePersistedState(key, fallback) {
  const [state, setState] = useState(() => {
    const loaded = loadFromStorage(key, fallback);
    // Revive Date strings in arrays of objects
    if (Array.isArray(loaded)) return loaded.map(reviveDates);
    return loaded;
  });

  const setAndPersist = useCallback((updater) => {
    setState(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      saveToStorage(key, next);
      return next;
    });
  }, [key]);

  return [state, setAndPersist];
}

// ─── Error Boundary (class component — required by React) ─────────────────────
import { Component } from "react";

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("SwiftDrop crash caught:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: "100vh", background: "#050d1a", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Mono', monospace", padding: 24 }}>
          <div style={{ maxWidth: 480, width: "100%", background: "rgba(30,41,59,0.9)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 16, padding: 32, textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
            <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 20, fontWeight: 800, color: "#fff", marginBottom: 8 }}>Something went wrong</div>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8, lineHeight: 1.6 }}>
              The app ran into an error. Your data has been saved and will be restored when you reload.
            </div>
            <div style={{ fontSize: 11, color: "#ef4444", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, padding: "8px 12px", marginBottom: 20, textAlign: "left", fontFamily: "monospace", wordBreak: "break-word" }}>
              {this.state.error?.message || "Unknown error"}
            </div>
            <button
              onClick={() => window.location.reload()}
              style={{ padding: "10px 28px", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", border: "none", borderRadius: 10, color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "'Syne',sans-serif", marginRight: 10 }}
            >
              🔄 Reload App
            </button>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              style={{ padding: "10px 20px", background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 10, color: "#a5b4fc", fontSize: 13, cursor: "pointer", fontFamily: "'DM Mono',monospace" }}
            >
              Try to continue
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [view, setView] = usePersistedState("swiftdrop_view", "dashboard");
  const [orders, setOrders] = usePersistedState("swiftdrop_orders", []);
  const [pendingForRider, setPendingForRider] = usePersistedState("swiftdrop_pending", []);
  const [restaurants, setRestaurants] = usePersistedState("swiftdrop_restaurants", []);
  const [riders, setRiders] = usePersistedState("swiftdrop_riders", []);

  // Clean up expired pending orders on load
  useEffect(() => {
    setPendingForRider(prev => prev.filter(o => o.expiresAt && Date.now() < o.expiresAt));
  }, []);

  const navItems = [
    { id: "dashboard",  label: "📊 Dashboard",  color: "#f97316" },
    { id: "restaurant", label: "🍽 Restaurant",  color: "#10b981" },
    { id: "rider",      label: "🛵 Rider",       color: "#6366f1" },
    { id: "admin",      label: "⚙️ Admin",       color: "#f59e0b" },
  ];

  return (
    <ErrorBoundary>
      <div style={{ fontFamily: "'DM Mono', monospace" }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500;600&family=Syne:wght@700;800&display=swap');
          * { box-sizing: border-box; }
          @keyframes navPulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        `}</style>

        {/* TOP NAV */}
        <div style={{
          position: "sticky", top: 0, zIndex: 200,
          background: "rgba(5,13,26,0.97)",
          borderBottom: "1px solid rgba(99,102,241,0.25)",
          display: "flex", alignItems: "center",
          padding: "0 24px", height: 52,
          backdropFilter: "blur(20px)", gap: 8,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginRight: 20 }}>
            <div style={{ width: 28, height: 28, background: "linear-gradient(135deg,#6366f1,#f97316)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>🚀</div>
            <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 14, color: "#fff", letterSpacing: -0.5 }}>SwiftDrop</span>
            <span style={{ fontSize: 10, color: "#475569" }}>Dublin</span>
          </div>

          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              style={{
                padding: "5px 16px", borderRadius: 20,
                border: view === item.id ? `1px solid ${item.color}55` : "1px solid rgba(99,102,241,0.15)",
                background: view === item.id ? `${item.color}18` : "transparent",
                color: view === item.id ? item.color : "#64748b",
                fontFamily: "'DM Mono',monospace", fontSize: 12,
                fontWeight: view === item.id ? 600 : 400,
                cursor: "pointer", transition: "all 0.2s",
                display: "flex", alignItems: "center", gap: 6,
              }}
            >
              {item.label}
              {item.id === "rider" && pendingForRider.length > 0 && (
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#ef4444", display: "inline-block", animation: "navPulse 1s infinite" }} />
              )}
            </button>
          ))}

          <div style={{ marginLeft: "auto", display: "flex", gap: 16, alignItems: "center" }}>
            <span style={{ fontSize: 11, color: "#10b981" }}>● {orders.filter(o => ["accepted","picked_up"].includes(o.status)).length} Active</span>
            <span style={{ fontSize: 11, color: "#f59e0b" }}>● {pendingForRider.length} Awaiting</span>
            <span style={{ fontSize: 11, color: "#94a3b8" }}>{orders.filter(o => o.status === "delivered").length} Delivered</span>

            {/* Clear all data button — for testing */}
            <button
              onClick={() => {
                if (window.confirm("Clear ALL data? This cannot be undone.")) {
                  localStorage.clear();
                  window.location.reload();
                }
              }}
              style={{ padding: "3px 10px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 20, color: "#ef4444", fontSize: 10, cursor: "pointer", fontFamily: "'DM Mono',monospace" }}
              title="Clear all saved data"
            >
              🗑 Reset
            </button>
          </div>
        </div>

        {/* VIEWS — each wrapped in its own error boundary */}
        {view === "dashboard" && (
          <ErrorBoundary>
            <DeliveryApp
              orders={orders} setOrders={setOrders}
              pendingForRider={pendingForRider} setPendingForRider={setPendingForRider}
              restaurants={restaurants} riders={riders} setRiders={setRiders}
            />
          </ErrorBoundary>
        )}
        {view === "restaurant" && (
          <ErrorBoundary>
            <RestaurantApp
              orders={orders} setOrders={setOrders}
              pendingForRider={pendingForRider} setPendingForRider={setPendingForRider}
              restaurants={restaurants} riders={riders}
            />
          </ErrorBoundary>
        )}
        {view === "rider" && (
          <ErrorBoundary>
            <RiderApp
              orders={orders} setOrders={setOrders}
              pendingForRider={pendingForRider} setPendingForRider={setPendingForRider}
              riders={riders}
            />
          </ErrorBoundary>
        )}
        {view === "admin" && (
          <ErrorBoundary>
            <AdminPanel
              restaurants={restaurants} setRestaurants={setRestaurants}
              riders={riders} setRiders={setRiders}
            />
          </ErrorBoundary>
        )}
      </div>
    </ErrorBoundary>
  );
}
