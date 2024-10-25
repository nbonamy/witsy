
import { execSync }  from 'child_process';
import readline from 'readline';
import chalk from 'chalk';

// some constants
const simulation = false;
const refreshDelay = simulation ? 1000* 1 : 1000*10;

// get github last commit hash
const lastCommitHash = execSync('git rev-parse HEAD').toString().trim();
console.log(`${chalk.blue('[#]')} Checking jobs for commit hash: ${lastCommitHash}`);

// now monitor the jobs
let tries = 0;
let baseline = -1;
let writtenLines = 0;
let lastStatus = null;
const check = () => {

  const status = execSync(`gh run list -c ${lastCommitHash} --json databaseId,workflowName,status,conclusion`).toString().trim();
  const jobs = JSON.parse(status);
  if (jobs.length === 0) {
    if (++tries > 6) {
      console.log(`${chalk.red('[X]')} No matching jobs found. Exiting...`);
      process.exit(1);
    } else {
      console.log(`${chalk.yellow('[?]')} No matching jobs found yet. Retrying in 10s...`);
      setTimeout(check, 1000*10);
      return;
    }
  }

  // get baseline
  if (baseline === -1) {
    baseline = process.stdout.rows;
  } else {
    readline.cursorTo(process.stdout, 0, baseline - writtenLines - 1);
  }

  // simulation mode
  if (simulation) {

    // init with all running
    const firstRun = lastStatus === null;
    if (lastStatus === null) {
      lastStatus = Array(jobs.length).fill(['running', ''], 0, jobs.length);
      jobs.splice(0, 2);
    }

    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i];
      job.status = lastStatus[i][0];
      job.conclusion = lastStatus[i][1];
      if (firstRun) continue;
      if (job.status === 'completed') continue;
      if (Math.random() < 0.7) continue;
      job.status = 'completed';
      job.conclusion = Math.random() > 0.2 ? 'success' : 'failure';
      lastStatus[i] = [job.status, job.conclusion];
    }
  }

  // print the status for each of them
  jobs.forEach((job) => {
    const statusColor = job.status !== 'completed' ? chalk.blue : job.conclusion === 'success' ? chalk.green : chalk.red;
    const statusIcon = job.status !== 'completed' ? '[▶︎]' : job.conclusion === 'success' ? '[✓]' : '[X]';
    const statusText = job.status !== 'completed' ? 'running' : job.conclusion === 'success' ? 'succeeded' : 'failed';
    console.log(`${statusColor(statusIcon)} ${job.workflowName} (${job.databaseId}) ${statusText}`.padEnd(process.stdout.columns, ' '));
  })

  // wait for all jobs to be completed
  const runningJobs = jobs.filter((job) => job.status !== 'completed');
  if (runningJobs.length > 0) {
    writtenLines = jobs.length;
    setTimeout(check, refreshDelay);
    return
  }

  // get the final statuses
  const failedJobs = jobs.filter((job) => job.conclusion === 'failure');
  const statusColor = failedJobs.length === jobs.length ? chalk.red : failedJobs.length > 0 ? chalk.yellow : chalk.green;
  const statusIcon = failedJobs.length !== 0 ? '[X]' : '[✓]';
  console.log(`${statusColor(statusIcon)} All jobs completed`.padEnd(process.stdout.columns, ' '));

  // exit
  process.exit(failedJobs.length > 0 ? 1 : 0)

}

check();
