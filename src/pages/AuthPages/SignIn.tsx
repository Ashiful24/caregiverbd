import PageMeta from "../../components/common/PageMeta";
import { useTranslation } from "react-i18next";
import AuthLayout from "./AuthPageLayout";
import SignInForm from "../../components/auth/SignInForm";

export default function SignIn() {
  const { t } = useTranslation();

  return (
    <>
      <PageMeta
        title={t("auth.meta.signInTitle")}
        description={t("auth.meta.signInDescription")}
      />
      <AuthLayout>
        <SignInForm />
      </AuthLayout>
    </>
  );
}
