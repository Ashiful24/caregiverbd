import { createRoot } from "react-dom/client";
import { BrowserRouter as Router } from "react-router";
import "./index.css";
import "react-day-picker/style.css";
import "swiper/swiper-bundle.css";
import "flatpickr/dist/flatpickr.css";
import "./i18n";
import App from "./App.tsx";
import { AppWrapper } from "./components/common/PageMeta.tsx";
import { ThemeProvider } from "./context/ThemeContext.tsx";
import { AuthProvider } from "./context/AuthContext.tsx";
import { AppQueryProvider } from "./providers/AppQueryProvider.tsx";

// Suppress all console output so logs are always ignored
const noop = () => {};
if (typeof console !== "undefined") {
  console.log = noop;
  console.info = noop;
  console.warn = noop;
  console.error = noop;
  console.debug = noop;
}

// StrictMode removed so effects run once per mount — no more first request aborted (ns_binding_aborted) in dev.

createRoot(document.getElementById("root")!).render(
  <ThemeProvider>
    <AuthProvider>
      <AppQueryProvider>
        <AppWrapper>
          <Router>
            <App />
          </Router>
        </AppWrapper>
      </AppQueryProvider>
    </AuthProvider>
  </ThemeProvider>,
);
