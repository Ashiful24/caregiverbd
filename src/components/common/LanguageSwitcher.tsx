import { useTranslation } from "react-i18next";

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();

  const isBn = i18n.resolvedLanguage === "bn";

  return (
    <div className="inline-flex items-center rounded-lg border border-gray-200 bg-white p-1 dark:border-gray-800 dark:bg-gray-900">
      <button
        type="button"
        onClick={() => {
          void i18n.changeLanguage("en");
        }}
        className={`rounded-md px-2 py-1 text-xs font-medium ${
          !isBn
            ? "bg-brand-500 text-white"
            : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
        }`}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => {
          void i18n.changeLanguage("bn");
        }}
        className={`rounded-md px-2 py-1 text-xs font-medium ${
          isBn
            ? "bg-brand-500 text-white"
            : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
        }`}
      >
        BN
      </button>
    </div>
  );
}
