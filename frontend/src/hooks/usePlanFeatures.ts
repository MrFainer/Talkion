"use client";

import { useAuthStore } from "@/store/auth";
import { useEffect, useState } from "react";
import api from "@/lib/api";

export type PlanFeature =
  | "ai_content"
  | "speaking_ia"
  | "quiz"
  | "dashboard"
  | "private_flows"
  | "group_flows"
  | "student_management"
  | "automations"
  | "lesson_confirmation"
  | "scheduling"
  | "priority_support"
  | "multi_teacher"
  | "advanced_reports"
  | "admin_dashboard"
  | "api_integrations"
  | "dedicated_support"
  | "onboarding"
  | "affiliate_program"
  | "custom_messages"
  | "weekly_newsletter"
  | "content_studio";

const defaultFeatures: Record<PlanFeature, boolean> = {
  ai_content: false,
  speaking_ia: false,
  quiz: false,
  dashboard: false,
  private_flows: false,
  group_flows: false,
  student_management: false,
  automations: false,
  lesson_confirmation: false,
  scheduling: false,
  priority_support: false,
  multi_teacher: false,
  advanced_reports: false,
  admin_dashboard: false,
  api_integrations: false,
  dedicated_support: false,
  onboarding: false,
  affiliate_program: false,
  custom_messages: false,
  weekly_newsletter: false,
  content_studio: false,
};

export function usePlanFeatures() {
  const { user, isHydrated } = useAuthStore();
  const [features, setFeatures] = useState<Record<PlanFeature, boolean>>(defaultFeatures);
  const [planName, setPlanName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isHydrated || !user?.id) return;
    setLoading(true);
    api.get(`/subscriptions/user/${user.id}`)
      .then((res) => {
        const sub = res.data;
        const plan = sub?.plan;
        if (plan?.features) {
          setFeatures({ ...defaultFeatures, ...plan.features });
          setPlanName(plan.name);
        }
      })
      .catch(() => setFeatures(defaultFeatures))
      .finally(() => setLoading(false));
  }, [user?.id, isHydrated]);

  const hasFeature = (feature: PlanFeature) => features[feature] === true;

  return { features, hasFeature, planName, loading };
}
