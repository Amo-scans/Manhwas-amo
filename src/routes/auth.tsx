import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { AlertTriangle, Eye, EyeOff, Loader2, MailCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/hooks/use-auth";
import { SiteNav } from "@/components/site-nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { buildPageMeta, canonicalLink } from "@/lib/seo";
import { cn } from "@/lib/utils";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;
const RESEND_COOLDOWN_SECONDS = 30;

type AuthMode = "signin" | "signup" | "forgot" | "reset";
type PendingAction = "signin" | "signup" | "forgot" | "reset" | "google" | "resend" | null;

type FieldErrors = {
  email?: string;
  password?: string;
  confirm?: string;
  name?: string;
};

type AuthSearch = {
  redirect?: string;
  mode?: "reset";
};

/**
 * Only same-app absolute paths are accepted as post-login destinations — never
 * a protocol-relative URL or a fully qualified external URL.
 */
function sanitizeInternalRedirect(raw: string | undefined): string | null {
  if (!raw) return null;
  const value = raw.trim();
  if (value.length === 0 || value.length > 512) return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  if (value.includes("\\")) return null;
  if (Array.from(value).some((character) => character.charCodeAt(0) < 32)) return null;
  if (/^\/[a-z][a-z0-9+.-]*:/i.test(value)) return null;
  return value;
}

/** Absolute URL of this page, honouring a sub-path deployment such as GitHub Pages. */
function authPageUrl(): string {
  if (typeof window === "undefined") return "/auth";
  const base = ((import.meta.env.BASE_URL as string | undefined) ?? "/").replace(/\/+$/, "");
  return `${window.location.origin}${base}/auth`;
}

function readableAuthError(error: unknown): string {
  const raw = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  const message = raw.toLowerCase();

  if (message.includes("invalid login credentials")) return "Email or password is incorrect.";
  if (message.includes("email not confirmed")) {
    return "Please confirm your email address first — check your inbox for the confirmation link.";
  }
  if (message.includes("user already registered") || message.includes("already been registered")) {
    return "An account with this email already exists. Sign in instead.";
  }
  if (
    message.includes("password should be at least") ||
    message.includes("password is too short")
  ) {
    return `Password is too short — use at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (message.includes("rate limit") || message.includes("too many")) {
    return "Too many attempts. Please wait a minute and try again.";
  }
  if (message.includes("invalid email")) return "Enter a valid email address.";
  if (
    message.includes("auth session missing") ||
    message.includes("session_not_found") ||
    message.includes("invalid or has expired") ||
    message.includes("token has expired") ||
    message.includes("jwt")
  ) {
    return "This link is invalid or has expired. Request a new one.";
  }
  if (
    message.includes("provider is not enabled") ||
    message.includes("unsupported provider") ||
    message.includes("could not find provider")
  ) {
    return "Google sign-in isn't configured for this project. Use email and password instead.";
  }
  if (
    message.includes("failed to fetch") ||
    message.includes("networkerror") ||
    message.includes("network request failed")
  ) {
    return "Network error — check your connection and try again.";
  }
  if (message.includes("signup is disabled")) return "Account creation is disabled on this site.";
  return raw.trim() || "Something went wrong. Please try again.";
}

type PasswordInputProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  placeholder?: string;
  error?: string;
  hint?: string;
  disabled?: boolean;
  /** Optional element rendered on the right of the label row (e.g. "Forgot password?"). */
  action?: ReactNode;
};

function PasswordInput({
  id,
  label,
  value,
  onChange,
  autoComplete,
  placeholder = "At least 8 characters",
  error,
  hint,
  disabled = false,
  action,
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const descriptionId = `${id}-description`;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id} className="text-xs uppercase tracking-widest text-muted-foreground">
          {label}
        </Label>
        {action ?? null}
      </div>
      <div className="relative">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          placeholder={placeholder}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? descriptionId : undefined}
          className="h-11 border-neutral-800 bg-base pr-11 text-sm"
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          disabled={disabled}
          aria-label={visible ? "Hide password" : "Show password"}
          title={visible ? "Hide password" : "Show password"}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-md text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
        >
          {visible ? (
            <EyeOff className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Eye className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>
      {error ? (
        <p id={descriptionId} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={descriptionId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true" focusable="false">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"
      />
    </svg>
  );
}

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): AuthSearch => {
    const redirect = typeof search.redirect === "string" ? search.redirect : undefined;
    const mode = search.mode === "reset" ? "reset" : undefined;
    return { redirect, mode };
  },
  head: () => ({
    meta: buildPageMeta({
      title: "Sign in — AMO-SCANS-FR",
      description:
        "Sign in, create an account or reset your password to comment on chapters and manage your studio.",
      path: "/auth",
      noindex: true,
    }),
    links: [canonicalLink("/auth")],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const { user, loading: authLoading } = useAuth();
  const redirectTarget = sanitizeInternalRedirect(search.redirect);

  const [mode, setMode] = useState<AuthMode>(search.mode === "reset" ? "reset" : "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingAction>(null);
  const [confirmationEmail, setConfirmationEmail] = useState<string | null>(null);
  const [resetSentTo, setResetSentTo] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const recoveryRef = useRef(false);

  /* Detect password-recovery links before the redirect effect can bounce the user away. */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash.replace(/^#/, "");
    const hashParams = hash ? new URLSearchParams(hash) : null;
    const isRecovery = hashParams?.get("type") === "recovery";
    if (isRecovery || search.mode === "reset") {
      recoveryRef.current = true;
      setMode("reset");
    } else if (hashParams) {
      const linkError = hashParams.get("error_description");
      if (linkError) {
        setFormError(
          /expired|invalid/i.test(linkError)
            ? "That email link is invalid or has expired. Request a new one below."
            : linkError,
        );
      }
    }
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        recoveryRef.current = true;
        setMode("reset");
      }
    });
    return () => subscription.unsubscribe();
  }, [search.mode]);

  /* Signed-in visitors never need the form (except while choosing a new password). */
  useEffect(() => {
    if (authLoading || !user) return;
    if (mode === "reset" || recoveryRef.current) return;
    navigate({ href: redirectTarget ?? "/", replace: true });
  }, [authLoading, user, mode, redirectTarget, navigate]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const clearFieldError = (field: keyof FieldErrors) => {
    setErrors((current) => ({ ...current, [field]: undefined }));
    setFormError(null);
  };

  const switchMode = (next: AuthMode) => {
    setMode(next);
    setErrors({});
    setFormError(null);
    setPassword("");
    setConfirmPassword("");
  };

  const startCooldown = () => setCooldown(RESEND_COOLDOWN_SECONDS);

  const validate = (): FieldErrors => {
    const next: FieldErrors = {};
    const trimmedEmail = email.trim();

    if (mode === "signin" || mode === "signup" || mode === "forgot") {
      if (!trimmedEmail) next.email = "Email is required.";
      else if (!EMAIL_PATTERN.test(trimmedEmail)) next.email = "Enter a valid email address.";
    }

    if (mode === "signin" || mode === "signup" || mode === "reset") {
      if (!password) next.password = "Password is required.";
      else if (password.length < MIN_PASSWORD_LENGTH) {
        next.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
      }
    }

    if (mode === "signup" && displayName.trim().length > 80) {
      next.name = "Keep the display name under 80 characters.";
    }

    if (mode === "reset") {
      if (!confirmPassword) next.confirm = "Confirm your new password.";
      else if (password !== confirmPassword) next.confirm = "Passwords don't match.";
    }

    return next;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    setFormError(null);
    const validation = validate();
    setErrors(validation);
    if (Object.keys(validation).length > 0) return;

    const trimmedEmail = email.trim();

    try {
      if (mode === "signin") {
        setPending("signin");
        const { error } = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password,
        });
        if (error) throw error;
        toast.success("Welcome back!");
        navigate({ href: redirectTarget ?? "/", replace: true });
        return;
      }

      if (mode === "signup") {
        setPending("signup");
        const { data, error } = await supabase.auth.signUp({
          email: trimmedEmail,
          password,
          options: {
            emailRedirectTo: authPageUrl(),
            data: {
              full_name: displayName.trim() || trimmedEmail.split("@")[0],
            },
          },
        });
        if (error) throw error;
        if (data.session) {
          toast.success("Account created — you're signed in.");
          navigate({ href: redirectTarget ?? "/", replace: true });
        } else {
          setConfirmationEmail(trimmedEmail);
          toast.success("Account created. Check your inbox to confirm your email.");
        }
        return;
      }

      if (mode === "forgot") {
        setPending("forgot");
        const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
          redirectTo: authPageUrl(),
        });
        if (error) throw error;
        setResetSentTo(trimmedEmail);
        startCooldown();
        toast.success("Password reset link sent.");
        return;
      }

      /* mode === "reset" */
      if (!user) {
        setFormError("This reset link is invalid or has expired. Request a new reset email.");
        return;
      }
      setPending("reset");
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      recoveryRef.current = false;
      // End the recovery session so the author signs in knowingly with the new
      // password (also prevents the "already signed in" redirect from firing).
      await supabase.auth.signOut().catch(() => undefined);
      toast.success("Password updated — sign in with your new password.");
      setPassword("");
      setConfirmPassword("");
      switchMode("signin");
    } catch (error) {
      setFormError(readableAuthError(error));
    } finally {
      setPending(null);
    }
  };

  const handleGoogle = async () => {
    if (pending) return;
    setFormError(null);
    setPending("google");
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        setFormError(readableAuthError(result.error));
        return;
      }
      if (result.redirected) return;
      // The helper already stored the session; the redirect effect navigates once
      // `useAuth` catches up.
      navigate({ href: redirectTarget ?? "/", replace: true });
    } catch (error) {
      setFormError(
        `${readableAuthError(error)} You can still sign in with your email and password.`,
      );
    } finally {
      setPending(null);
    }
  };

  const resendConfirmation = async () => {
    if (!confirmationEmail || pending || cooldown > 0) return;
    setPending("resend");
    setFormError(null);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: confirmationEmail,
        options: { emailRedirectTo: authPageUrl() },
      });
      if (error) throw error;
      startCooldown();
      toast.success("Confirmation email sent again.");
    } catch (error) {
      setFormError(readableAuthError(error));
    } finally {
      setPending(null);
    }
  };

  const resendReset = async () => {
    if (!resetSentTo || pending || cooldown > 0) return;
    setPending("resend");
    setFormError(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetSentTo, {
        redirectTo: authPageUrl(),
      });
      if (error) throw error;
      startCooldown();
      toast.success("Reset link sent again.");
    } catch (error) {
      setFormError(readableAuthError(error));
    } finally {
      setPending(null);
    }
  };

  const heading =
    mode === "signin"
      ? "Welcome back"
      : mode === "signup"
        ? "Create your account"
        : mode === "forgot"
          ? "Reset your password"
          : "Choose a new password";

  const subheading =
    mode === "signin"
      ? "Sign in to comment, follow your favourite series and manage your studio."
      : mode === "signup"
        ? "Join the community — it only takes a minute."
        : mode === "forgot"
          ? "Enter the email linked to your account and we'll send you a reset link."
          : "You opened a recovery link. Set a new password to finish.";

  const submitLabel =
    pending === "signin"
      ? "Signing in…"
      : pending === "signup"
        ? "Creating account…"
        : pending === "forgot"
          ? "Sending reset link…"
          : pending === "reset"
            ? "Updating password…"
            : mode === "signin"
              ? "Sign in"
              : mode === "signup"
                ? "Create account"
                : "Send reset link";

  const errorBanner = formError ? (
    <div
      role="alert"
      className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
    >
      {formError}
    </div>
  ) : null;

  const footer = (
    <p className="mt-8 text-center">
      <Link
        to="/"
        className="text-xs uppercase tracking-widest text-muted-foreground transition hover:text-foreground"
      >
        ← Back to library
      </Link>
    </p>
  );

  return (
    <div className="min-h-screen bg-base">
      <SiteNav />
      <main className="mx-auto w-full max-w-md px-5 py-12 sm:py-16">
        <div className="rounded-2xl border border-neutral-800 bg-surface/50 p-6 shadow-xl sm:p-8">
          {confirmationEmail ? (
            <div className="text-center">
              <MailCheck className="mx-auto h-10 w-10 text-accent" aria-hidden="true" />
              <h1 className="mt-4 text-2xl font-semibold text-foreground">Confirm your email</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                We created your account. Click the confirmation link sent to{" "}
                <span className="font-medium text-foreground">{confirmationEmail}</span> to activate
                it.
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Can't find it? Check your spam folder or resend the email below.
              </p>
              <div className="mt-4 space-y-3">
                {errorBanner}
                <Button
                  type="button"
                  onClick={() => void resendConfirmation()}
                  disabled={pending !== null || cooldown > 0}
                  className="h-11 w-full bg-accent text-accent-foreground hover:bg-accent/90"
                >
                  {pending === "resend" ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : null}
                  {cooldown > 0
                    ? `Resend in ${cooldown}s`
                    : pending === "resend"
                      ? "Sending…"
                      : "Resend confirmation email"}
                </Button>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmationEmail(null);
                    setErrors({});
                    setFormError(null);
                  }}
                  className="text-sm text-muted-foreground transition hover:text-foreground"
                >
                  Use a different email
                </button>
              </div>
            </div>
          ) : resetSentTo ? (
            <div className="text-center">
              <MailCheck className="mx-auto h-10 w-10 text-accent" aria-hidden="true" />
              <h1 className="mt-4 text-2xl font-semibold text-foreground">Check your inbox</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                We sent a password reset link to{" "}
                <span className="font-medium text-foreground">{resetSentTo}</span>. The link expires
                in about an hour.
              </p>
              <div className="mt-4 space-y-3">
                {errorBanner}
                <Button
                  type="button"
                  onClick={() => void resendReset()}
                  disabled={pending !== null || cooldown > 0}
                  className="h-11 w-full bg-accent text-accent-foreground hover:bg-accent/90"
                >
                  {pending === "resend" ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : null}
                  {cooldown > 0
                    ? `Resend in ${cooldown}s`
                    : pending === "resend"
                      ? "Sending…"
                      : "Resend reset link"}
                </Button>
                <button
                  type="button"
                  onClick={() => {
                    setResetSentTo(null);
                    setErrors({});
                    setFormError(null);
                  }}
                  className="text-sm text-muted-foreground transition hover:text-foreground"
                >
                  Use a different email
                </button>
              </div>
            </div>
          ) : mode === "reset" ? (
            authLoading ? (
              <div className="flex flex-col items-center gap-3 py-6 text-sm text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                Preparing your password reset…
              </div>
            ) : !user ? (
              <div className="text-center">
                <AlertTriangle className="mx-auto h-10 w-10 text-destructive" aria-hidden="true" />
                <h1 className="mt-4 text-2xl font-semibold text-foreground">Reset link expired</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  This link is invalid or has expired. Request a fresh reset email to choose a new
                  password.
                </p>
                <div className="mt-4 space-y-3">
                  {errorBanner}
                  <Button
                    type="button"
                    onClick={() => switchMode("forgot")}
                    className="h-11 w-full bg-accent text-accent-foreground hover:bg-accent/90"
                  >
                    Send a new reset link
                  </Button>
                  <button
                    type="button"
                    onClick={() => switchMode("signin")}
                    className="text-sm text-muted-foreground transition hover:text-foreground"
                  >
                    Back to sign in
                  </button>
                </div>
              </div>
            ) : (
              <>
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">{heading}</h1>
                <p className="mt-2 text-sm text-muted-foreground">{subheading}</p>
                <form
                  onSubmit={(event) => void handleSubmit(event)}
                  className="mt-6 flex flex-col gap-4"
                >
                  {errorBanner}
                  <PasswordInput
                    id="reset-password"
                    label="New password"
                    value={password}
                    onChange={(value) => {
                      setPassword(value);
                      clearFieldError("password");
                    }}
                    autoComplete="new-password"
                    error={errors.password}
                    hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
                    disabled={pending !== null}
                  />
                  <PasswordInput
                    id="reset-confirm"
                    label="Confirm new password"
                    value={confirmPassword}
                    onChange={(value) => {
                      setConfirmPassword(value);
                      clearFieldError("confirm");
                    }}
                    autoComplete="new-password"
                    placeholder="Repeat the new password"
                    error={errors.confirm}
                    disabled={pending !== null}
                  />
                  <Button
                    type="submit"
                    disabled={pending !== null}
                    className="h-11 w-full bg-accent text-accent-foreground hover:bg-accent/90"
                  >
                    {pending === "reset" ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : null}
                    {submitLabel}
                  </Button>
                  <button
                    type="button"
                    onClick={() => switchMode("signin")}
                    className="text-sm text-muted-foreground transition hover:text-foreground"
                  >
                    Cancel and sign in
                  </button>
                </form>
              </>
            )
          ) : (
            <>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">{heading}</h1>
              <p className="mt-2 text-sm text-muted-foreground">{subheading}</p>

              {mode === "signin" || mode === "signup" ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void handleGoogle()}
                    disabled={pending !== null}
                    className="mt-6 h-11 w-full border-neutral-800 bg-surface text-sm font-medium text-foreground hover:bg-neutral-800/40"
                  >
                    {pending === "google" ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <GoogleIcon />
                    )}
                    Continue with Google
                  </Button>
                  <div className="my-6 flex items-center gap-3 text-[10px] uppercase tracking-widest text-muted-foreground">
                    <div className="h-px flex-1 bg-neutral-800" />
                    or
                    <div className="h-px flex-1 bg-neutral-800" />
                  </div>
                </>
              ) : null}

              <form
                onSubmit={(event) => void handleSubmit(event)}
                className={cn("flex flex-col gap-4", mode === "forgot" && "pt-2")}
                noValidate
              >
                {errorBanner}

                {mode === "signup" ? (
                  <div className="flex flex-col gap-1.5">
                    <Label
                      htmlFor="auth-name"
                      className="text-xs uppercase tracking-widest text-muted-foreground"
                    >
                      Display name
                    </Label>
                    <Input
                      id="auth-name"
                      type="text"
                      value={displayName}
                      onChange={(event) => {
                        setDisplayName(event.target.value);
                        clearFieldError("name");
                      }}
                      autoComplete="name"
                      placeholder="How should we call you? (optional)"
                      disabled={pending !== null}
                      aria-invalid={errors.name ? true : undefined}
                      aria-describedby={errors.name ? "auth-name-error" : undefined}
                      className="h-11 border-neutral-800 bg-base text-sm"
                    />
                    {errors.name ? (
                      <p id="auth-name-error" role="alert" className="text-xs text-destructive">
                        {errors.name}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                <div className="flex flex-col gap-1.5">
                  <Label
                    htmlFor="auth-email"
                    className="text-xs uppercase tracking-widest text-muted-foreground"
                  >
                    Email
                  </Label>
                  <Input
                    id="auth-email"
                    type="email"
                    inputMode="email"
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      clearFieldError("email");
                    }}
                    autoComplete="email"
                    placeholder="you@example.com"
                    disabled={pending !== null}
                    aria-invalid={errors.email ? true : undefined}
                    aria-describedby={errors.email ? "auth-email-error" : undefined}
                    className="h-11 border-neutral-800 bg-base text-sm"
                  />
                  {errors.email ? (
                    <p id="auth-email-error" role="alert" className="text-xs text-destructive">
                      {errors.email}
                    </p>
                  ) : null}
                </div>

                {mode !== "forgot" ? (
                  <PasswordInput
                    id="auth-password"
                    label="Password"
                    action={
                      mode === "signin" ? (
                        <button
                          type="button"
                          onClick={() => switchMode("forgot")}
                          className="text-xs text-muted-foreground transition hover:text-foreground"
                        >
                          Forgot password?
                        </button>
                      ) : undefined
                    }
                    value={password}
                    onChange={(value) => {
                      setPassword(value);
                      clearFieldError("password");
                    }}
                    autoComplete={mode === "signin" ? "current-password" : "new-password"}
                    error={errors.password}
                    hint={
                      mode === "signup" ? `At least ${MIN_PASSWORD_LENGTH} characters.` : undefined
                    }
                    disabled={pending !== null}
                  />
                ) : null}

                <Button
                  type="submit"
                  disabled={pending !== null}
                  className="h-11 w-full bg-accent text-accent-foreground hover:bg-accent/90"
                >
                  {pending === "signin" || pending === "signup" || pending === "forgot" ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : null}
                  {submitLabel}
                </Button>
              </form>

              <div className="mt-6 text-center text-sm text-muted-foreground">
                {mode === "signin" ? (
                  <>
                    No account yet?{" "}
                    <button
                      type="button"
                      onClick={() => switchMode("signup")}
                      className="font-medium text-foreground transition hover:text-accent"
                    >
                      Create one
                    </button>
                  </>
                ) : mode === "signup" ? (
                  <>
                    Already have an account?{" "}
                    <button
                      type="button"
                      onClick={() => switchMode("signin")}
                      className="font-medium text-foreground transition hover:text-accent"
                    >
                      Sign in
                    </button>
                  </>
                ) : (
                  <>
                    Remembered your password?{" "}
                    <button
                      type="button"
                      onClick={() => switchMode("signin")}
                      className="font-medium text-foreground transition hover:text-accent"
                    >
                      Sign in
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Reading is free — an account is only needed to comment or to manage the studio.
        </p>
        {footer}
      </main>
    </div>
  );
}
