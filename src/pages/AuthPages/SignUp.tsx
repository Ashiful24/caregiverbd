import PageMeta from "../../components/common/PageMeta";
import { useTranslation } from "react-i18next";
import AuthLayout from "./AuthPageLayout";
import SignUpForm from "../../components/auth/SignUpForm";

export default function SignUp() {
  const { t } = useTranslation();

  return (
    <>
      <PageMeta
        title={t("auth.meta.signUpTitle")}
        description={t("auth.meta.signUpDescription")}
      />
      <AuthLayout>
        <SignUpForm />
      </AuthLayout>
    </>
  );
}
