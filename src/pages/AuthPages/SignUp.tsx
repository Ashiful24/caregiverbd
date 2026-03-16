import PageMeta from "../../components/common/PageMeta";
import AuthLayout from "./AuthPageLayout";
import SignUpForm from "../../components/auth/SignUpForm";

export default function SignUp() {
  return (
    <>
      <PageMeta
        title="Sign Up | Hope - BMQAS"
        description="Sign Up page for Hope Pro by Bengal Mobile QA Solution"
      />
      <AuthLayout>
        <SignUpForm />
      </AuthLayout>
    </>
  );
}
