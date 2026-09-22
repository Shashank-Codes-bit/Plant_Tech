import { View } from "react-native";
import { Redirect } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/src/api";
import { LoadingView } from "@/src/components/ui";

export default function Index() {
  const { data, isLoading } = useQuery({
    queryKey: ["business"],
    queryFn: () => apiGet("/business"),
  });

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
        <LoadingView />
      </View>
    );
  }
  return <Redirect href={data ? "/(tabs)" : "/setup"} />;
}
