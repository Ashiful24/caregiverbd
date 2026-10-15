import { useState, FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useLocation } from "react-router";
import { EyeCloseIcon, EyeIcon } from "../../icons";
import Label from "../form/Label";
import Input from "../form/input/InputField";
import Checkbox from "../form/input/Checkbox";
import Button from "../ui/button/Button";
import Alert from "../ui/alert/Alert";
import { useAuth } from "../../context/AuthContext";
import { isValidEmail, validateBangladeshiPhone } from "../../utils/phoneValidation";

export default function SignInForm() {
  const { t } = useTranslation();
  const [showPassword, setShowPassword] = useState(false);
  const [isChecked, setIsChecked] = useState(false);
  const [emailOrPhone, setEmailOrPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as { from?: Location })?.from?.pathname || "/";

  const performLogin = async () => {
    // Clear previous messages
    setError("");
    setSuccess("");
    
    // Prevent form submission if already submitting
    if (isSubmitting) {
      return;
    }
    
    setIsSubmitting(true);

    try {
      // Validate input before submitting
      if (!emailOrPhone || !password) {
        setError(t("auth.signIn.validationRequired"));
        setIsSubmitting(false);
        return;
      }

      const isEmail = isValidEmail(emailOrPhone);
      const isPhone = validateBangladeshiPhone(emailOrPhone);

      if (!isEmail && !isPhone) {
        setError(t("auth.signIn.validationInvalidContact"));
        setIsSubmitting(false);
        return;
      }

      // Call login API
      await login(emailOrPhone, password, isChecked);
      
      // Show success message
      setSuccess(t("auth.signIn.loginSuccess"));
      
      // Wait a moment to show success message, then redirect
      setTimeout(() => {
        navigate(from, { replace: true });
      }, 1000);
    } catch (err: any) {
      let errorMessage = t("auth.signIn.loginFailedDefault");
      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (err?.message) {
        errorMessage = err.message;
      } else if (err?.data?.message) {
        errorMessage = Array.isArray(err.data.message) ? err.data.message.join(". ") : err.data.message;
      } else if (err?.data?.error) {
        errorMessage = err.data.error;
      } else if (typeof err === "string") {
        errorMessage = err;
      } else if (err?.status === 0 || err?.name === "TypeError") {
        errorMessage = t("auth.signIn.networkError");
      }
      setError(errorMessage);
      setIsSubmitting(false);
    }
  };

  const handleFormSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    e.stopPropagation();
    performLogin();
    return false; // Additional safeguard
  };

  const handleButtonClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    performLogin();
    return false; // Additional safeguard
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
          <div className="mb-5 sm:mb-8">
            <h1 className="mb-2 font-semibold text-gray-800 text-title-sm dark:text-white/90 sm:text-title-md">
              {t("auth.signIn.title")}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t("auth.signIn.subtitle")}
            </p>
          </div>
          <div>
            <form 
              onSubmit={handleFormSubmit}
              noValidate
              action="javascript:void(0);"
              method="post"
            >
              {error && (
                <div className="mb-4">
                  <Alert
                    variant="error"
                    title={t("auth.signIn.loginFailed")}
                    message={error}
                    showLink={false}
                  />
                </div>
              )}
              {success && (
                <div className="mb-4">
                  <Alert
                    variant="success"
                    title={t("auth.signIn.successTitle")}
                    message={success}
                    showLink={false}
                  />
                </div>
              )}
              <div className="space-y-6">
                <div>
                  <Label>
                    {t("auth.signIn.emailOrPhone")} <span className="text-error-500">*</span>{" "}
                  </Label>
                  <Input
                    type="text"
                    placeholder={t("auth.signIn.emailOrPhonePlaceholder")}
                    value={emailOrPhone}
                    onChange={(e) => {
                      setEmailOrPhone(e.target.value);
                      if (error) setError("");
                    }}
                    onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        performLogin();
                      }
                    }}
                    required
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {t("auth.signIn.emailOrPhoneHint")}
                  </p>
                </div>
                <div>
                  <Label>
                    {t("auth.signIn.password")} <span className="text-error-500">*</span>{" "}
                  </Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder={t("auth.signIn.passwordPlaceholder")}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (error) setError("");
                      }}
                      onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          performLogin();
                        }
                      }}
                      required
                    />
                    <span
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute z-30 -translate-y-1/2 cursor-pointer right-4 top-1/2"
                    >
                      {showPassword ? (
                        <EyeIcon className="fill-gray-500 dark:fill-gray-400 size-5" />
                      ) : (
                        <EyeCloseIcon className="fill-gray-500 dark:fill-gray-400 size-5" />
                      )}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Checkbox checked={isChecked} onChange={setIsChecked} />
                    <span className="block font-normal text-gray-700 text-theme-sm dark:text-gray-400">
                      {t("auth.signIn.keepMeLoggedIn")}
                    </span>
                  </div>
                  <Link
                    to="/forgot-password"
                    className="text-sm text-brand-500 hover:text-brand-600 dark:text-brand-400"
                  >
                    {t("auth.signIn.forgotPassword")}
                  </Link>
                </div>
                <div>
                  <Button 
                    className="w-full" 
                    size="sm" 
                    type="button" 
                    disabled={isSubmitting}
                    onClick={handleButtonClick}
                  >
                    {isSubmitting ? t("auth.signIn.signingInButton") : t("auth.signIn.signInButton")}
                  </Button>
                </div>
              </div>
            </form>

            <div className="mt-5">
              <p className="text-sm font-normal text-center text-gray-700 dark:text-gray-400 sm:text-start">
                {t("auth.signIn.noAccount")} {""}
                <Link
                  to="/signup"
                  className="text-brand-500 hover:text-brand-600 dark:text-brand-400"
                >
                  {t("auth.signIn.signUpLink")}
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
