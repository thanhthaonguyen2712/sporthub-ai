import { getRequestConfig } from "next-intl/server";

export default getRequestConfig(async () => {
  return {
    locale: "vi",
    messages: (await import("../messages/vi.json")).default,
  };
});
