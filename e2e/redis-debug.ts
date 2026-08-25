import "@/extension";
import { RedisConnection } from "@/service/connect/redisConnection";

const node: any = { host: "127.0.0.1", port: 16379, password: "Test_1234", connectTimeout: 8000 };
const c = new RedisConnection(node);
const anyc = c as any;
console.log("client ctor name:", anyc.client && anyc.client.constructor && anyc.client.constructor.name);
console.log("typeof client.send_command:", typeof (anyc.client && anyc.client.send_command));
console.log("typeof client.ping:", typeof (anyc.client && anyc.client.ping));

c.connect((err) => {
  console.log("connect cb -> err =", err && err.message);
  if (err) { process.exit(1); }
  console.log("calling query('info server') ...");
  let fired = false;
  setTimeout(() => { if (!fired) { console.log("query callback NEVER fired after 8s"); process.exit(2); } }, 8000);
  try {
    c.query("info server", (qerr: any, res: any) => {
      fired = true;
      console.log("query cb -> err =", qerr && qerr.message, "| res type =", typeof res, "|", String(res).split("\n")[1] || "");
      process.exit(0);
    });
  } catch (e: any) {
    fired = true;
    console.log("query THREW:", e.message);
    process.exit(3);
  }
});
