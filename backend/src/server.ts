import "dotenv/config";
import { createApp } from "./app";
import { env } from "./lib/env";

const app = createApp();

app.listen(env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[proposa] backend listening on :${env.PORT}`);
});
