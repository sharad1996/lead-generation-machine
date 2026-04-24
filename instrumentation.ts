export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startCronJobs } = await import("@/server/jobs/cron");
    startCronJobs();
  }
}
