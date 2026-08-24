import React, { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef, lazy, Suspense } from "react";
import { supabase } from "./supabaseClient";
import { LoginForm, MfaChallenge, MfaEnroll, ResetPasswordForm } from "./components/Auth";
import Landing from "./components/Landing";
import { Sidebar, ThemeToggle } from "./components/ui";
import { SettingsPage } from "./components/Settings";
import Dashboard from "./components/Dashboard";
import Firms from "./components/Firms";
import Accounts from "./components/Accounts";
import Expenses from "./components/Expenses";
import Payouts from "./components/Payouts";
import Goals from "./components/Goals";
import Profile from "./components/Profile";
import PageTransition from "./components/PageTransition";
import ErrorBoundary from "./components/ErrorBoundary";
import { Toaster, toast } from "./components/Toast";
import { buildNotifications, NotificationBell } from "./components/Notifications";
import { Splash, DashboardSkeleton, LoadError } from "./components/Loading";
import { SkeletonList } from "./components/Skeleton";
import * as api from "./lib/api";

/* IDs de tous les onglets (sidebar + accès profil/réglages) : sert à valider
   l'onglet restauré depuis localStorage. */
const PAGE_IDS = ["dashboard", "firms", "accounts", "personal", "expenses", "payouts", "goals", "settings", "profile"];

/* Snapshot local du dernier chargement réussi : au refresh de la page (F5),
   les données sont ré-affichées instantanément depuis ce cache pendant que
   la requête réseau se fait en arrière-plan. Effacé à la déconnexion. */
const SNAPSHOT_KEY = "funded_snapshot_v1";
const readSnapshot = () => {
  try {
    const snap = JSON.parse(localStorage.getItem(SNAPSHOT_KEY) || "null");
    return snap && Array.isArray(snap.firms) ? snap : null;
  } catch { return null; }
};

// Page secondaire (recharts inclus) : chargée à la demande.
const PersonalAccount = lazy(() => import("./components/PersonalAccount"));

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = loading, null = signed out
  const [authView, setAuthView] = useState("landing"); // landing | login (only used while signed out)
  const [authMode, setAuthMode] = useState("signin"); // signin | signup, passed to LoginForm as the initial mode
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const [mfaState, setMfaState] = useState(null); // { factorId } when a challenge is pending
  const [mfaEnrollOffer, setMfaEnrollOffer] = useState(false);
  const [mfaEnabled, setMfaEnabled] = useState(false);
  // Dernier onglet actif mémorisé : au refresh (F5) ou à la réouverture,
  // l'app se rouvre là où l'utilisateur s'était arrêté.
  const [tab, setTab] = useState(() => {
    const saved = localStorage.getItem("funded_tab");
    return PAGE_IDS.includes(saved) ? saved : "dashboard";
  });
  useEffect(() => { localStorage.setItem("funded_tab", tab); }, [tab]);

  // Accessibilité : quand une modale ou le drawer mobile est ouvert, Tab ne
  // doit pas sortir du conteneur (focus trap), et le focus y rentre s'il était
  // dehors (ex: clic sur l'overlay). Un seul handler global évite de toucher
  // chaque modale individuelle.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Tab") return;
      const container = document.querySelector(".mobile-drawer.open") || document.querySelector(".modal-backdrop");
      if (!container) return;
      const focusables = container.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (!container.contains(document.activeElement)) {
        first.focus();
        e.preventDefault();
      } else if (e.shiftKey && document.activeElement === first) {
        last.focus();
        e.preventDefault();
      } else if (!e.shiftKey && document.activeElement === last) {
        first.focus();
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Mémoire de scroll par onglet : chaque tab garde sa propre position, isolée
  // des autres. On sauvegarde en continu (onScroll) et on restaure au switch,
  // avant le prochain paint (useLayoutEffect) pour éviter tout flash visuel
  // à l'ancienne position.
  const mainRef = useRef(null);
  // Positions de scroll par onglet, réhydratées depuis sessionStorage :
  // un F5 ne perd plus la position non plus.
  const scrollPositions = useRef((() => {
    try { return JSON.parse(sessionStorage.getItem("funded_scroll") || "{}"); } catch { return {}; }
  })());
  const scrollSaveTimer = useRef(null);
  const handleMainScroll = useCallback(() => {
    if (!mainRef.current) return;
    scrollPositions.current[tab] = mainRef.current.scrollTop;
    clearTimeout(scrollSaveTimer.current);
    scrollSaveTimer.current = setTimeout(() => {
      try { sessionStorage.setItem("funded_scroll", JSON.stringify(scrollPositions.current)); } catch { /* quota */ }
    }, 250);
  }, [tab]);
  useLayoutEffect(() => {
    if (mainRef.current) mainRef.current.scrollTop = scrollPositions.current[tab] || 0;
  }, [tab]);

  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem("funded_theme");
    if (saved) return saved;
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  });
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("funded_theme", theme);
  }, [theme]);
  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  const [firms, setFirms] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [goalTranches, setGoalTranches] = useState([]);
  const [accountEvents, setAccountEvents] = useState([]);
  const [scalingHistory, setScalingHistory] = useState([]);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const currentYear = new Date().getFullYear();
  const [dashboardYear, setDashboardYear] = useState(currentYear);

  // "Compte propre" est chargé à la demande (recharts ~400 ko) : on ne déclenche
  // le téléchargement du chunk qu'à la première visite de cet onglet. Ensuite la
  // page reste montée comme les autres.
  const [personalOpened, setPersonalOpened] = useState(false);
  useEffect(() => { if (tab === "personal") setPersonalOpened(true); }, [tab]);

  const checkMfaAndProceed = useCallback(async () => {
    const { data: aal, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error) { setSession(null); return; }
    if (aal.currentLevel === "aal1" && aal.nextLevel === "aal2") {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const factor = factors?.totp?.[0];
      if (factor) { setMfaState({ factorId: factor.id }); return; }
    }
    setMfaState(null);
    if (aal.currentLevel === "aal1" && aal.nextLevel === "aal1") {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      if (!factors?.totp?.length) setMfaEnrollOffer(true);
    }
  }, []);

  // Statut 2FA affiché dans la page Profil (indépendant du flux de connexion ci-dessus)
  const refreshMfaStatus = useCallback(async () => {
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) { setMfaEnabled(false); return; }
    setMfaEnabled(!!data?.totp?.length);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session) { checkMfaAndProceed(); refreshMfaStatus(); }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, sess) => {
      if (event === "PASSWORD_RECOVERY") {
        // Le lien email ne donne qu'une session AAL1. Si le compte a le 2FA
        // activé, Supabase exigera l'AAL2 pour autoriser updateUser() —
        // on vérifie donc le niveau tout de suite, ce qui déclenchera
        // MfaChallenge avant ResetPasswordForm si nécessaire.
        setPasswordRecovery(true);
        setSession(sess);
        checkMfaAndProceed();
        return;
      }
      setSession(sess);
      if (sess) { checkMfaAndProceed(); refreshMfaStatus(); }
      else { setDataLoaded(false); setMfaState(null); setMfaEnrollOffer(false); setMfaEnabled(false); localStorage.removeItem(SNAPSHOT_KEY); }
    });
    return () => sub.subscription.unsubscribe();
  }, [checkMfaAndProceed, refreshMfaStatus]);

  const applySnapshot = useCallback((s) => {
    setFirms(s.firms || []); setAccounts(s.accounts || []); setExpenses(s.expenses || []);
    setPayouts(s.payouts || []); setGoalTranches(s.goal_tranches || []);
    setAccountEvents(s.account_events || []); setScalingHistory(s.scaling_history || []);
  }, []);

  const reload = useCallback(async () => {
    setRefreshing(true);
    try {
      const [f, a, e, p, g, ev, sh] = await Promise.all([
        api.listFirms(), api.listAccounts(), api.listExpenses(), api.listPayouts(), api.listGoalTranches(),
        api.listAccountEvents(), api.listAllScalingHistory(),
      ]);
      applySnapshot({ firms: f, accounts: a, expenses: e, payouts: p, goal_tranches: g, account_events: ev, scaling_history: sh });
      try { localStorage.setItem(SNAPSHOT_KEY, JSON.stringify({ ts: Date.now(), firms: f, accounts: a, expenses: e, payouts: p, goal_tranches: g, account_events: ev, scaling_history: sh })); } catch { /* quota */ }
      setDataLoaded(true);
      setLoadError(false);
    } catch {
      // Pas de reset de dataLoaded : si un cache existait, il reste affiché.
      setLoadError(true);
      toast.error("Impossible de charger tes données");
    } finally {
      setRefreshing(false);
    }
  }, [applySnapshot]);

  // Affichage instantané au refresh : on repeint l'UI depuis le dernier
  // snapshot AVANT même que la requête réseau ne réponde.
  useEffect(() => {
    if (session && !mfaState && !dataLoaded) {
      const snap = readSnapshot();
      if (snap) { applySnapshot(snap); setDataLoaded(true); }
    }
  }, [session, mfaState, dataLoaded, applySnapshot]);

  useEffect(() => {
    if (session && !mfaState) reload();
  }, [session, mfaState, reload]);

  // Retour de connectivité (Wi-Fi/DNS revenu après une coupure) : on
  // recharge silencieusement plutôt que d'attendre un F5.
  useEffect(() => {
    const onOnline = () => { if (session && !mfaState) reload(); };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [session, mfaState, reload]);

  const firmName = (id) => firms.find((f) => f.id === id)?.name || "—";
  const accountLabel = (id) => { const a = accounts.find((x) => x.id === id); return a ? `${firmName(a.firm_id)} ${a.size}` : "—"; };

  // Notifications de la sidebar, recalculées quand les données changent.
  const notifications = useMemo(() => buildNotifications({
    accounts, payouts, firms, accountEvents,
    accountLabel: (id) => {
      const a = accounts.find((x) => x.id === id);
      if (!a) return "—";
      const f = firms.find((y) => y.id === a.firm_id);
      return `${f ? f.name : "—"} ${a.size}`;
    },
  }), [accounts, payouts, firms, accountEvents]);

  const saveGoalTranches = async (year, list) => {
    await api.deleteGoalYear(year);
    await api.createGoalTranches(list.map((t) => ({ year, size: t.size, count: t.count })));
    reload();
  };

  if (session === undefined) {
    return <div className="app-root"><StyleGate /><ThemeToggle theme={theme} onToggle={toggleTheme} /><Splash /></div>;
  }
  if (passwordRecovery) {
    // Compte protégé par 2FA : il faut d'abord valider le code avant de
    // pouvoir choisir un nouveau mot de passe (exigence AAL2 de Supabase).
    if (mfaState) {
      return <><StyleGate /><ThemeToggle theme={theme} onToggle={toggleTheme} />
        <MfaChallenge factorId={mfaState.factorId} onVerified={() => setMfaState(null)} />
      </>;
    }
    return <><StyleGate /><ThemeToggle theme={theme} onToggle={toggleTheme} />
      <ResetPasswordForm onDone={() => { setPasswordRecovery(false); checkMfaAndProceed(); refreshMfaStatus(); }} />
    </>;
  }
  if (!session) {
    if (authView === "landing") {
      // Le toggle de thème vit dans la nav du Landing (variante statique) :
      // le toggle flottant recouvrait la nav collante.
      return <><StyleGate />
        <Landing
          theme={theme}
          onToggleTheme={toggleTheme}
          onLogin={() => { setAuthMode("signin"); setAuthView("login"); }}
          onSignup={() => { setAuthMode("signup"); setAuthView("login"); }}
        />
      </>;
    }
    return <><StyleGate />
      <LoginForm initialMode={authMode} theme={theme} onToggleTheme={toggleTheme} onSignedIn={() => {}} onBack={() => setAuthView("landing")} />
    </>;
  }
  if (mfaState) {
    return <><StyleGate /><ThemeToggle theme={theme} onToggle={toggleTheme} /><MfaChallenge factorId={mfaState.factorId} onVerified={() => setMfaState(null)} /></>;
  }
  if (mfaEnrollOffer) {
    return <><StyleGate /><ThemeToggle theme={theme} onToggle={toggleTheme} />
      <MfaEnroll onDone={() => { setMfaEnrollOffer(false); refreshMfaStatus(); }} onSkip={() => setMfaEnrollOffer(false)} />
    </>;
  }

  return (
    <div className="app-root">
      <StyleGate />
      <Toaster />
      {/* Cloche desktop : fixe en haut à droite (le header mobile a la sienne) */}
      <div className="notif-float">
        <NotificationBell items={notifications} onNavigate={setTab} />
      </div>
      <Sidebar
        tab={tab}
        setTab={setTab}
        onSignOut={() => supabase.auth.signOut()}
        session={session}
        notifications={notifications}
        onOpenSettings={() => setTab("settings")}
        onOpenProfile={() => setTab("profile")}
      />
      <main className="main" ref={mainRef} onScroll={handleMainScroll}>
        {refreshing && dataLoaded && <div className="topbar-progress" aria-hidden="true"><span /></div>}
        {!dataLoaded ? (
          loadError ? <LoadError onRetry={() => reload()} /> : <DashboardSkeleton />
        ) : (
          <>
            {/* Toutes les pages restent montées (états conservés entre onglets).
                Chacune a son propre ErrorBoundary : une page qui plante
                n'emmène pas les autres. "Compte propre" (lazy + recharts) n'est
                réellement monté qu'à la première visite de l'onglet. */}
            <PageTransition active={tab === "profile"}>
              <ErrorBoundary isolated>
                <Profile session={session} accounts={accounts} firms={firms} payouts={payouts}
                  mfaEnabled={mfaEnabled} onOpenSettings={() => setTab("settings")} />
              </ErrorBoundary>
            </PageTransition>
            <PageTransition active={tab === "settings"}>
              <ErrorBoundary isolated>
                <SettingsPage session={session} theme={theme} onToggleTheme={toggleTheme} onMfaChange={refreshMfaStatus} />
              </ErrorBoundary>
            </PageTransition>
            <PageTransition active={tab === "dashboard"}>
              <ErrorBoundary isolated>
                <Dashboard accounts={accounts} expenses={expenses} payouts={payouts} goalTranches={goalTranches}
                  currentYear={currentYear} saveGoalTranches={saveGoalTranches} accountLabel={accountLabel} firms={firms}
                  accountEvents={accountEvents} scalingHistory={scalingHistory}
                  selectedYear={dashboardYear} onChangeYear={setDashboardYear} />
              </ErrorBoundary>
            </PageTransition>
            <PageTransition active={tab === "firms"}>
              <ErrorBoundary isolated>
                <Firms firms={firms} accounts={accounts} reload={reload} />
              </ErrorBoundary>
            </PageTransition>
            <PageTransition active={tab === "accounts"}>
              <ErrorBoundary isolated>
                <Accounts accounts={accounts} firms={firms} payouts={payouts} expenses={expenses} reload={reload} />
              </ErrorBoundary>
            </PageTransition>
            <PageTransition active={tab === "personal"}>
              <ErrorBoundary isolated>
                <Suspense fallback={<SkeletonList />}>
                  {personalOpened ? <PersonalAccount /> : null}
                </Suspense>
              </ErrorBoundary>
            </PageTransition>
            <PageTransition active={tab === "expenses"}>
              <ErrorBoundary isolated>
                <Expenses expenses={expenses} accounts={accounts} firms={firms} reload={reload} />
              </ErrorBoundary>
            </PageTransition>
            <PageTransition active={tab === "payouts"}>
              <ErrorBoundary isolated>
                <Payouts payouts={payouts} accounts={accounts} firms={firms} reload={reload} />
              </ErrorBoundary>
            </PageTransition>
            <PageTransition active={tab === "goals"}>
              <ErrorBoundary isolated>
                <Goals accounts={accounts} expenses={expenses} payouts={payouts} goalTranches={goalTranches}
                  currentYear={currentYear} reload={reload} accountEvents={accountEvents} scalingHistory={scalingHistory} />
              </ErrorBoundary>
            </PageTransition>
          </>
        )}
      </main>
    </div>
  );
}

// styles.css is imported once globally in main.jsx; this is just a no-op
// placeholder kept for symmetry with the auth-only screens above.
function StyleGate() { return null; }