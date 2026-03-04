import { useState } from "react";
import { Button, Input, Typography } from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import supabase from "../utils/supabase";

const { Title, Text } = Typography;

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const handleSendReset = async () => {
    const cleanedEmail = email.trim();
    if (!cleanedEmail) {
      setErrorMessage("Email is required.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");

    const { error } = await supabase.auth.resetPasswordForEmail(cleanedEmail, {
      redirectTo: `https://ggdc-poultry-manager.cficoop.com/reset-password`, // Update with your actual reset password page URL
    });

    if (error) {
      setErrorMessage(error.message);
    } else {
      setSuccessMessage("Password reset link sent. Check your email.");
    }

    setIsSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-sm border border-slate-200">
        <button
          type="button"
          className="text-slate-500 hover:text-slate-700 mb-3"
          onClick={() => navigate("/")}
        >
          <ArrowLeftOutlined /> Back to login
        </button>

        <Title level={3} className="!mb-1">
          Forgot Password
        </Title>
        <Text className="text-slate-500">
          Enter your account email and we will send you a reset link.
        </Text>

        <div className="mt-5 space-y-3">
          <Input
            size="large"
            placeholder="name@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onPressEnter={handleSendReset}
          />

          {errorMessage && <div className="text-sm text-red-600">{errorMessage}</div>}
          {successMessage && <div className="text-sm text-emerald-700">{successMessage}</div>}

          <Button
            type="primary"
            block
            size="large"
            className="!bg-[#008822] hover:!bg-[#006e1b] !border-none !mt-4"
            onClick={handleSendReset}
            loading={isSubmitting}
          >
            Send Reset Link
          </Button>
        </div>
      </div>
    </div>
  );
}
