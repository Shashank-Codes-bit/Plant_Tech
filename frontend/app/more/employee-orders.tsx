// One person's orders for a period, opened from Employees → Performance. The filters can still be changed.
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";

import { OrdersView } from "@/src/components/orders-view";

export default function EmployeeOrders() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id, name, from, to } = useLocalSearchParams<{ id: string; name?: string; from?: string; to?: string }>();
  return (
    <OrdersView key={`${id}:${from}:${to}`} start={{ madeBy: id, from, to }}
      title={name ? t("{{name}}'s orders", { name }) : t("Orders")} onBack={() => router.back()} />
  );
}
