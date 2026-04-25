import { runStockPrepImportWorker } from "./stockPrepImportWorker";

async function main() {
  const maxJobs = parseMaxJobs(process.argv.slice(2));
  const result = await runStockPrepImportWorker({ maxJobs });

  console.log(
    JSON.stringify(
      {
        completedJobIds: result.completedJobs.map((job) => job.id),
        failedJobIds: result.failedJobs.map((job) => job.id),
        processedJobs: result.processedJobs,
      },
      null,
      2,
    ),
  );
}

function parseMaxJobs(args: string[]): number {
  const maxJobsFlag = args.find((arg) => arg.startsWith("--max-jobs="));

  if (args.includes("--once")) {
    return 1;
  }

  if (!maxJobsFlag) {
    return Number.POSITIVE_INFINITY;
  }

  const rawValue = maxJobsFlag.slice("--max-jobs=".length);
  const maxJobs = Number(rawValue);

  if (!Number.isInteger(maxJobs) || maxJobs <= 0) {
    throw new Error("--max-jobs には 1 以上の整数を指定してください。");
  }

  return maxJobs;
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
