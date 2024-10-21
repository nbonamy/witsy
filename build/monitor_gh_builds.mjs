
import { execSync }  from 'child_process';
import chalk from 'chalk';

// get github last commit hash
const lastCommitHash = execSync('git rev-parse HEAD').toString().trim();
console.log(`${chalk.blue('[#]')} Checking jobs for commit hash: ${lastCommitHash}`);

// now wait for the jobs to finish
let tries = 0;
let running = 0;
const check = () => {

  const jsonStatus = execSync(`gh run list -c ${lastCommitHash} --json databaseId,workflowName,status,conclusion`).toString().trim();
  const status = JSON.parse(jsonStatus);
  if (status.length === 0) {
    if (++tries > 6) {
      console.log(`${chalk.red('[X]')} No matching jobs found. Exiting...`);
      process.exit(1);
    } else {
      console.log(`${chalk.yellow('[?]')} No matching jobs found yet. Retrying in 10s...`);
      setTimeout(check, 1000*10);
      return;
    }
  }

  // wait for all jobs to be completed
  const runningJobs = status.filter((job) => job.status !== 'completed');
  if (runningJobs.length > 0) {
    if (runningJobs.length !== running) {
      console.log(`${chalk.blue('[▶︎]')} ${runningJobs.length}/${status.length} job(s) still running`);
      running = runningJobs.length;
    }
    setTimeout(check, 1000*10);
    return
  }

  // get the final statuses
  const successfulJobs = status.filter((job) => job.conclusion === 'success');
  const failedJobs = status.filter((job) => job.conclusion === 'failure');
  const statusColor = failedJobs.length === status.length ? chalk.red : failedJobs.length > 0 ? chalk.yellow : chalk.green; 

  // log
  console.log(`${statusColor('[✓]')} All jobs completed`);

  // show successfull jobs
  successfulJobs.forEach((job) => {
    console.log(`${chalk.green('[✓]')} Job ${job.databaseId} (${job.workflowName}) passed`);
  });

  // sjow failed jobs
  failedJobs.forEach((job) => {
    console.log(`${chalk.red('[X]')} Job ${job.databaseId} (${job.workflowName}) failed`);
  });

  // exit
  process.exit(failedJobs.length > 0 ? 1 : 0)

}

check();
