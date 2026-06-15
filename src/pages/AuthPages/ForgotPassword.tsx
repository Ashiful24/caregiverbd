import { useTranslation } from "react-i18next";
import PageMeta from "../../components/common/PageMeta";
import AuthLayout from "./AuthPageLayout";
import ForgotPasswordForm from "../../components/auth/ForgotPasswordForm";

export default function ForgotPassword() {
  const { t } = useTranslation();

  return (
    <>
      <PageMeta
        title={t("auth.meta.forgotPasswordTitle")}
        description={t("auth.meta.forgotPasswordDescription")}
      />
      <AuthLayout>
        <ForgotPasswordForm />
      </AuthLayout>
    </>
  );
}
