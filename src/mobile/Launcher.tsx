import { useNavigate } from "react-router";
import { ChevronRight, LayoutDashboard, Stethoscope, UserRound } from "lucide-react";
import { resetDemoData } from "../mock";
import { getSession } from "./api";

export default function Launcher() {
  const navigate = useNavigate();
  const patient = getSession("PATIENT");
  const provider = getSession("PROVIDER");
  const items = [
    {
      icon: <UserRound size={22} />,
      title: "Patient app",
      text: patient ? `Signed in as ${patient.user.firstName}` : "Book home visits, request long-term care, pay and review",
      to: "/app/patient",
    },
    {
      icon: <Stethoscope size={22} />,
      title: "Provider app",
      text: provider ? `Signed in as ${provider.user.firstName}` : "Doctors, nurses and caregivers: jobs, shifts and earnings",
      to: "/app/provider",
    },
  ];
  return (
    <div className="flex h-full flex-col overflow-y-auto bg-gradient-to-b from-brand-50 to-white px-5 py-10 dark:from-gray-900 dark:to-gray-950">
      <img src="/images/logo/logo-horizontal.svg" alt="Caregiver BD" className="h-11 w-auto self-start" />
      <h1 className="mt-8 text-2xl font-semibold text-gray-900 dark:text-white">Care at home, made simple</h1>
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">Pick an app to try. Both use the same demo data as the admin panel.</p>
      <div className="mt-8 grid gap-3">
        {items.map((it) => (
          <button
            key={it.to}
            type="button"
            onClick={() => navigate(it.to)}
            className="flex items-center gap-4 rounded-2xl border border-gray-200 bg-white p-4 text-left shadow-sm transition hover:border-brand-400 dark:border-gray-800 dark:bg-gray-900"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-500 text-white">{it.icon}</span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-gray-900 dark:text-white">{it.title}</span>
              <span className="block text-xs text-gray-500 dark:text-gray-400">{it.text}</span>
            </span>
            <ChevronRight size={18} className="text-gray-400" />
          </button>
        ))}
        <a
          href="/"
          target="_blank"
          rel="noopener"
          className="flex items-center gap-4 rounded-2xl border border-dashed border-gray-300 p-4 text-left dark:border-gray-700"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
            <LayoutDashboard size={22} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold text-gray-900 dark:text-white">Admin panel</span>
            <span className="block text-xs text-gray-500 dark:text-gray-400">Opens in a new tab · admin@hope.demo / demo1234</span>
          </span>
        </a>
      </div>
      <p className="mt-auto pt-8 text-center text-xs text-gray-400">Demo password for every account: demo1234 · OTP: 123456</p>
      <button
        type="button"
        onClick={() => window.confirm("Reset all demo data? Every change made in the apps and admin panel will be lost.") && resetDemoData()}
        className="mx-auto mt-2 text-xs font-medium text-red-500 hover:underline"
      >
        Reset demo data
      </button>
    </div>
  );
}
