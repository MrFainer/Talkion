"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Eye,
  EyeOff,
  Lock,
  Mail,
  ShieldCheck,
  User,
} from "lucide-react";
import api from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type AuthView = "login" | "register" | "verify" | "forgot";

function AuthBackground() {
  return (
    <>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.2),transparent_30%),linear-gradient(180deg,#09090b_0%,#111827_45%,#0f172a_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:52px_52px] opacity-35" />
      <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_18%_22%,rgba(96,165,250,0.18)_0,transparent_28%),radial-gradient(circle_at_80%_30%,rgba(148,163,184,0.15)_0,transparent_24%),radial-gradient(circle_at_72%_76%,rgba(59,130,246,0.16)_0,transparent_28%)]" />
      <div className="absolute left-[8%] top-[28%] anim-float-slow">
        <div className="h-10 w-10 rotate-12 rounded-xl border border-blue-400/20" />
      </div>
      <div className="absolute right-[9%] top-[76%] anim-float-med">
        <div className="h-8 w-8 -rotate-6 rounded-lg border border-blue-400/20" />
      </div>
      <div className="absolute left-[16%] top-[16%] h-2 w-2 anim-glow rounded-full bg-blue-400/60" />
      <div className="absolute right-[18%] top-[22%] h-2.5 w-2.5 anim-drift rounded-full bg-slate-300/45" />
      <div className="absolute left-[20%] bottom-[18%] anim-float-fast">
        <div className="h-2.5 w-2.5 rounded-full bg-blue-400/50" />
      </div>
      <div className="absolute right-[33%] bottom-[11%] h-1.5 w-1.5 anim-glow rounded-full bg-slate-300/45" />
    </>
  );
}

function FieldIcon({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-blue-500/80">
      {children}
    </span>
  );
}

function RequirementItem({
  label,
  met,
}: {
  label: string;
  met: boolean;
}) {
  return (
    <div className={`flex items-center gap-2 text-xs ${met ? "text-blue-600" : "text-muted-foreground"}`}>
      <span className={`flex h-4 w-4 items-center justify-center rounded-full border ${met ? "border-blue-500 bg-blue-50 text-blue-600" : "border-border text-transparent"}`}>
        <Check className="h-3 w-3" />
      </span>
      <span>{label}</span>
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);
  const { login, isAuthenticated, isHydrated, hydrate } = useAuthStore();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (isHydrated && isAuthenticated) {
      router.push("/dashboard");
    }
  }, [isHydrated, isAuthenticated, router]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [verificationToken, setVerificationToken] = useState("");
  const [view, setView] = useState<AuthView>("login");
  const [registeredEmail, setRegisteredEmail] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [resetConfirmPassword, setResetConfirmPassword] = useState("");
  const [resetCodeSent, setResetCodeSent] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [showResetConfirmPassword, setShowResetConfirmPassword] = useState(false);
  const [loginErrorMessage, setLoginErrorMessage] = useState<string | null>(null);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCooldownSeconds, setResendCooldownSeconds] = useState(0);

  const validatePassword = (pass: string) => {
    const minLength = 8;
    const hasUpper = /[A-Z]/.test(pass);
    const hasLower = /[a-z]/.test(pass);
    const hasNumber = /[0-9]/.test(pass);
    const hasSpecial = /[\W_]/.test(pass);
    return pass.length >= minLength && hasUpper && hasLower && hasNumber && hasSpecial;
  };

  const normalizeEmail = (value: string) => value.trim().toLowerCase();

  useEffect(() => {
    if (view !== "verify" || resendCooldownSeconds <= 0) return;
    const intervalId = window.setInterval(() => {
      setResendCooldownSeconds((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(intervalId);
  }, [view, resendCooldownSeconds]);

  const passwordChecks = {
    minLength: password.length >= 8,
    hasUpper: /[A-Z]/.test(password),
    hasLower: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecial: /[\W_]/.test(password),
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedEmail = normalizeEmail(email);
    setLoading(true);
    setLoginErrorMessage(null);
    try {
      const response = await api.post("/auth/login", { email: normalizedEmail, password });
      login(response.data.user, response.data.access_token, rememberMe);
      toast.success("Login realizado com sucesso!");
      router.push("/dashboard");
    } catch (error: any) {
      if (error.response?.data?.message?.includes("não verificado")) {
        setRegisteredEmail(normalizedEmail);
        setView("verify");
        toast.error("Você precisa verificar seu e-mail antes de logar.");
      } else {
        const message = error.response?.data?.message || "Erro ao fazer login.";
        setLoginErrorMessage(message);
        toast.error(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedEmail = normalizeEmail(email);
    if (password !== confirmPassword) {
      toast.error("As senhas não coincidem.");
      return;
    }
    if (!validatePassword(password)) {
      toast.error("A senha deve ter pelo menos 8 caracteres, contendo maiúsculas, minúsculas, números e caracteres especiais.");
      return;
    }

    setLoading(true);
    try {
      const response = await api.post("/auth/register", { name, email: normalizedEmail, password });
      if (response.data.requiresVerification) {
        setRegisteredEmail(response.data.email);
        setView("verify");
        setResendCooldownSeconds(60);
        toast.success("Conta criada! Verifique seu e-mail.");
      } else {
        login(response.data.user, response.data.access_token, true);
        toast.success("Conta criada com sucesso!");
        router.push("/dashboard");
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Erro ao criar conta.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedEmail = normalizeEmail(registeredEmail);
    setLoading(true);
    try {
      const response = await api.post("/auth/verify-email", {
        email: normalizedEmail,
        token: verificationToken,
      });
      if (response.data?.access_token && response.data?.user) {
        login(response.data.user, response.data.access_token, true);
        toast.success("E-mail verificado com sucesso!");
        router.push("/dashboard");
      } else {
        toast.success(response.data?.message || "E-mail verificado.");
        setView("login");
        setEmail(normalizedEmail);
        setPassword("");
        setVerificationToken("");
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Token inválido.");
    } finally {
      setLoading(false);
    }
  };

  const extractSecondsFromMessage = (message: string): number | null => {
    const match = message.match(/(\d+)\s*(segundos|segundo|s)\b/i);
    if (!match) return null;
    const value = Number(match[1]);
    if (!Number.isFinite(value) || value <= 0) return null;
    return value;
  };

  const handleResendVerification = async () => {
    const normalizedEmail = normalizeEmail(registeredEmail);
    if (!normalizedEmail) {
      toast.error("Informe um e-mail para reenviar o código.");
      return;
    }

    setResendLoading(true);
    try {
      const response = await api.post("/auth/resend-verification", { email: normalizedEmail });
      toast.success(response.data?.message || "Código reenviado! Verifique seu e-mail.");
      setVerificationToken("");
      setResendCooldownSeconds(60);
    } catch (error: any) {
      const message = error.response?.data?.message || "Erro ao reenviar código.";
      const seconds = typeof message === "string" ? extractSecondsFromMessage(message) : null;
      if (seconds) setResendCooldownSeconds(seconds);
      toast.error(message);
    } finally {
      setResendLoading(false);
    }
  };

  const handleRequestPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedEmail = normalizeEmail(resetEmail);
    if (!normalizedEmail) {
      toast.error("Informe seu e-mail.");
      return;
    }

    setLoading(true);
    try {
      const response = await api.post("/auth/forgot-password", { email: normalizedEmail });
      setResetEmail(normalizedEmail);
      setResetCodeSent(true);
      toast.success(response.data.message || "Código enviado por e-mail.");
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Erro ao solicitar redefinição.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedEmail = normalizeEmail(resetEmail);
    if (resetPassword !== resetConfirmPassword) {
      toast.error("As senhas não coincidem.");
      return;
    }

    if (!validatePassword(resetPassword)) {
      toast.error("A nova senha precisa seguir os requisitos mínimos.");
      return;
    }

    setLoading(true);
    try {
      const response = await api.post("/auth/reset-password", {
        email: normalizedEmail,
        token: resetToken,
        password: resetPassword,
      });
      toast.success(response.data.message || "Senha redefinida com sucesso.");
      setView("login");
      setPassword("");
      setConfirmPassword("");
      setResetToken("");
      setResetPassword("");
      setResetConfirmPassword("");
      setResetCodeSent(false);
      setEmail(normalizedEmail);
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Erro ao redefinir senha.");
    } finally {
      setLoading(false);
    }
  };

  const authTitle =
    view === "login"
      ? "Bem-vindo de volta"
      : view === "register"
        ? "Criar nova conta"
        : view === "verify"
          ? "Verifique seu e-mail"
          : "Recuperar senha";

  const authDescription =
    view === "login"
      ? ""
      : view === "register"
        ? ""
        : view === "verify"
          ? `Enviamos um código para ${registeredEmail}. Digite abaixo para liberar o acesso.`
          : resetCodeSent
            ? `Digite o código enviado para ${resetEmail} e escolha sua nova senha.`
            : "Informe seu e-mail para receber o código de redefinição.";
  const isRegisterView = view === "register";

  useEffect(() => {
    const titleByView: Record<AuthView, string> = {
      login: "Talkion - Entrar",
      register: "Talkion - Criar Conta",
      verify: "Talkion - Verificar E-mail",
      forgot: "Talkion - Recuperar Senha",
    };

    document.title = titleByView[view];
  }, [view]);

  return (
    <div className="relative min-h-full w-full flex-1 overflow-hidden">
      <AuthBackground />

      <div className={`relative z-10 flex min-h-full w-full flex-col items-center justify-center px-4 py-6 transition-all duration-[400ms] ease-in-out sm:px-6 ${leaving ? "translate-y-2 opacity-0" : "translate-y-0 opacity-100"}`}>
        <div className={`w-full ${isRegisterView ? "max-w-2xl" : "max-w-md"}`}>
          <Link
            href="/"
            onClick={(e) => {
              e.preventDefault();
              setLeaving(true);
              setTimeout(() => router.push("/"), 400);
            }}
            className="mb-3 flex w-fit items-center gap-1.5 text-sm font-medium text-slate-400 transition-all duration-200 hover:gap-3 hover:text-slate-200"
          >
            <ArrowLeft className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-1" />
            Voltar para home
          </Link>
          <div className="w-full rounded-[24px] border border-white/10 bg-white/95 p-4 shadow-[0_30px_80px_rgba(2,6,23,0.55)] backdrop-blur sm:p-6">
            <div className="mb-4 text-center">
              <div className="mb-3 flex justify-center">
                <Link href="/" className="inline-flex items-center gap-2.5 rounded-full bg-slate-950 px-3.5 py-1.5 text-white ring-1 ring-slate-800 transition hover:bg-slate-800">
                  <Image
                    src="/logo-branco.png"
                    alt="Talkion"
                    width={22}
                    height={22}
                    className="h-5 w-5 shrink-0 object-contain"
                  />
                  <span className="text-lg font-semibold tracking-tight">Talkion</span>
                </Link>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-800 sm:text-[1.85rem]">
                {authTitle}
              </h1>
              {authDescription ? (
                <p className="mt-1.5 text-sm leading-5 text-slate-500">
                  {authDescription}
                </p>
              ) : null}
            </div>

            {view === "login" || view === "register" ? (
              <>
                <div className="mb-4 grid grid-cols-2 rounded-2xl bg-slate-100 p-1">
                  <button
                    type="button"
                    onClick={() => setView("login")}
                    className={`rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                      view === "login"
                        ? "bg-white text-slate-950 shadow-sm"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    Entrar
                  </button>
                  <button
                    type="button"
                    onClick={() => setView("register")}
                    className={`rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                      view === "register"
                        ? "bg-white text-slate-950 shadow-sm"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    Criar Conta
                  </button>
                </div>

                {view === "login" ? (
                  <div key="login-view" className="animate-in fade-in-0 slide-in-from-left-1 duration-300">
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="email" className="text-sm font-medium text-slate-700">
                        E-mail
                      </Label>
                      <div className="relative">
                        <FieldIcon>
                          <Mail className="h-4 w-4" />
                        </FieldIcon>
                        <Input
                          id="email"
                          type="email"
                          placeholder="meu@email.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                          className="h-11 rounded-xl border-slate-200 bg-white pl-10 pr-4 shadow-none"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="password" className="text-sm font-medium text-slate-700">
                        Senha
                      </Label>
                      <div className="relative">
                        <FieldIcon>
                          <Lock className="h-4 w-4" />
                        </FieldIcon>
                        <Input
                          id="password"
                          type={showLoginPassword ? "text" : "password"}
                          placeholder="Sua senha"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          className="h-11 rounded-xl border-slate-200 bg-white pl-10 pr-12 shadow-none"
                        />
                        <button
                          type="button"
                          onClick={() => setShowLoginPassword((current) => !current)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600"
                          aria-label={showLoginPassword ? "Ocultar senha" : "Mostrar senha"}
                        >
                          {showLoginPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    {loginErrorMessage ? (
                      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        {loginErrorMessage}
                      </div>
                    ) : null}

                    <div className="flex items-center justify-start gap-3 text-sm">
                      <label className="flex items-center gap-2 text-slate-500">
                        <input
                          type="checkbox"
                          checked={rememberMe}
                          onChange={(e) => setRememberMe(e.target.checked)}
                          className="h-4 w-4 rounded border-slate-300 text-blue-600"
                        />
                        Lembrar de mim
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setResetEmail(email);
                          setResetCodeSent(false);
                          setResetToken("");
                          setResetPassword("");
                          setResetConfirmPassword("");
                          setView("forgot");
                        }}
                        className="ml-auto text-sm font-medium text-blue-600 transition hover:text-blue-700"
                      >
                        Esqueceu sua senha?
                      </button>
                    </div>

                    <Button
                      type="submit"
                      className="h-11 w-full rounded-xl bg-slate-950 text-sm font-semibold text-white shadow-[0_16px_30px_rgba(15,23,42,0.25)] hover:bg-slate-900"
                      disabled={loading}
                    >
                      {loading ? "Entrando..." : "Entrar"}
                    </Button>
                  </form>
                  </div>
                ) : (
                  <div key="register-view" className="animate-in fade-in-0 slide-in-from-right-1 duration-300">
                  <form onSubmit={handleRegister} className="space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                      <Label htmlFor="name-register" className="text-sm font-medium text-slate-700">
                        Nome completo
                      </Label>
                      <div className="relative">
                        <FieldIcon>
                          <User className="h-4 w-4" />
                        </FieldIcon>
                        <Input
                          id="name-register"
                          type="text"
                          placeholder="Seu nome completo"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          required
                          className="h-10.5 rounded-xl border-slate-200 bg-white pl-10 pr-4 shadow-none"
                        />
                      </div>
                      </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="email-register" className="text-sm font-medium text-slate-700">
                        E-mail
                      </Label>
                      <div className="relative">
                        <FieldIcon>
                          <Mail className="h-4 w-4" />
                        </FieldIcon>
                        <Input
                          id="email-register"
                          type="email"
                          placeholder="meu@email.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                          className="h-10.5 rounded-xl border-slate-200 bg-white pl-10 pr-4 shadow-none"
                        />
                      </div>
                    </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="password-register" className="text-sm font-medium text-slate-700">
                        Senha
                      </Label>
                      <div className="relative">
                        <FieldIcon>
                          <Lock className="h-4 w-4" />
                        </FieldIcon>
                        <Input
                          id="password-register"
                          type={showRegisterPassword ? "text" : "password"}
                          placeholder="Sua senha"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          className="h-10.5 rounded-xl border-slate-200 bg-white pl-10 pr-12 shadow-none"
                        />
                        <button
                          type="button"
                          onClick={() => setShowRegisterPassword((current) => !current)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600"
                          aria-label={showRegisterPassword ? "Ocultar senha" : "Mostrar senha"}
                        >
                          {showRegisterPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="confirm-password-register" className="text-sm font-medium text-slate-700">
                        Repita a senha
                      </Label>
                      <div className="relative">
                        <FieldIcon>
                          <ShieldCheck className="h-4 w-4" />
                        </FieldIcon>
                        <Input
                          id="confirm-password-register"
                          type={showConfirmPassword ? "text" : "password"}
                          placeholder="Sua senha"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          required
                          className="h-10.5 rounded-xl border-slate-200 bg-white pl-10 pr-12 shadow-none"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword((current) => !current)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600"
                          aria-label={showConfirmPassword ? "Ocultar confirmação de senha" : "Mostrar confirmação de senha"}
                        >
                          {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    </div>

                    <div className="grid gap-1.5 sm:grid-cols-3">
                      <RequirementItem label="8+ caracteres" met={passwordChecks.minLength} />
                      <RequirementItem label="Maiúscula" met={passwordChecks.hasUpper} />
                      <RequirementItem label="Minúscula" met={passwordChecks.hasLower} />
                      <RequirementItem label="Número" met={passwordChecks.hasNumber} />
                      <RequirementItem label="Símbolo" met={passwordChecks.hasSpecial} />
                    </div>

                    <Button
                      type="submit"
                      className="h-11 w-full rounded-xl bg-slate-950 text-sm font-semibold text-white shadow-[0_16px_30px_rgba(15,23,42,0.25)] hover:bg-slate-900"
                      disabled={loading}
                    >
                      {loading ? "Criando..." : "Criar Conta"}
                    </Button>
                  </form>
                  </div>
                )}
              </>
            ) : view === "forgot" ? (
              <div key="forgot-view" className="animate-in fade-in-0 zoom-in-95 duration-300">
                {!resetCodeSent ? (
                  <form onSubmit={handleRequestPasswordReset} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="reset-email" className="text-sm font-medium text-slate-700">
                        E-mail
                      </Label>
                      <div className="relative">
                        <FieldIcon>
                          <Mail className="h-4 w-4" />
                        </FieldIcon>
                        <Input
                          id="reset-email"
                          type="email"
                          placeholder="meu@email.com"
                          value={resetEmail}
                          onChange={(e) => setResetEmail(e.target.value)}
                          required
                          className="h-11 rounded-xl border-slate-200 bg-white pl-10 pr-4 shadow-none"
                        />
                      </div>
                    </div>

                    <Button
                      type="submit"
                      className="h-11 w-full rounded-xl bg-slate-950 text-sm font-semibold text-white shadow-[0_16px_30px_rgba(15,23,42,0.25)] hover:bg-slate-900"
                      disabled={loading}
                    >
                      {loading ? "Enviando..." : "Enviar código"}
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 w-full rounded-xl border-slate-200"
                      onClick={() => setView("login")}
                    >
                      Voltar para o login
                    </Button>
                  </form>
                ) : (
                  <form onSubmit={handleResetPassword} className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="reset-token" className="text-sm font-medium text-slate-700">
                        Código
                      </Label>
                      <Input
                        id="reset-token"
                        type="text"
                        placeholder="000000"
                        value={resetToken}
                        onChange={(e) => setResetToken(e.target.value)}
                        maxLength={6}
                        required
                        className="h-11 rounded-xl border-slate-200 bg-white text-center text-lg tracking-[0.25em] shadow-none"
                      />
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="reset-password" className="text-sm font-medium text-slate-700">
                          Nova senha
                        </Label>
                        <div className="relative">
                          <FieldIcon>
                            <Lock className="h-4 w-4" />
                          </FieldIcon>
                          <Input
                            id="reset-password"
                            type={showResetPassword ? "text" : "password"}
                            placeholder="Sua senha"
                            value={resetPassword}
                            onChange={(e) => setResetPassword(e.target.value)}
                            required
                            className="h-10.5 rounded-xl border-slate-200 bg-white pl-10 pr-12 shadow-none"
                          />
                          <button
                            type="button"
                            onClick={() => setShowResetPassword((current) => !current)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600"
                            aria-label={showResetPassword ? "Ocultar senha" : "Mostrar senha"}
                          >
                            {showResetPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="reset-confirm-password" className="text-sm font-medium text-slate-700">
                          Repita a senha
                        </Label>
                        <div className="relative">
                          <FieldIcon>
                            <ShieldCheck className="h-4 w-4" />
                          </FieldIcon>
                          <Input
                            id="reset-confirm-password"
                            type={showResetConfirmPassword ? "text" : "password"}
                            placeholder="Sua senha"
                            value={resetConfirmPassword}
                            onChange={(e) => setResetConfirmPassword(e.target.value)}
                            required
                            className="h-10.5 rounded-xl border-slate-200 bg-white pl-10 pr-12 shadow-none"
                          />
                          <button
                            type="button"
                            onClick={() => setShowResetConfirmPassword((current) => !current)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600"
                            aria-label={showResetConfirmPassword ? "Ocultar confirmação de senha" : "Mostrar confirmação de senha"}
                          >
                            {showResetConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                    </div>

                    <Button
                      type="submit"
                      className="h-11 w-full rounded-xl bg-slate-950 text-sm font-semibold text-white shadow-[0_16px_30px_rgba(15,23,42,0.25)] hover:bg-slate-900"
                      disabled={loading}
                    >
                      {loading ? "Redefinindo..." : "Redefinir senha"}
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 w-full rounded-xl border-slate-200"
                      onClick={() => {
                        setResetCodeSent(false);
                        setResetToken("");
                      }}
                    >
                      Voltar
                    </Button>
                  </form>
                )}
              </div>
            ) : (
              <div key="verify-view" className="animate-in fade-in-0 zoom-in-95 duration-300">
              <form onSubmit={handleVerify} className="space-y-4">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-950 text-white ring-1 ring-slate-800">
                  <ShieldCheck className="h-7 w-7" />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="token" className="text-sm font-medium text-slate-700">
                    Código de verificação
                  </Label>
                  <Input
                    id="token"
                    type="text"
                    placeholder="000000"
                    value={verificationToken}
                    onChange={(e) => setVerificationToken(e.target.value)}
                    maxLength={6}
                    required
                    className="h-12 rounded-xl border-slate-200 bg-white text-center text-xl tracking-[0.35em] shadow-none"
                  />
                </div>

                <Button
                  type="submit"
                  className="h-11 w-full rounded-xl bg-slate-950 text-sm font-semibold text-white shadow-[0_16px_30px_rgba(15,23,42,0.25)] hover:bg-slate-900"
                  disabled={loading || verificationToken.length < 6}
                >
                  {loading ? "Verificando..." : "Verificar e entrar"}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className="h-11 w-full rounded-xl border-slate-200"
                  onClick={handleResendVerification}
                  disabled={resendLoading || resendCooldownSeconds > 0}
                >
                  {resendLoading
                    ? "Reenviando..."
                    : resendCooldownSeconds > 0
                      ? `Reenviar código em ${resendCooldownSeconds}s`
                      : "Reenviar código"}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className="h-11 w-full rounded-xl border-slate-200"
                  onClick={() => setView("login")}
                >
                  Voltar para o login
                </Button>
              </form>
              </div>
            )}
          <p className="mt-4 text-center text-[11px] text-slate-500">
            © 2026 Talkion. Todos os direitos reservados.
          </p>
        </div>
        </div>
      </div>
    </div>
  );
}
