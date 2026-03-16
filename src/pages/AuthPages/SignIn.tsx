import PageMeta from "../../components/common/PageMeta";
import AuthLayout from "./AuthPageLayout";
import SignInForm from "../../components/auth/SignInForm";

export default function SignIn() {
  return (
    <>
      <PageMeta
        title="Sign In | Hope - BMQAS"
        description="Sign In page for Hope Pro by Bengal Mobile QA Solution"
      />
      <AuthLayout>
        <SignInForm />
      </AuthLayout>
    </>
  );
}
