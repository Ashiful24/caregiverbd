import { useState, FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router";
import { EyeCloseIcon, EyeIcon } from "../../icons";
import Label from "../form/Label";
import Input from "../form/input/InputField";
import Button from "../ui/button/Button";
import Alert from "../ui/alert/Alert";
import { authApi } from "../../services/api";
import { isValidEmail, validateBangladeshiPhone } from "../../utils/phoneValidation";

const MIN_PASSWORD_LENGTH = 8;
const OTP_LENGTH = 6;

type Step = "request" | "verify" | "reset" | "success";

function extractErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message;
  if (err && typeof err === "object") {
    const e = err as {
      message?: string;
      data?: { message?: string | string[]; error?: string };
    };
    if (e.message) return e.message;
    if (e.data?.message) {
      return Array.isArray(e.data.message)
        ? e.data.message.join(". ")
        : e.data.message;
    }
    if (e.data?.error) return e.data.error;
  }
  return fallback;
}

export default function ForgotPasswordForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>("request");
  const [identifier, setIdentifier] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [verificationToken, setVerificationToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateIdentifier = (value: string): boolean => {
    const trimmed = value.trim();
    if (!trimmed) {
      setError(t("auth.forgotPassword.validationRequired"));
      return false;
    }
    if (!isValidEmail(trimmed) && !validateBangladeshiPhone(trimmed)) {
      setError(t("auth.signIn.validationInvalidContact"));
      return false;
    }
    return true;
  };

  const handleRequestOtp = async () => {
    setError("");
    if (isSubmitting) return;
    const trimmed = identifier.trim();
    if (!validateIdentifier(trimmed)) return;

    setIsSubmitting(true);
    try {
      await authApi.passwordResetRequest({ identifier: trimmed });
      setIdentifier(trimmed);
      setStep("verify");
      setOtpCode("");
    } catch (err: unknown) {
      setError(extractErrorMessage(err, t("auth.forgotPassword.requestFailed")));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyOtp = async () => {
    setError("");
    if (isSubmitting) return;
    const code = otpCode.trim();
    if (!code || code.length < OTP_LENGTH) {
      setError(t("auth.forgotPassword.otpValidationRequired"));
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await authApi.passwordResetVerifyOtp({
        identifier: identifier.trim(),
        otpCode: code,
      });
      const token =
        res?.data?.verificationToken ??
        (res as { verificationToken?: string })?.verificationToken;
      if (!token) {
        setError(t("auth.forgotPassword.verifyFailed"));
        return;
      }
      setVerificationToken(token);
      setStep("reset");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      setError(extractErrorMessage(err, t("auth.forgotPassword.verifyFailed")));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async () => {
    setError("");
    if (isSubmitting) return;
    if (!newPassword || !confirmPassword) {
      setError(t("auth.resetPassword.validationRequired"));
      return;
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(t("auth.resetPassword.validationTooShort"));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t("auth.resetPassword.validationMismatch"));
      return;
    }

    setIsSubmitting(true);
    try {
      await authApi.passwordReset({
        identifier: identifier.trim(),
        verificationToken: verificationToken.trim(),
        newPassword,
      });
      setStep("success");
    } catch (err: unknown) {
      setError(extractErrorMessage(err, t("auth.resetPassword.resetFailed")));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFormSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (step === "request") void handleRequestOtp();
    else if (step === "verify") void handleVerifyOtp();
    else if (step === "reset") void handleResetPassword();
  };

  const handleResendOtp = async () => {
    setError("");
    setOtpCode("");
    setIsSubmitting(true);
    try {
      await authApi.passwordResetRequest({ identifier: identifier.trim() });
    } catch (err: unknown) {
      setError(extractErrorMessage(err, t("auth.forgotPassword.requestFailed")));
    } finally {
      setIsSubmitting(false);
    }
  };

  const stepTitles: Record<Exclude<Step, "success">, string> = {
    request: t("auth.forgotPassword.title"),
    verify: t("auth.forgotPassword.verifyOtpTitle"),
    reset: t("auth.resetPassword.title"),
  };

  const stepSubtitles: Record<Exclude<Step, "success">, string> = {
    request: t("auth.forgotPassword.subtitle"),
    verify: t("auth.forgotPassword.verifyOtpSubtitle", { identifier }),
    reset: t("auth.resetPassword.subtitle", { identifier }),
  };

  return (
    <div className="flex flex-col flex-1">
      <div className="flex flex-col justify-center flex-1 w-full max-w-md mx-auto">
        <div>
          <Link to="/" aria-label="Caregiver BD home" className="mb-6 inline-block sm:mb-8">
            <img
              src="/images/logo/logo-horizontal.svg"
              alt="Caregiver BD"
              width={160}
              height={48}
              className="h-10 w-auto sm:h-12"
            />
          </Link>

          {step === "success" ? (
            <div className="space-y-5">
              <div>
                <h1 className="mb-2 font-semibold text-gray-800 text-title-sm dark:text-white/90 sm:text-title-md">
                  {t("auth.resetPassword.successTitle")}
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {t("auth.resetPassword.successMessage")}
                </p>
              </div>
              <Button
                className="w-full"
                size="sm"
                type="button"
                onClick={() => navigate("/signin", { replace: true })}
              >
                {t("auth.resetPassword.goToSignIn")}
              </Button>
            </div>
          ) : (
            <>
              <div className="mb-5 sm:mb-8">
                <h1 className="mb-2 font-semibold text-gray-800 text-title-sm dark:text-white/90 sm:text-title-md">
                  {stepTitles[step]}
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {stepSubtitles[step]}
                </p>
                {step !== "request" ? (
                  <div className="mt-4 flex gap-2" aria-hidden>
                    {(["request", "verify", "reset"] as const).map((s, i) => (
                      <div
                        key={s}
                        className={`h-1 flex-1 rounded-full ${
                          (["request", "verify", "reset"] as const).indexOf(step) >= i
                            ? "bg-brand-500"
                            : "bg-gray-200 dark:bg-gray-700"
                        }`}
                      />
                    ))}
                  </div>
                ) : null}
              </div>

              <form onSubmit={handleFormSubmit} noValidate>
                {error ? (
                  <div className="mb-4">
                    <Alert
                      variant="error"
                      title={t("auth.signIn.loginFailed")}
                      message={error}
                      showLink={false}
                    />
                  </div>
                ) : null}

                <div className="space-y-6">
                  {step === "request" ? (
                    <div>
                      <Label>
                        {t("auth.forgotPassword.identifier")}{" "}
                        <span className="text-error-500">*</span>
                      </Label>
                      <Input
                        type="text"
                        placeholder={t("auth.forgotPassword.identifierPlaceholder")}
                        value={identifier}
                        onChange={(e) => {
                          setIdentifier(e.target.value);
                          if (error) setError("");
                        }}
                        required
                      />
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {t("auth.forgotPassword.identifierHint")}
                      </p>
                    </div>
                  ) : null}

                  {step === "verify" ? (
                    <div>
                      <Label>
                        {t("auth.forgotPassword.otpLabel")}{" "}
                        <span className="text-error-500">*</span>
                      </Label>
                      <Input
                        type="text"
                        placeholder={t("auth.forgotPassword.otpPlaceholder")}
                        value={otpCode}
                        onChange={(e) => {
                          const v = e.target.value.replace(/\D/g, "").slice(0, OTP_LENGTH);
                          setOtpCode(v);
                          if (error) setError("");
                        }}
                        required
                        className="text-center text-lg tracking-[0.35em] font-mono"
                      />
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {t("auth.forgotPassword.otpHint")}
                      </p>
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setStep("request");
                            setOtpCode("");
                            setError("");
                          }}
                          className="text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                        >
                          {t("auth.forgotPassword.changeIdentifier")}
                        </button>
                        <button
                          type="button"
                          disabled={isSubmitting}
                          onClick={() => void handleResendOtp()}
                          className="text-sm font-medium text-brand-500 hover:text-brand-600 disabled:opacity-50 dark:text-brand-400"
                        >
                          {t("auth.forgotPassword.resendOtp")}
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {step === "reset" ? (
                    <>
                      <div>
                        <Label>
                          {t("auth.resetPassword.newPassword")}{" "}
                          <span className="text-error-500">*</span>
                        </Label>
                        <div className="relative">
                          <Input
                            type={showNewPassword ? "text" : "password"}
                            placeholder={t("auth.resetPassword.newPasswordPlaceholder")}
                            value={newPassword}
                            onChange={(e) => {
                              setNewPassword(e.target.value);
                              if (error) setError("");
                            }}
                            required
                          />
                          <span
                            onClick={() => setShowNewPassword((s) => !s)}
                            className="absolute z-30 -translate-y-1/2 cursor-pointer right-4 top-1/2"
                          >
                            {showNewPassword ? (
                              <EyeIcon className="fill-gray-500 dark:fill-gray-400 size-5" />
                            ) : (
                              <EyeCloseIcon className="fill-gray-500 dark:fill-gray-400 size-5" />
                            )}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          {t("auth.resetPassword.passwordHint")}
                        </p>
                      </div>
                      <div>
                        <Label>
                          {t("auth.resetPassword.confirmPassword")}{" "}
                          <span className="text-error-500">*</span>
                        </Label>
                        <div className="relative">
                          <Input
                            type={showConfirmPassword ? "text" : "password"}
                            placeholder={t("auth.resetPassword.confirmPasswordPlaceholder")}
                            value={confirmPassword}
                            onChange={(e) => {
                              setConfirmPassword(e.target.value);
                              if (error) setError("");
                            }}
                            required
                          />
                          <span
                            onClick={() => setShowConfirmPassword((s) => !s)}
                            className="absolute z-30 -translate-y-1/2 cursor-pointer right-4 top-1/2"
                          >
                            {showConfirmPassword ? (
                              <EyeIcon className="fill-gray-500 dark:fill-gray-400 size-5" />
                            ) : (
                              <EyeCloseIcon className="fill-gray-500 dark:fill-gray-400 size-5" />
                            )}
                          </span>
                        </div>
                      </div>
                    </>
                  ) : null}

                  <div>
                    <Button className="w-full" size="sm" type="submit" disabled={isSubmitting}>
                      {step === "request"
                        ? isSubmitting
                          ? t("auth.forgotPassword.submittingButton")
                          : t("auth.forgotPassword.submitButton")
                        : step === "verify"
                          ? isSubmitting
                            ? t("auth.forgotPassword.verifyingOtp")
                            : t("auth.forgotPassword.verifyOtpButton")
                          : isSubmitting
                            ? t("auth.resetPassword.submittingButton")
                            : t("auth.resetPassword.submitButton")}
                    </Button>
                  </div>

                  <p className="text-sm text-center text-gray-700 dark:text-gray-400 sm:text-start">
                    <Link
                      to="/signin"
                      className="text-brand-500 hover:text-brand-600 dark:text-brand-400"
                    >
                      {t("auth.forgotPassword.backToSignIn")}
                    </Link>
                  </p>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
