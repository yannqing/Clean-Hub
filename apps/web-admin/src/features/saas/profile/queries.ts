import { webAdminApi } from "@/lib/api-client";

export const getSaasProfileQuery = () => webAdminApi.saas.profile.get();
