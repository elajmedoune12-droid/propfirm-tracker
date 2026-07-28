import React, { useState, useEffect, useLayoutEffect, useCallback, useRef } from "react";
import { AnimatePresence } from "framer-motion";
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
import { SkeletonList } from "./components/Skeleton";
import * as api from "./lib/api";

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = loading, null = signed out
  const [authView, setAuthView] = useState("landing"); // landing | login (only used while signed out)
  const [authMode, setAuthMode] = useState("signin"); // signin | signup, passed to LoginForm as the initial mode
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const [mfaState, setMfaState] = useState(null); // { factorId } when a challenge is pending
  const [mfaEnrollOffer, setMfaEnrollOffer] = useState(false);
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [tab, setTab] = useState("dashboard");

  // Mémoire de scroll par onglet : chaque tab garde sa propre position, isolée
  // des autres. On sauvegarde en continu (onScroll) et on restaure au switch,
  // avant le prochain paint (useLayoutEffect) pour éviter tout flash visuel
  // à l'ancienne position.
  const mainRef = useRef(null);
  const scrollPositions = useRef({});
  const handleMainScroll = useCallback(() => {
    if (mainRef.current) scrollPositions.current[tab] = mainRef.current.scrollTop;
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

  const currentYear = new Date().getFullYear();
  const [dashboardYear, setDashboardYear] = useState(currentYear);

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
      else { setDataLoaded(false); setMfaState(null); setMfaEnrollOffer(false); setMfaEnabled(false); }
    });
    return () => sub.subscription.unsubscribe();
  }, [checkMfaAndProceed, refreshMfaStatus]);

  const reload = useCallback(async () => {
    const [f, a, e, p, g, ev, sh] = await Promise.all([
      api.listFirms(), api.listAccounts(), api.listExpenses(), api.listPayouts(), api.listGoalTranches(),
      api.listAccountEvents(), api.listAllScalingHistory(),
    ]);
    setFirms(f); setAccounts(a); setExpenses(e); setPayouts(p); setGoalTranches(g);
    setAccountEvents(ev); setScalingHistory(sh);
    setDataLoaded(true);
  }, []);

  useEffect(() => {
    if (session && !mfaState) reload();
  }, [session, mfaState, reload]);

  const firmName = (id) => firms.find((f) => f.id === id)?.name || "—";
  const accountLabel = (id) => { const a = accounts.find((x) => x.id === id); return a ? `${firmName(a.firm_id)} ${a.size}` : "—"; };

  const saveGoalTranches = async (year, list) => {
    await api.deleteGoalYear(year);
    await api.createGoalTranches(list.map((t) => ({ year, size: t.size, count: t.count })));
    reload();
  };

  if (session === undefined) {
    return <div className="app-root"><StyleGate /><ThemeToggle theme={theme} onToggle={toggleTheme} /><div className="loading-screen">Chargement…</div></div>;
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
      return <><StyleGate /><ThemeToggle theme={theme} onToggle={toggleTheme} />
        <Landing
          onLogin={() => { setAuthMode("signin"); setAuthView("login"); }}
          onSignup={() => { setAuthMode("signup"); setAuthView("login"); }}
        />
      </>;
    }
    return <><StyleGate /><ThemeToggle theme={theme} onToggle={toggleTheme} />
      <LoginForm initialMode={authMode} onSignedIn={() => {}} onBack={() => setAuthView("landing")} />
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
      <Sidebar
        tab={tab}
        setTab={setTab}
        onSignOut={() => supabase.auth.signOut()}
        session={session}
        onOpenSettings={() => setTab("settings")}
        onOpenProfile={() => setTab("profile")}
      />
      <main className="main" ref={mainRef} onScroll={handleMainScroll}>
        {!dataLoaded ? (
          <SkeletonList />
        ) : (
          <AnimatePresence mode="wait">
            <PageTransition key={tab}>
              {tab === "profile" && (
                <Profile
                  session={session}
                  accounts={accounts}
                  firms={firms}
                  payouts={payouts}
                  mfaEnabled={mfaEnabled}
                  onOpenSettings={() => setTab("settings")}
                />
              )}
              {tab === "settings" && (
                <SettingsPage
                  session={session}
                  theme={theme}
                  onToggleTheme={toggleTheme}
                  onMfaChange={refreshMfaStatus}
                />
              )}
              {tab === "dashboard" && (
                <Dashboard accounts={accounts} expenses={expenses} payouts={payouts} goalTranches={goalTranches}
                  currentYear={currentYear} saveGoalTranches={saveGoalTranches} accountLabel={accountLabel} firms={firms}
                  accountEvents={accountEvents} scalingHistory={scalingHistory}
                  selectedYear={dashboardYear} onChangeYear={setDashboardYear} />
              )}
              {tab === "firms" && <Firms firms={firms} accounts={accounts} reload={reload} />}
              {tab === "accounts" && <Accounts accounts={accounts} firms={firms} payouts={payouts} reload={reload} />}
              {tab === "expenses" && <Expenses expenses={expenses} accounts={accounts} firms={firms} reload={reload} />}
              {tab === "payouts" && <Payouts payouts={payouts} accounts={accounts} firms={firms} reload={reload} />}
              {tab === "goals" && (
                <Goals accounts={accounts} expenses={expenses} payouts={payouts} goalTranches={goalTranches}
                  currentYear={currentYear} reload={reload} accountEvents={accountEvents} scalingHistory={scalingHistory} />
              )}
            </PageTransition>
          </AnimatePresence>
        )}
      </main>
    </div>
  );
}

// styles.css is imported once globally in main.jsx; this is just a no-op
// placeholder kept for symmetry with the auth-only screens above.
function StyleGate() { return null; }