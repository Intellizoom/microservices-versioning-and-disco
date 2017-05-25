const Promise = require('bluebird');
const fs = require('fs');
const Docker = require('dockerode');
const { Command } = require('commander');
const os = require('os');
const { find, get, isArray, isString, isObject } = require('lodash');
const { ok: assert, AssertionError } = require('assert');

const ECS_TASK_ARN_KEY = 'com.amazonaws.ecs.task-arn';
const ECS_CONTAINER_NAME_KEY = 'com.amazonaws.ecs.container-name';

const getLabel = (container, label) => get(container, 'Config.Labels', get(container, 'Labels', {}))[label];

const getTaskArn = async (docker, thisContainerId) => {
  const thisContainer = docker.getContainer(thisContainerId);
  assert(
    isObject(thisContainer),
    `Could not find THIS container [${thisContainerId}].
      Are you running this script in Docker?  It also can't be run in host-networking mode.`
  );
  const inspectedContainer = await thisContainer.inspect();
  const taskArn = getLabel(inspectedContainer, ECS_TASK_ARN_KEY);
  assert(
    isString(taskArn),
    `Could not locate the Task ARN for this deployment.
      Ensure the label "${ECS_TASK_ARN_KEY}" is present.`
  );
  return taskArn;
};

const getTaskContainers = async (docker, taskArn) => {
  const taskContainers = await docker.listContainers({ label: `${ECS_TASK_ARN_KEY}=${taskArn}` });
  assert(
    isArray(taskContainers) && taskContainers.length > 1,
    `Expecting 2 or more task containers for TaskArn: ${taskArn}`
  );
  return taskContainers;
};

const getTargetContainer = async (docker, thisContainerId, targetContainerName) => {
  const taskArn = await getTaskArn(docker, thisContainerId);
  const taskContainers = await getTaskContainers(docker, taskArn);
  const targetContainer = find(
    taskContainers,
    c => getLabel(c, ECS_CONTAINER_NAME_KEY) === targetContainerName
  );
  assert(
    isObject(targetContainer),
    `Could not find target container with name "${targetContainerName}".`
  );
  console.log(`Found target container "${targetContainerName}" [${targetContainer.Id.slice(0, 12)}]`);
  return docker.getContainer(targetContainer.Id);
};

const assertOrDie = (condition, message) => {
  if (!condition) {
    if (process.env.NODE_ENV === 'test') {
      throw new AssertionError(message);
    }
    console.log(message)
    program.help(); // this is a process.exit()
  }
}

const getConfiguration = (argv) => {
  // This isolates Commander (does not use the singleton export).
  // We need to do this because Mocha also uses Commander.
  const program = new Command();

  program
    .version('1.0.0')
    .option('-w, --watch <file>', 'File to watch')
    .option('-r, --reload <container>', 'ECS Container to reload')
    .option('-t, --wait [timems]', 'Wait a number of milliseconds; default 5000ms', parseInt)
    .option('-d, --docker [socket]', 'Path to the Docker socket, default /var/run/docker.sock')
    .parse(argv);

  assertOrDie(
    isString(program.reload),
    'Error: --reload property is required.'
  );

  assertOrDie(
    isString(program.watch),
    'Error: --watch property is required.'
  );

  return {
    waitTime: program.wait || 5000,
    hostname: os.hostname(),
    dockerSocket: program.docker || '/var/run/docker.sock',
    reload: program.reload,
    fileToWatch: program.watch,
  };
}

const getDockerInstance = (socketPath) => {
  assert(
    fs.statSync(socketPath).isSocket(),
    `Docker socket ${socketPath} was not found or is not a socket`
  );
  return new Docker({ socketPath, Promise });
};

const signalOnFileChange = async (target, fileToWatch) => {
  assert(
    fs.statSync(fileToWatch).isFile(),
    `File to watch ${fileToWatch} was not found or is not a file`
  );

  return fs.watch(fileToWatch, async (eventType, file) => {
    console.log(`FS.Watch Event: ${eventType}, File: ${file}; signalling restart.`);
    try {
      await target.kill({ signal: 'SIGHUP' });
    } catch (error) {
      console.error(error);
    }
  });
}

const run = async (argv) => {
  try {
    const config = getConfiguration(argv);
    const docker = await getDockerInstance(config.dockerSocket);

    console.log(`Waiting ${config.waitTime} ms for target container and file to appear.`);

    await Promise.delay(config.waitTime);

    const target = await getTargetContainer(docker, config.hostname, config.reload);

    console.log(`Watching path ${config.fileToWatch} to change...`);

    signalOnFileChange(target, config.fileToWatch);
  }
  catch (error) {
    console.error(error);
    process.exit(1);
  }
}

module.exports = {
  getConfiguration,
  getDockerInstance,
  getLabel,
  getTargetContainer,
  getTaskContainers,
  getTaskArn,
  run,
  signalOnFileChange,
  constants: {
    ECS_CONTAINER_NAME_KEY,
    ECS_TASK_ARN_KEY,
  },
};

if (process.env.NODE_ENV !== 'test') {
  run(process.argv);
}
