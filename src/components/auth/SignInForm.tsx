import { useState, FormEvent } from "react";
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
  const [showPassword, setShowPassword] = useState(false);
  const [isChecked, setIsChecked] = useState(false);
  const [emailOrPhone, setEmailOrPhone] = useState("admin@hope.com");
  const [password, setPassword] = useState("password123");
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
        setError("Email/Phone and password are required");
        setIsSubmitting(false);
        return;
      }

      const isEmail = isValidEmail(emailOrPhone);
      const isPhone = validateBangladeshiPhone(emailOrPhone);

      if (!isEmail && !isPhone) {
        setError("Please enter a valid email or Bangladeshi phone number (e.g., 01712345678 or +8801712345678)");
        setIsSubmitting(false);
        return;
      }

      // Call login API
      await login(emailOrPhone, password, isChecked);
      
      // Show success message
      setSuccess("Login successful! Redirecting...");
      
      // Wait a moment to show success message, then redirect
      setTimeout(() => {
        navigate(from, { replace: true });
      }, 1000);
    } catch (err: any) {
      let errorMessage = "Failed to sign in. Please try again.";
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
        errorMessage = "Network error. Please check your connection and try again.";
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
          <div className="mb-5 sm:mb-8">
            <h1 className="mb-2 font-semibold text-gray-800 text-title-sm dark:text-white/90 sm:text-title-md">
              Sign In
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Enter your email or phone number and password to sign in!
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
                    title="Login Failed"
                    message={error}
                    showLink={false}
                  />
                </div>
              )}
              {success && (
                <div className="mb-4">
                  <Alert
                    variant="success"
                    title="Success"
                    message={success}
                    showLink={false}
                  />
                </div>
              )}
              <div className="space-y-6">
                <div>
                  <Label>
                    Email or Phone <span className="text-error-500">*</span>{" "}
                  </Label>
                  <Input
                    type="text"
                    placeholder="info@gmail.com or 01712345678"
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
                    Use email or Bangladeshi phone number (e.g., 01712345678, +8801712345678)
                  </p>
                </div>
                <div>
                  <Label>
                    Password <span className="text-error-500">*</span>{" "}
                  </Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
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
                      Keep me logged in
                    </span>
                  </div>
                  <Link
                    to="/reset-password"
                    className="text-sm text-brand-500 hover:text-brand-600 dark:text-brand-400"
                  >
                    Forgot password?
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
                    {isSubmitting ? "Signing in..." : "Sign in"}
                  </Button>
                </div>
              </div>
            </form>

            <div className="mt-5">
              <p className="text-sm font-normal text-center text-gray-700 dark:text-gray-400 sm:text-start">
                Don&apos;t have an account? {""}
                <Link
                  to="/signup"
                  className="text-brand-500 hover:text-brand-600 dark:text-brand-400"
                >
                  Sign Up
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
