import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { client, setSession, type MobileSession, type Role } from "../api";
import { useAction, useApi } from "../hooks";
import { Button, Field, Input, Notice, Screen, Select, useToast } from "../ui";

const homeOf = (role: Role) => (role === "PATIENT" ? "/app/patient" : "/app/provider");
const label = (role: Role) => (role === "PATIENT" ? "Patient" : "Provider");

export function Login({ role }: { role: Role }) {
  const api = client(role);
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const { busy, run } = useAction();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const from = (location.state as { from?: string } | null)?.from;

  const signIn = async (id: string, pw: string) => {
    const s = await run(() => api.post<MobileSession>("/users/login", { identifier: id, password: pw }), (m) => toast(m, "err"));
    if (!s) return;
    setSession(role, s);
    navigate(from && from.startsWith(homeOf(role)) ? from : homeOf(role), { replace: true });
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    signIn(identifier, password);
  };

  return (
    <Screen title={`${label(role)} sign in`} back="/app">
      <img src="/images/logo/logo-horizontal.svg" alt="Caregiver BD" className="mb-6 mt-2 h-10" />
      <form onSubmit={submit}>
        <Field label="Mobile number or email">
          <Input value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="01712345678" autoComplete="username" required />
        </Field>
        <Field label="Password">
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        </Field>
        <Button type="submit" busy={busy} className="w-full">
          Sign in
        </Button>
      </form>
      <div className="mt-3 flex justify-between text-sm">
        <Link to={`${homeOf(role)}/forgot`} className="text-gray-500 hover:text-gray-700 dark:text-gray-400">
          Forgot password?
        </Link>
        <Link to={`${homeOf(role)}/register`} className="font-semibold text-brand-600">
          Create account
        </Link>
      </div>
    </Screen>
  );
}

export function Register({ role }: { role: Role }) {
  const api = client(role);
  const navigate = useNavigate();
  const toast = useToast();
  const { busy, run } = useAction();
  const [step, setStep] = useState<"phone" | "otp" | "details">("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [token, setToken] = useState("");
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", password: "", nidNumber: "", address: "", consultationTypeId: "", experience: "1", gender: "" });
  const types = useApi(() => api.get<Array<{ id: number; name: string; children: Array<{ id: number; name: string }> }>>("/consultation-types"), []);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const requestOtp = async (e: FormEvent) => {
    e.preventDefault();
    const r = await run(() => api.post<{ message: string }>("/auth/otp/request", { mobileNumber: phone, useFor: "REGISTRATION" }), (m) => toast(m, "err"));
    if (r) {
      toast(r.message);
      setStep("otp");
    }
  };
  const verifyOtp = async (e: FormEvent) => {
    e.preventDefault();
    const r = await run(() => api.post<{ verificationToken: string }>("/auth/otp/verify", { mobileNumber: phone, otpCode: otp }), (m) => toast(m, "err"));
    if (r) {
      setToken(r.verificationToken);
      setStep("details");
    }
  };
  const register = async (e: FormEvent) => {
    e.preventDefault();
    const path = role === "PATIENT" ? "/auth/register/patient" : "/auth/register/provider";
    const s = await run(
      () => api.post<MobileSession>(path, { ...form, verificationToken: token, mobileNumber: phone, consultationTypeId: Number(form.consultationTypeId) || undefined }),
      (m) => toast(m, "err")
    );
    if (!s) return;
    setSession(role, s);
    toast("Account created");
    navigate(role === "PROVIDER" ? "/app/provider/verification" : "/app/patient", { replace: true });
  };

  return (
    <Screen title={`New ${label(role).toLowerCase()} account`} back={`${homeOf(role)}/login`} subtitle={`Step ${step === "phone" ? 1 : step === "otp" ? 2 : 3} of 3`}>
      {step === "phone" && (
        <form onSubmit={requestOtp}>
          <p className="mb-4 text-sm text-gray-600 dark:text-gray-300">We will send a one-time code to verify your number.</p>
          <Field label="Mobile number" hint="01XXXXXXXXX, +8801XXXXXXXXX or 8801XXXXXXXXX">
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01712345678" inputMode="tel" required />
          </Field>
          <Button type="submit" busy={busy} className="w-full">
            Send OTP
          </Button>
        </form>
      )}
      {step === "otp" && (
        <form onSubmit={verifyOtp}>
          <Notice tone="blue">Demo OTP is 123456</Notice>
          <div className="h-3" />
          <Field label={`Code sent to ${phone}`}>
            <Input value={otp} onChange={(e) => setOtp(e.target.value)} inputMode="numeric" maxLength={6} placeholder="6-digit code" required />
          </Field>
          <Button type="submit" busy={busy} className="w-full">
            Verify
          </Button>
          <Button variant="ghost" className="mt-2 w-full" onClick={() => setStep("phone")}>
            Change number
          </Button>
        </form>
      )}
      {step === "details" && (
        <form onSubmit={register}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="First name">
              <Input value={form.firstName} onChange={set("firstName")} required />
            </Field>
            <Field label="Last name">
              <Input value={form.lastName} onChange={set("lastName")} required />
            </Field>
          </div>
          <Field label="Gender">
            <Select value={form.gender} onChange={set("gender")}>
              <option value="">Prefer not to say</option>
              <option value="FEMALE">Female</option>
              <option value="MALE">Male</option>
            </Select>
          </Field>
          {role === "PATIENT" ? (
            <>
              <Field label="NID number" hint="10, 13 or 17 digits">
                <Input value={form.nidNumber} onChange={set("nidNumber")} inputMode="numeric" required />
              </Field>
              <Field label="Home address">
                <Input value={form.address} onChange={set("address")} placeholder="House, road, area" />
              </Field>
            </>
          ) : (
            <>
              <Field label="Service you provide">
                <Select value={form.consultationTypeId} onChange={set("consultationTypeId")} required>
                  <option value="">Select</option>
                  {(types.data ?? []).map((root) =>
                    root.children.length ? (
                      <optgroup key={root.id} label={root.name}>
                        {root.children.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </optgroup>
                    ) : null
                  )}
                </Select>
              </Field>
              <Field label="Years of experience">
                <Input type="number" min={0} max={50} value={form.experience} onChange={set("experience")} />
              </Field>
            </>
          )}
          <Field label="Email (optional)">
            <Input type="email" value={form.email} onChange={set("email")} />
          </Field>
          <Field label="Password" hint="At least 8 characters">
            <Input type="password" value={form.password} onChange={set("password")} minLength={8} required autoComplete="new-password" />
          </Field>
          {role === "PROVIDER" && (
            <Notice tone="blue">Your profile starts as PENDING. Upload documents next; admin verifies you before you can take jobs.</Notice>
          )}
          <Button type="submit" busy={busy} className="mt-4 w-full">
            Create account
          </Button>
        </form>
      )}
    </Screen>
  );
}

export function ForgotPassword({ role }: { role: Role }) {
  const api = client(role);
  const navigate = useNavigate();
  const toast = useToast();
  const { busy, run } = useAction();
  const [step, setStep] = useState<"id" | "otp" | "new">("id");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [token, setToken] = useState("");
  const [pw, setPw] = useState("");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (step === "id") {
      const r = await run(() => api.post<{ message: string }>("/auth/password-reset/request", { identifier: phone }), (m) => toast(m, "err"));
      if (r) {
        toast(r.message);
        setStep("otp");
      }
    } else if (step === "otp") {
      const r = await run(() => api.post<{ verificationToken: string }>("/auth/password-reset/verify-otp", { mobileNumber: phone, otpCode: otp }), (m) => toast(m, "err"));
      if (r) {
        setToken(r.verificationToken);
        setStep("new");
      }
    } else {
      const r = await run(() => api.post<{ message: string }>("/auth/password-reset/reset", { mobileNumber: phone, verificationToken: token, newPassword: pw }), (m) => toast(m, "err"));
      if (r) {
        toast(r.message);
        navigate(`${homeOf(role)}/login`, { replace: true });
      }
    }
  };

  return (
    <Screen title="Reset password" back={`${homeOf(role)}/login`}>
      <form onSubmit={submit}>
        {step === "id" && (
          <Field label="Registered mobile number">
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01712345678" required />
          </Field>
        )}
        {step === "otp" && (
          <>
            <Notice tone="blue">Demo OTP is 123456</Notice>
            <div className="h-3" />
            <Field label="OTP">
              <Input value={otp} onChange={(e) => setOtp(e.target.value)} maxLength={6} inputMode="numeric" required />
            </Field>
          </>
        )}
        {step === "new" && (
          <Field label="New password" hint="At least 8 characters">
            <Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} minLength={8} required autoComplete="new-password" />
          </Field>
        )}
        <Button type="submit" busy={busy} className="w-full">
          {step === "id" ? "Send OTP" : step === "otp" ? "Verify" : "Set new password"}
        </Button>
      </form>
    </Screen>
  );
}
