import { useEffect, useState } from "react";
import { Button, Input, Typography } from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { useLocation, useNavigate } from "react-router-dom";
import supabase from "../utils/supabase";

const { Title, Text } = Typography;

const getErrorMessage = (error: unknown): string => {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return "Something went wrong. Please try again.";
};

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingLink, setIsCheckingLink] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    const initRecoverySession = async () => {
      setIsCheckingLink(true);
      setErrorMessage("");

      const hashParams = new URLSearchParams(location.hash.replace(/^#/, ""));
      const searchParams = new URLSearchParams(location.search);

      const hashError = hashParams.get("error_description") || hashParams.get("error");
      if (hashError) {
        setErrorMessage(decodeURIComponent(hashError.replace(/\+/g, " ")));
        setIsCheckingLink(false);
        return;
      }

      const code = searchParams.get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          setErrorMessage(getErrorMessage(error));
          setIsCheckingLink(false);
          return;
        }
      } else {
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");
        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) {
            setErrorMessage(getErrorMessage(error));
            setIsCheckingLink(false);
            return;
          }
        }
      }

      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        setErrorMessage("Email link is invalid or has expired. Request a new reset link.");
      }
      setIsCheckingLink(false);
    };

    void initRecoverySession();
  }, [location.hash, location.search]);

  const handleResetPassword = async () => {
    if (!password || !confirmPassword) {
      setErrorMessage("Both password fields are required.");
      return;
    }
    if (password.length < 6) {
      setErrorMessage("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");

    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setErrorMessage(getErrorMessage(error));
      setIsSubmitting(false);
      return;
    }

    setSuccessMessage("Password updated successfully. Please log in with your new password.");
    await supabase.auth.signOut();
    setIsSubmitting(false);
    setTimeout(() => navigate("/"), 1200);
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
          Reset Password
        </Title>
        <Text className="text-slate-500">
          Enter and confirm your new password.
        </Text>

        <div className="mt-5 space-y-3">
          <Input.Password
            size="large"
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isCheckingLink}
          />
          <Input.Password
            size="large"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            onPressEnter={handleResetPassword}
            disabled={isCheckingLink}
          />

          {errorMessage && <div className="text-sm text-red-600">{errorMessage}</div>}
          {successMessage && <div className="text-sm text-emerald-700">{successMessage}</div>}

          <Button
            type="primary"
            block
            size="large"
            className="!bg-[#008822] hover:!bg-[#006e1b] !border-none !mt-4"
            onClick={handleResetPassword}
            loading={isSubmitting || isCheckingLink}
            disabled={isCheckingLink || !!errorMessage}
          >
            Update Password
          </Button>
        </div>
      </div>
    </div>
  );
}
